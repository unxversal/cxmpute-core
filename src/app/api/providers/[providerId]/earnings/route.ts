/* eslint-disable @typescript-eslint/no-explicit-any */
// GET /api/providers/{providerId}/earnings
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const raw = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(raw);

// Helper to get YYYY-MM-DD strings
function getDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().split("T")[0];
}

export async function GET(
  req: NextRequest,
  { params }: { params: { providerId: string } }
) {
  const { providerId } = params;
  if (!providerId) {
    return NextResponse.json({ error: "Missing providerId" }, { status: 400 });
  }

  try {
    const resp = await docClient.send(
      new GetCommand({
        TableName: Resource.ProviderTable.name,
        Key: { providerId },
      })
    );
    if (!resp.Item) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // Total earnings so far
    const total = resp.Item.totalRewards ?? 0;

    // Build past 30 days earnings array
    const list = resp.Item.rewards || [];
    const earnings = Array.from({ length: 30 }).map((_, i) => {
      const day = getDateStr(i);
      const entry = list.find((r: any) => r.day === day);
      return { day, amount: entry?.amount ?? 0 };
    }).reverse();

    return NextResponse.json({ total, earnings }, { status: 200 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}