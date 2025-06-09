import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { requireAuth } from '@/lib/auth';
import { ReferralRewardEntry } from '@/lib/interfaces';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  try {
    const { providerId } = await params;

    // Verify the user making the request
    const user = await requireAuth();
    if (user.properties.providerId !== providerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get provider record with referral data
    const getProviderCommand = new GetCommand({
      TableName: Resource.ProviderTable.name,
      Key: { providerId: providerId },
      ProjectionExpression: 'rewards, totalRewards, referralRewards, totalReferralRewards, referredBy'
    });

    const providerResult = await dynamodb.send(getProviderCommand);
    if (!providerResult.Item) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    const providerRecord = providerResult.Item;

    // Get direct referrals count
    let directReferralsCount = 0;
    try {
      const directReferralsResp = await dynamodb.send(new QueryCommand({
        TableName: Resource.ProviderTable.name,
        IndexName: 'ByReferredBy',
        KeyConditionExpression: 'referredBy = :providerId',
        ExpressionAttributeValues: { ':providerId': providerId },
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
          TableName: Resource.ProviderTable.name,
          IndexName: 'ByReferredBy',
          KeyConditionExpression: 'referredBy = :providerId',
          ExpressionAttributeValues: { ':providerId': providerId },
          ProjectionExpression: 'providerId'
        }));

        if (directReferralsResp.Items) {
          for (const directReferral of directReferralsResp.Items) {
            const secondaryResp = await dynamodb.send(new QueryCommand({
              TableName: Resource.ProviderTable.name,
              IndexName: 'ByReferredBy',
              KeyConditionExpression: 'referredBy = :directProviderId',
              ExpressionAttributeValues: { ':directProviderId': directReferral.providerId },
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
    const referralRewards = providerRecord.referralRewards || [];
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
      // Compute earnings (existing provider rewards)
      totalComputeRewards: providerRecord.totalRewards || 0,
      computeRewards: providerRecord.rewards || [],
      
      // Referral network
      directReferrals: directReferralsCount,
      secondaryReferrals: secondaryReferralsCount,
      
      // Referral rewards earned
      totalReferralRewards: providerRecord.totalReferralRewards || 0,
      referralRewardsByType: rewardsByType,
      referralRewards: referralRewards,
      
      // Who referred this provider
      referredBy: providerRecord.referredBy || null,
      
      // Summary
      totalEarnings: (providerRecord.totalRewards || 0) + (providerRecord.totalReferralRewards || 0)
    };

    return NextResponse.json(stats, { status: 200 });

  } catch (error) {
    console.error('Error fetching provider referral stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 