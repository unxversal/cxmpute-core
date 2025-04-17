/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/providers/signup/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { ProviderRecord } from "@/lib/interfaces";

import { randomBytes } from "crypto";

/****************** 1) CREATE THE DOC CLIENT  **************************/
const rawClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawClient);

/**
 * Simple function to generate a random provider ID – you can use a UUID library if you prefer.
 * This is a minimal approach using Node's crypto.
 */
function generateProviderId(): string {
  // 16 random bytes => 32 hex characters
  return randomBytes(16).toString("hex");
}

/**
 * Generate provider's API key
 */
function generateApiKey(): string {
  // 24 random bytes => 48 hex characters
  return randomBytes(24).toString("hex");
}

export async function POST(req: NextRequest) {
  try {
    // 1) Parse input
    const body = await req.json();
    const { email, walletAddress, walletChain } = body || {};

    // Validate
    if (!email || !walletAddress || !walletChain) {
      return NextResponse.json({
        error: "Missing required fields: email, walletAddress, walletChain"
      }, { status: 400 });
    }

    // 2) Generate IDs
    const providerId = generateProviderId();
    const providerAk = generateApiKey();

    // 3) Build the new provider record
    //    The ProviderRecord interface includes: providerId, providerEmail, apiKey, plus optional wallet, etc.
    //    If you want to store chain info, you can store it in providerWalletAddress or an extra field. 
    //    For example, let's store chain in a field called "chain" if you'd like – or skip it if the table doesn't store it.
    const newProvider: ProviderRecord = {
      providerId,
      providerEmail: email,
      apiKey: providerAk,
      providerWalletAddress: walletAddress,
      // rewards: []  // optional
      // totalRewards: 0  // optional
    };

    // 4) Insert into the table
    await docClient.send(
      new PutCommand({
        TableName: Resource.ProviderTable.name,
        Item: newProvider
      })
    );

    // 5) Return the newly created providerId (and optionally the API key)
    //    If you only want to return providerId, remove the key from the JSON below.
    return NextResponse.json({
      providerId,
      apiKey: providerAk
    }, { status: 200 });

  } catch (err: any) {
    console.error("Error in /providers/signup route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}