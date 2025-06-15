// src/app/api/admin/stage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { requireAdmin } from "@/lib/auth";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = Resource.PricingConfigTable.name;
const CONFIG_ID = "stage";

export async function GET() {
  const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { configId: CONFIG_ID } }));
  const stage = res.Item?.value ?? "testnet";
  return NextResponse.json({ stage });
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const { stage } = await req.json();
  if (!["testnet", "mainnet"].includes(stage)) {
    return NextResponse.json({ error: "invalid stage" }, { status: 400 });
  }
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { configId: CONFIG_ID, value: stage, lastUpdated: Date.now() },
    })
  );
  return NextResponse.json({ success: true });
} 