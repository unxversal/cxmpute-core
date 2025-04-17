/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/providers/signup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { ProviderRecord } from "@/lib/interfaces";
import { v4 as uuidv4 } from "uuid";

/****************** 1) CREATE THE DOC CLIENT  **************************/
const rawClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawClient);

export async function POST(req: NextRequest) {
  try {
    // 1) Parse input
    const { email, walletAddress, walletChain } = (await req.json()) || {};

    // 2) Validate
    if (!email || !walletAddress || !walletChain) {
      return NextResponse.json(
        { error: "Missing required fields: email, walletAddress, walletChain" },
        { status: 400 }
      );
    }

    // 3) Check for existing provider with same email
    const existing = await docClient.send(
      new QueryCommand({
        TableName: Resource.ProviderTable.name,
        IndexName: "ByEmail",
        KeyConditionExpression: "providerEmail = :e",
        ExpressionAttributeValues: { ":e": email },
        Limit: 1,
      })
    );
    if (existing.Items && existing.Items.length > 0) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // 4) Generate IDs
    const providerId = uuidv4().replace(/-/g, "");
    const providerAk = uuidv4().replace(/-/g, "");

    // 5) Build the new provider record
    const newProvider: ProviderRecord = {
      providerId,
      providerEmail: email,
      apiKey: providerAk,
      providerWalletAddress: walletAddress,
      rewards: [],
      totalRewards: 0,
    };

    // 6) Insert into the table
    await docClient.send(
      new PutCommand({
        TableName: Resource.ProviderTable.name,
        Item: newProvider,
      })
    );

    // 7) Return the newly created IDs
    return NextResponse.json(
      { providerId, apiKey: providerAk },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error in /providers/signup route:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}