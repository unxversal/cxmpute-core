/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/rewards/split/route.ts

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = Resource.PricingConfigTable.name; // reuse table
const CONFIG_ID = "reward-split";

export async function GET() {
  const resp = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { configId: CONFIG_ID } })
  );
  const item = resp.Item ?? { providers: 55, users: 15, protocol: 30 };
  return NextResponse.json(item);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { providers, users, protocol } = body || {};
  if (providers + users + protocol !== 100) {
    return NextResponse.json({ error: "split must sum to 100" }, { status: 400 });
  }
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { configId: CONFIG_ID, providers, users, protocol, lastUpdated: Date.now() },
    })
  );
  return NextResponse.json({ success: true });
} 