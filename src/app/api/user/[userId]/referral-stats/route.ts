import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { requireAuth } from '@/lib/auth';
import { ReferralRewardEntry } from '@/lib/interfaces';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // Verify the user making the request
    const user = await requireAuth();
    if (user.properties.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user record with referral data
    const getUserCommand = new GetCommand({
      TableName: Resource.UserTable.name,
      Key: { userId: userId },
      ProjectionExpression: 'usageRewards, totalUsageRewards, referralRewards, totalReferralRewards, referredBy'
    });

    const userResult = await dynamodb.send(getUserCommand);
    if (!userResult.Item) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userRecord = userResult.Item;

    // Get direct referrals count
    let directReferralsCount = 0;
    try {
      const directReferralsResp = await dynamodb.send(new QueryCommand({
        TableName: Resource.UserTable.name,
        IndexName: 'ByReferredBy',
        KeyConditionExpression: 'referredBy = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        Select: 'COUNT'
      }));
      directReferralsCount = directReferralsResp.Count || 0;
    } catch (error) {
      console.warn('Failed to fetch direct referrals count:', error);
    }

    // Get secondary referrals count (referrals of direct referrals)
    let secondaryReferralsCount = 0;
    if (directReferralsCount > 0) {
      try {
        const directReferralsResp = await dynamodb.send(new QueryCommand({
          TableName: Resource.UserTable.name,
          IndexName: 'ByReferredBy',
          KeyConditionExpression: 'referredBy = :userId',
          ExpressionAttributeValues: { ':userId': userId },
          ProjectionExpression: 'userId'
        }));

        if (directReferralsResp.Items) {
          for (const directReferral of directReferralsResp.Items) {
            const secondaryResp = await dynamodb.send(new QueryCommand({
              TableName: Resource.UserTable.name,
              IndexName: 'ByReferredBy',
              KeyConditionExpression: 'referredBy = :directUserId',
              ExpressionAttributeValues: { ':directUserId': directReferral.userId },
              Select: 'COUNT'
            }));
            secondaryReferralsCount += secondaryResp.Count || 0;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch secondary referrals count:', error);
      }
    }

    // Calculate referral rewards breakdown
    const referralRewards = userRecord.referralRewards || [];
    const rewardsByType = {
      direct: 0,
      primary: 0,
      secondary: 0,
      tertiary: 0
    };

    referralRewards.forEach((reward: ReferralRewardEntry) => {
      if (reward.type in rewardsByType) {
        rewardsByType[reward.type as keyof typeof rewardsByType] += reward.amount;
      }
    });

    // Build response
    const stats = {
      // Usage rewards
      totalUsageRewards: userRecord.totalUsageRewards || 0,
      usageRewards: userRecord.usageRewards || [],
      
      // Referral network
      directReferrals: directReferralsCount,
      secondaryReferrals: secondaryReferralsCount,
      
      // Referral rewards earned
      totalReferralRewards: userRecord.totalReferralRewards || 0,
      referralRewardsByType: rewardsByType,
      referralRewards: referralRewards,
      
      // Who referred this user
      referredBy: userRecord.referredBy || null,
      
      // Summary
      totalEarnings: (userRecord.totalUsageRewards || 0) + (userRecord.totalReferralRewards || 0)
    };

    return NextResponse.json(stats, { status: 200 });

  } catch (error) {
    console.error('Error fetching user referral stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 