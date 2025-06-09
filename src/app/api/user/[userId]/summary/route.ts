import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const raw = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(raw);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

  const res = await doc.send(
    new GetCommand({
      TableName: Resource.UserTable.name,
      Key: { userId },
    }),
  );

  if (!res.Item)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json(
    {
      apiKeys: res.Item.apiKeys ?? [],
      credits: res.Item.credits ?? 0,
      rewards: res.Item.totalRewards ?? 0,
      // NEW: Usage and referral rewards
      usageRewards: res.Item.totalUsageRewards ?? 0,
      referralRewards: res.Item.totalReferralRewards ?? 0,
      totalEarnings: (res.Item.totalUsageRewards ?? 0) + (res.Item.totalReferralRewards ?? 0),
      referredBy: res.Item.referredBy ?? null,
      referralCode: res.Item.referralCode ?? res.Item.userId, // Default to userId if not set
    },
    { status: 200 },
  );
}