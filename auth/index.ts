import { handle } from "hono/aws-lambda";
import { issuer } from "@openauthjs/openauth";
import { CodeProvider } from "@openauthjs/openauth/provider/code";
import { CodeUI } from "@openauthjs/openauth/ui/code";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { v4 as uuidv4 } from "uuid";
import { THEME_OPENAUTH } from "@openauthjs/openauth/ui/theme"

import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";

import { Resource } from "sst";
import { subjects } from "./subjects";
import { adminEmails } from "@/lib/privateutils";

THEME_OPENAUTH.favicon = "https://i.postimg.cc/bNLm9f7T/3.png"
THEME_OPENAUTH.logo = "https://i.postimg.cc/6qhxh1Kv/8.png"
// THEME_OPENAUTH.logo = "https://i.postimg.cc/yNdZ0wFw/6.png"
THEME_OPENAUTH.title = "cxmpute.cloud - login"
THEME_OPENAUTH.background = 'white'
THEME_OPENAUTH.primary = 'black'



/* ——————————————————————————————————— */
/* Dynamo helpers                                                           */
/* ——————————————————————————————————— */

const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const PROVIDER_TABLE = Resource.ProviderTable.name;
const USER_TABLE     = Resource.UserTable.name;

/**
 * Find (or create) Provider & User rows for the given e-mail.
 * - Provider is looked-up via the GSI  “ByEmail”.
 * - User is scanned by providerId (tiny data-set → acceptable; add GSI if it grows).
 * Returns a complete subject for OpenAuth.
 */
async function ensureUser(email: string): Promise<{
  userId: string;
  providerId: string;
  userAks: string[];
  providerAk: string;
  userAk: string;
  }> {
  /* ➜ 1. Provider */
  const provRes = await ddbDoc.send(
    new QueryCommand({
      TableName: PROVIDER_TABLE,
      IndexName: "ByEmail",
      KeyConditionExpression: "providerEmail = :e",
      ExpressionAttributeValues: { ":e": email },
      Limit: 1,
    }),
  );

  let providerId: string;
  let providerAk: string;

  if (provRes.Items?.length) {
    providerId = provRes.Items[0].providerId as string;
    providerAk = provRes.Items[0].apiKey     as string;
  } else {
    providerId = uuidv4().replace(/-/g, "");
    providerAk = uuidv4().replace(/-/g, "");

    await ddbDoc.send(
      new PutCommand({
        TableName: PROVIDER_TABLE,
        Item: {
          providerId,
          providerEmail: email,
          apiKey: providerAk,
        },
      }),
    );
  }

  /* ➜ 2. User */
  const userScan = await ddbDoc.send(
    new ScanCommand({
      TableName: USER_TABLE,
      FilterExpression: "providerId = :pid",
      ExpressionAttributeValues: { ":pid": providerId },
      Limit: 1,
    }),
  );

  let userId: string;
  let userAks: string[];
  let userAk: string;

  if (userScan.Items?.length) {
    const u = userScan.Items[0];
    userId  = u.userId  as string;
    userAks = (u.userAks as string[]) ?? [];
    userAk = u.userAk as string;
  } else {
    userId  = uuidv4().replace(/-/g, "");
    userAks = [];
    userAk  = uuidv4().replace(/-/g, "");

    await ddbDoc.send(
      new PutCommand({
        TableName: USER_TABLE,
        Item: {
          userId,
          providerId,
          userAks,
          providerAk,
          userAk,
        },
      }),
    );
  }

  return { userId, providerId, userAks, providerAk, userAk };
}

/* ——————————————————————————————————— */
/* Mailer – uses the linked SES identity                                    */
/* ——————————————————————————————————— */

const ses = new SESv2Client();

async function sendLoginCode(claims: Record<string, string>, code: string) {
  console.log("Sending login code to", claims.email);
  console.log("Code:", code);
  console.log("Claims:", claims);
  const email = claims.email;
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: Resource.AuthEmail.sender,
      Destination: { ToAddresses: [email] },
      Content: {
        Simple: {
          Subject: { Data: "Your Cxmpute login code" },
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

/* ——————————————————————————————————— */
/* OpenAuth issuer                                                          */
/* ——————————————————————————————————— */

const app = issuer({
  theme: THEME_OPENAUTH,
  subjects,
  storage: MemoryStorage(),

  // dev-only; lock this down in prod
  allow: async () => true,

  providers: {
    code: CodeProvider(
      CodeUI({
        sendCode: sendLoginCode,
      }),
    ),
  },

  success: async (ctx, value) => {
    if (value.provider !== "code") throw new Error("Invalid provider");

    const { userId, providerId, userAks, providerAk, userAk } =
      await ensureUser(value.claims.email);

    return ctx.subject("user", {
      id:          userId,
      providerId,
      userAks,
      providerAk,
      userAk,
      admin: adminEmails.includes(value.claims.email),
    });
  },
});

/* Lambda entry-point for SST */
export const handler = handle(app);