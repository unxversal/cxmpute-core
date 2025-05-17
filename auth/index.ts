// auth/index.ts
import { handle } from "hono/aws-lambda";
import { issuer } from "@openauthjs/openauth";
import { CodeProvider } from "@openauthjs/openauth/provider/code";
import { CodeUI } from "@openauthjs/openauth/ui/code";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { v4 as uuidv4 } from "uuid";
import { THEME_OPENAUTH } from "@openauthjs/openauth/ui/theme";

import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  ScanCommand, // Still used for UserTable scan initially
  GetCommand,  // For checking TradersTable
} from "@aws-sdk/lib-dynamodb";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { Resource } from "sst";
import { subjects } from "./subjects";
import { ADMIN_EMAILS } from "@/lib/privateutils"; // Ensure this path is correct

THEME_OPENAUTH.favicon = "https://i.postimg.cc/bNLm9f7T/3.png";
THEME_OPENAUTH.logo = "https://i.postimg.cc/6qhxh1Kv/8.png";
THEME_OPENAUTH.title = "cxmpute.cloud - login";
THEME_OPENAUTH.background = 'white';
THEME_OPENAUTH.primary = 'black';

const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const PROVIDER_TABLE = Resource.ProviderTable.name;
const USER_TABLE = Resource.UserTable.name;
const TRADERS_TABLE = Resource.TradersTable.name; // Added TradersTable

/**
 * Ensures User, Provider, and Trader records exist for the given email.
 * - Provider is looked-up via GSI "ByEmail".
 * - User is initially scanned by providerId (consider GSI if UserTable grows large).
 * - Trader is looked-up by traderId (which will be the same as userId here).
 * Returns a complete subject for OpenAuth.
 */
async function ensureUserAndTrader(email: string): Promise<{
  userId: string;         // PK of UserTable
  providerId: string;     // PK of ProviderTable
  userAks: string[];      // From UserTable
  providerAk: string;     // From ProviderTable.apiKey
  userAk: string;         // From UserTable.userAk (this will also be TradersTable.userAk)
  traderId: string;       // PK of TradersTable
  walletAddress?: string; // Optional: from TradersTable or UserTable
}> {
  /* ➜ 1. Provider */
  const provRes = await ddbDoc.send(
    new QueryCommand({
      TableName: PROVIDER_TABLE,
      IndexName: "ByEmail",
      KeyConditionExpression: "providerEmail = :e",
      ExpressionAttributeValues: { ":e": email },
      Limit: 1,
    })
  );

  let providerId: string;
  let providerAk: string;

  if (provRes.Items?.length) {
    providerId = provRes.Items[0].providerId as string;
    providerAk = provRes.Items[0].apiKey as string;
  } else {
    providerId = uuidv4().replace(/-/g, "");
    providerAk = uuidv4().replace(/-/g, "");
    await ddbDoc.send(
      new PutCommand({
        TableName: PROVIDER_TABLE,
        Item: { providerId, providerEmail: email, apiKey: providerAk },
      })
    );
  }

  /* ➜ 2. User */
  // Current UserTable scan by providerId. If UserTable becomes large,
  // consider adding a GSI: PK=providerId, SK=userId (or just PK=providerId if one-to-one).
  const userScan = await ddbDoc.send(
    new ScanCommand({
      TableName: USER_TABLE,
      FilterExpression: "providerId = :pid",
      ExpressionAttributeValues: { ":pid": providerId },
      Limit: 1,
    })
  );

  let userId: string;
  let userAks: string[];
  let userAk: string; // This is the key that will be shared with TradersTable.userAk
  let userWalletAddress: string | undefined;

  if (userScan.Items?.length) {
    const u = userScan.Items[0];
    userId = u.userId as string;
    userAks = (u.userAks as string[]) ?? [];
    userAk = u.userAk as string;
    userWalletAddress = u.walletAddress as string | undefined; // Assuming walletAddress might be on UserTable
  } else {
    userId = uuidv4().replace(/-/g, "");
    userAks = [];
    userAk = uuidv4().replace(/-/g, ""); // Generate the primary userAk
    // userWalletAddress will be undefined for a new user initially
    await ddbDoc.send(
      new PutCommand({
        TableName: USER_TABLE,
        Item: {
          userId,
          providerId,
          userAks,
          providerAk, // Storing providerAk on User might be redundant if only linked by providerId
          userAk,
          email, // Store email on UserTable too for convenience
          // walletAddress: undefined, // Explicitly undefined or fetched/set later
        },
      })
    );
  }

  /* ➜ 3. Trader */
  // TradersTable uses traderId as PK. For seamless linking, let's use `userId` as `traderId`.
  // The `userAk` from UserTable will be stored as `TradersTable.userAk` for the GSI.
  const traderIdForTable = userId; // Use the same ID as UserTable.userId for TradersTable.traderId
  const traderUserAkForTable = userAk; // Use UserTable.userAk for TradersTable.userAk attribute

  let traderWalletAddress = userWalletAddress; // Inherit from user if already known

  const traderRes = await ddbDoc.send(
    new GetCommand({
      TableName: TRADERS_TABLE,
      Key: { traderId: traderIdForTable },
    })
  );

  if (!traderRes.Item) {
    console.log(`Creating new TradersTable entry for traderId: ${traderIdForTable}`);
    await ddbDoc.send(
      new PutCommand({
        TableName: TRADERS_TABLE,
        Item: {
          traderId: traderIdForTable,   // PK
          traderAk: traderUserAkForTable, // Attribute for GSI `ByAk`, same as UserTable.userAk
          email: email,                 // Store email for convenience
          status: "ACTIVE",             // Default status
          createdAt: Date.now(),
          // walletAddress: undefined, // Can be updated later via a separate profile/wallet linking flow
          paperPoints: { totalPoints: 0, epoch: 1 } // Initialize paper points if desired
        },
      })
    );
    // If walletAddress was on UserTable, it's already traderWalletAddress.
    // If it needs to be primarily on TradersTable and synced to UserTable or vice-versa,
    // that's a separate consideration. For now, assume it might be on UserTable.
  } else {
    // Trader exists, ensure userAk is up-to-date if it could change (though userAk from UserTable is stable here)
    // And fetch existing walletAddress if not already fetched from UserTable
    if (!traderWalletAddress && traderRes.Item.walletAddress) {
        traderWalletAddress = traderRes.Item.walletAddress as string | undefined;
    }
    // Optionally, update email or other synced fields if necessary
    // await ddbDoc.send(new UpdateCommand({...}));
  }

  return {
    userId,
    providerId,
    userAks,
    providerAk,
    userAk,                 // This is the crucial key for TradersTable GSI
    traderId: traderIdForTable, // This is the PK for TradersTable
    walletAddress: traderWalletAddress,
  };
}

