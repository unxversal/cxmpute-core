/* eslint-disable @typescript-eslint/no-explicit-any */
// GET /api/providers/{providerId}/earnings
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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
  { params }: { params: Promise<{ providerId: string }> }
) {
  const { providerId } = await params;
  if (!providerId) {
    return NextResponse.json({ error: "Missing providerId" }, { status: 400 });
  }

  // Optional: Basic authentication check
  // const authHeader = req.headers.get('authorization');
  // const providerAk = req.headers.get('x-provider-ak');
  // Add authentication logic here if needed

  try {
    // Get provider data
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

    // Get referrals count using the ByReferredBy GSI
    let referralsCount = 0;
    try {
      const referralsResp = await docClient.send(
        new QueryCommand({
          TableName: Resource.ProviderTable.name,
          IndexName: "ByReferredBy",
          KeyConditionExpression: "referredBy = :refId",
          ExpressionAttributeValues: {
            ":refId": providerId
          }
        })
      );
      referralsCount = referralsResp.Items?.length ?? 0;
    } catch (error) {
      console.warn("Failed to fetch referrals count:", error);
      // Continue with referralsCount = 0
    }

    return NextResponse.json({ 
      total, 
      earnings,
      referralsCount,
      referredBy: resp.Item.referredBy ?? null,
      referralCode: resp.Item.referralCode ?? providerId // Default to providerId if not set
    }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching provider earnings:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}