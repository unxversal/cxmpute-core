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
  ScanCommand,
  // GetCommand, // No longer needed for TradersTable
} from "@aws-sdk/lib-dynamodb"; // DynamoDBDocumentClient already simplifies marshalling

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { Resource } from "sst";
import { subjects } from "./subjects";
import { ADMIN_EMAILS } from "@/lib/privateutils";
// import type { TradingMode } from "@/lib/interfaces"; // TradingMode no longer needed here

THEME_OPENAUTH.favicon = "https://i.postimg.cc/bNLm9f7T/3.png";
THEME_OPENAUTH.logo = "https://i.postimg.cc/6qhxh1Kv/8.png";
THEME_OPENAUTH.title = "cxmpute.cloud - login";
THEME_OPENAUTH.background = 'black';
THEME_OPENAUTH.primary = 'white';

const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true }
});

const PROVIDER_TABLE = Resource.ProviderTable.name;
const USER_TABLE = Resource.UserTable.name;
// TRADERS_TABLE and BALANCES_TABLE_NAME removed

// PK Helpers for BalancesTable removed

async function ensureUser(email: string): Promise<{ // Renamed and return type updated
  userId: string;
  providerId: string;
  userAks: string[];
  providerAk: string;
  userAk: string;
  walletAddress?: string; // Kept as potentially general
}> {
  /* ➜ 1. Provider */
  const provRes = await ddbDoc.send(
    new QueryCommand({
      TableName: PROVIDER_TABLE, IndexName: "ByEmail",
      KeyConditionExpression: "providerEmail = :e",
      ExpressionAttributeValues: { ":e": email }, Limit: 1,
    })
  );
  let providerId: string, providerAk: string;
  if (provRes.Items?.length) {
    providerId = provRes.Items[0].providerId as string;
    providerAk = provRes.Items[0].apiKey as string;
  } else {
    providerId = uuidv4().replace(/-/g, "");
    providerAk = uuidv4().replace(/-/g, "");
    await ddbDoc.send(new PutCommand({ TableName: PROVIDER_TABLE, Item: { providerId, providerEmail: email, apiKey: providerAk }}));
  }

  /* ➜ 2. User */
  const userScan = await ddbDoc.send(
    new ScanCommand({
      TableName: USER_TABLE, FilterExpression: "providerId = :pid",
      ExpressionAttributeValues: { ":pid": providerId }, Limit: 1,
    })
  );
  let userId: string, userAks: string[], userAk: string, userWalletAddress: string | undefined;
  if (userScan.Items?.length) {
    const u = userScan.Items[0];
    userId = u.userId as string;
    userAks = (u.userAks as string[]) ?? [];
    userAk = u.userAk as string;
    userWalletAddress = u.walletAddress as string | undefined; // Get wallet address if stored on UserTable
  } else {
    userId = uuidv4().replace(/-/g, "");
    userAks = [];
    userAk = uuidv4().replace(/-/g, "");
    // When creating a new user, walletAddress would be initially undefined unless collected at signup
    await ddbDoc.send(new PutCommand({
        TableName: USER_TABLE,
        Item: { userId, providerId, userAks, providerAk, userAk, email /* walletAddress could be added here if known */ },
    }));
    userWalletAddress = undefined; // Or set if known
  }

  // Section "3. Trader" and initial PAPER balance creation removed.

  return { userId, providerId, userAks, providerAk, userAk, walletAddress: userWalletAddress };
}

/* Mailer */
const ses = new SESv2Client();
async function sendLoginCode(claims: Record<string, string>, code: string) {
  console.log("Sending login code to", claims.email, "Code:", code);
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: `noreply@${Resource.AuthEmail.sender}`,
      Destination: { ToAddresses: [claims.email] },
      Content: {
        Simple: {
          Subject: { Data: "Your cxmpute.cloud login code" },
          Body: { Text: { Data: `Here is your one-time code: ${code}\n\nIf you did not make a login request, you can ignore this email.` } },
        },
      },
    }),
  );
}

/* OpenAuth issuer */
const app = issuer({
  theme: THEME_OPENAUTH, subjects, storage: MemoryStorage(),
  allow: async () => true,
  providers: { code: CodeProvider(CodeUI({ sendCode: sendLoginCode })) },
  success: async (ctx, value) => {
    if (value.provider !== "code") throw new Error("Invalid provider");
    // ensureUser now returns an object without traderId
    const { userId, providerId, userAks, providerAk, userAk, walletAddress } = await ensureUser(value.claims.email);
    
    // Subject no longer includes traderId, traderAk
    return ctx.subject("user", {
      id: userId,
      providerId,
      userAks,
      providerAk,
      userAk,
      admin: ADMIN_EMAILS.includes(value.claims.email),
      email: value.claims.email,
      walletAddress: walletAddress, // Kept for now
    });
  },
});

// The `link` array for `sst.aws.Auth` is in sst.config.ts.
// This `auth/index.ts` just defines the handler.
// Ensure `TradersTable` and `BalancesTable` are removed from the link array in `sst.config.ts`
// for the `CxmputeAuth` resource.
export const handler = handle(app);