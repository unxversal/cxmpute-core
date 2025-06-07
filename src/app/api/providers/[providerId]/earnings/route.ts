/* eslint-disable @typescript-eslint/no-explicit-any */
// GET /api/providers/{providerId}/earnings
import { NextRequest, NextResponse } from "next/server";
import { getProviderRewards } from "@/lib/rewards";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
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

  try {
    // Get current month's rewards
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const currentRewards = await getProviderRewards(providerId, currentMonth);

    // Get past 6 months of rewards for historical data
    const earnings = [];
    let totalPoints = 0;

    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toISOString().slice(0, 7); // YYYY-MM
      
      const monthRewards = await getProviderRewards(providerId, month);
      const points = monthRewards?.totalPoints || 0;
      totalPoints += points;
      
      earnings.unshift({
        day: month + "-01", // Use first day of month for compatibility
        amount: points
      });
    }

    // Get referrals count from ReferralRelationshipsTable
    let referralsCount = 0;
    try {
      // Note: This will work once the new tables are deployed
      // For now, return 0 referrals until deployment
      // const referralsResp = await docClient.send(
      //   new QueryCommand({
      //     TableName: "ReferralRelationshipsTable", // Will be Resource.ReferralRelationshipsTable.name after deployment
      //     IndexName: "ByReferrer",
      //     KeyConditionExpression: "referrerId = :refId AND userType = :userType",
      //     ExpressionAttributeValues: {
      //       ":refId": providerId,
      //       ":userType": "provider"
      //     }
      //   })
      // );
      // referralsCount = referralsResp.Items?.length ?? 0;
      referralsCount = 0; // Default to 0 until tables are deployed
    } catch (error) {
      console.warn("Failed to fetch referrals count:", error);
      // Continue with referralsCount = 0
    }

    // Calculate today's earnings (current month so far)
    const earningsToday = currentRewards?.totalPoints || 0;

    return NextResponse.json({ 
      total: totalPoints, 
      earnings,
      referralsCount,
      earningsToday // Add today's earnings for CLI compatibility
    }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching provider earnings:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}