/* Mailer */
const ses = new SESv2Client();
async function sendLoginCode(claims: Record<string, string>, code: string) {
  // ... (mailer logic remains the same) ...
  console.log("Sending login code to", claims.email);
  console.log("Code:", code);
  console.log("Claims:", claims);
  const email = claims.email;
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: `noreply@${Resource.AuthEmail.sender}`,
      Destination: { ToAddresses: [email] },
      Content: {
        Simple: {
          Subject: { Data: "Your cxmpute.cloud login code" },
          Body: {
            Text: {
              Data: `Here is your one-time code: ${code}\n\n` +
                    `If you did not request this, simply ignore the email.`,
            },
          },
        },
      },
    }),
  );
}

/* OpenAuth issuer */
const app = issuer({
  theme: THEME_OPENAUTH,
  subjects,
  storage: MemoryStorage(),
  allow: async () => true,
  providers: {
    code: CodeProvider(CodeUI({ sendCode: sendLoginCode })),
  },
  success: async (ctx, value) => {
    if (value.provider !== "code") throw new Error("Invalid provider");

    const {
      userId,
      providerId,
      userAks,
      providerAk,
      userAk, // This is the key used for traderAk in the subject
      traderId,
      walletAddress
    } = await ensureUserAndTrader(value.claims.email);

    return ctx.subject("user", {
      id: userId,         // UserTable PK
      providerId,
      userAks,
      providerAk,
      userAk,             // UserTable general AK
      admin: ADMIN_EMAILS.includes(value.claims.email),
      email: value.claims.email,
      traderId: traderId, // TradersTable PK
      traderAk: userAk,   // AK for trading APIs (same as UserTable.userAk, maps to TradersTable.userAk attribute)
      walletAddress: walletAddress,
    });
  },
});

export const handler = handle(app);