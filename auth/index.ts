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
  GetCommand,
} from "@aws-sdk/lib-dynamodb"; // DynamoDBDocumentClient already simplifies marshalling

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { Resource } from "sst";
import { subjects } from "./subjects";
import { ADMIN_EMAILS } from "@/lib/privateutils";
import type { TradingMode } from "@/lib/interfaces"; // For TradingMode type

THEME_OPENAUTH.favicon = "https://i.postimg.cc/bNLm9f7T/3.png";
THEME_OPENAUTH.logo = "https://i.postimg.cc/6qhxh1Kv/8.png";
THEME_OPENAUTH.title = "cxmpute.cloud - login";
THEME_OPENAUTH.background = 'black';
THEME_OPENAUTH.primary = 'white';

const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true } // Good practice
});

const PROVIDER_TABLE = Resource.ProviderTable.name;
const USER_TABLE = Resource.UserTable.name;
const TRADERS_TABLE = Resource.TradersTable.name;
const BALANCES_TABLE_NAME = Resource.BalancesTable.name; // <<<< NEW: For initial paper balances

// --- PK Helpers for BalancesTable ---
const pkTraderModeBalance = (traderId: string, mode: TradingMode) => `TRADER#${traderId}#${mode.toUpperCase()}`;
const skAssetBalance = (assetSymbol: string) => `ASSET#${assetSymbol.toUpperCase()}`;
// --- End PK Helpers ---


async function ensureUserAndTrader(email: string): Promise<{
  userId: string;
  providerId: string;
  userAks: string[];
  providerAk: string;
  userAk: string;
  traderId: string;
  walletAddress?: string;
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
    userId = u.userId as string; userAks = (u.userAks as string[]) ?? []; userAk = u.userAk as string;
    userWalletAddress = u.walletAddress as string | undefined;
  } else {
    userId = uuidv4().replace(/-/g, ""); userAks = []; userAk = uuidv4().replace(/-/g, "");
    await ddbDoc.send(new PutCommand({
        TableName: USER_TABLE,
        Item: { userId, providerId, userAks, providerAk, userAk, email },
    }));
  }

  /* ➜ 3. Trader */
  const traderIdForTable = userId; 
  const traderUserAkForTable = userAk;
  let traderWalletAddress = userWalletAddress;

  const traderRes = await ddbDoc.send(new GetCommand({ TableName: TRADERS_TABLE, Key: { traderId: traderIdForTable }}));
  if (!traderRes.Item) {
    console.log(`Creating new TradersTable entry for traderId: ${traderIdForTable}`);
    await ddbDoc.send(new PutCommand({
        TableName: TRADERS_TABLE,
        Item: {
          traderId: traderIdForTable, traderAk: traderUserAkForTable, email: email,
          status: "ACTIVE", createdAt: Date.now(),
          paperPoints: { totalPoints: 0, epoch: 1 },
          lastFaucetClaimPaper: 0, // <<<< NEW: Initialize last faucet claim timestamp
        },
    }));

    // --- Create Initial PAPER Mode Balances ---
    const PAPER_MODE: TradingMode = "PAPER";
    const initialPaperBalances = [
        { asset: "USDC", amount: BigInt("100000000") }, // 100 USDC (6 decimals)
        { asset: "SBTC", amount: BigInt("10000000") },   // 0.1 sBTC (8 decimals)
        { asset: "SETH", amount: BigInt("100000000") },  // 1 sETH (8 decimals)
    ];

    for (const bal of initialPaperBalances) {
        const balancePk = pkTraderModeBalance(traderIdForTable, PAPER_MODE);
        const balanceSk = skAssetBalance(bal.asset);
        try {
            await ddbDoc.send(
                new PutCommand({
                    TableName: BALANCES_TABLE_NAME,
                    Item: {
                        pk: balancePk, sk: balanceSk,
                        asset: bal.asset,
                        balance: bal.amount, // Stored as BigInt/Number
                        pending: BigInt(0),  // Stored as BigInt/Number
                        updatedAt: Date.now(),
                        // mode: PAPER_MODE, // Implicit in PK
                    },
                    ConditionExpression: "attribute_not_exists(pk)" // Ensure it's truly new
                })
            );
            console.log(`Created initial PAPER ${bal.asset} balance for trader ${traderIdForTable}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                console.log(`Initial PAPER ${bal.asset} balance already exists for trader ${traderIdForTable}. Skipping creation.`);
            } else {
                console.error(`Error creating initial PAPER ${bal.asset} balance for ${traderIdForTable}:`, error);
            }
        }
    }
    // --- End Initial PAPER Mode Balances ---

  } else {
    if (!traderWalletAddress && traderRes.Item.walletAddress) {
        traderWalletAddress = traderRes.Item.walletAddress as string | undefined;
    }
    // Ensure lastFaucetClaimPaper exists if old user record
    if (traderRes.Item.lastFaucetClaimPaper === undefined) {
        await ddbDoc.send(new PutCommand({
            TableName: TRADERS_TABLE,
            Item: { ...traderRes.Item, lastFaucetClaimPaper: 0 }
        }));
    }
  }

  return { userId, providerId, userAks, providerAk, userAk, traderId: traderIdForTable, walletAddress: traderWalletAddress };
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
    const { userId, providerId, userAks, providerAk, userAk, traderId, walletAddress } = await ensureUserAndTrader(value.claims.email);
    return ctx.subject("user", {
      id: userId, providerId, userAks, providerAk, userAk,
      admin: ADMIN_EMAILS.includes(value.claims.email),
      email: value.claims.email,
      traderId: traderId, traderAk: userAk, walletAddress: walletAddress,
    });
  },
});

export const handler = handle(app);