/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/v1/wallet/link/route.ts

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { ProviderRecord, UserRecord } from "@/lib/interfaces";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      accountType, // "user" | "provider"
      accountId,   // userId or providerId
      walletAddress,
      signature,   // signature of accountId using walletAddress to prove ownership (optional for now)
    } = body || {};

    if (!accountType || !accountId || !walletAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    // TODO: verify signature if provided

    if (accountType === "provider") {
      const resp = await ddb.send(
        new GetCommand({ TableName: Resource.ProviderTable.name, Key: { providerId: accountId } })
      );
      if (!resp.Item) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
      const provider = resp.Item as ProviderRecord;
      const updated: ProviderRecord & { walletAddress: string; walletLinked: string } = {
        ...provider,
        walletAddress,
        walletLinked: "true",
      } as any;
      await ddb.send(
        new PutCommand({ TableName: Resource.ProviderTable.name, Item: updated })
      );
      return NextResponse.json({ success: true });
    }

    if (accountType === "user") {
      const resp = await ddb.send(
        new GetCommand({ TableName: Resource.UserTable.name, Key: { userId: accountId } })
      );
      if (!resp.Item) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const user = resp.Item as UserRecord;
      const updated: UserRecord & { walletAddress: string; walletLinked: string } = {
        ...user,
        walletAddress,
        walletLinked: "true",
      } as any;
      await ddb.send(
        new PutCommand({ TableName: Resource.UserTable.name, Item: updated })
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid accountType" }, { status: 400 });
  } catch (err: any) {
    console.error("/wallet/link error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
} 