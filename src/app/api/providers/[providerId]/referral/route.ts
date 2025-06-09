import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { requireAuth } from '@/lib/auth';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  try {
    const { providerId } = await params;
    const { referralCode } = await request.json();

    if (!referralCode || typeof referralCode !== 'string') {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      );
    }

    // Verify the user making the request
    const user = await requireAuth();
    if (user.properties.providerId !== providerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if provider already has a referee
    const getProviderCommand = new GetCommand({
      TableName: Resource.ProviderTable.name,
      Key: { providerId: providerId }
    });

    const providerResult = await dynamodb.send(getProviderCommand);
    if (!providerResult.Item) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    if (providerResult.Item.referredBy) {
      return NextResponse.json(
        { error: 'You have already set a referee' },
        { status: 400 }
      );
    }

    // Verify the referral code exists (should be another provider's ID)
    const getRefereeCommand = new GetCommand({
      TableName: Resource.ProviderTable.name,
      Key: { providerId: referralCode }
    });

    const refereeResult = await dynamodb.send(getRefereeCommand);
    if (!refereeResult.Item) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 400 }
      );
    }

    // Prevent self-referral
    if (referralCode === providerId) {
      return NextResponse.json(
        { error: 'You cannot refer yourself' },
        { status: 400 }
      );
    }

    // Update provider with referral information
    const updateCommand = new UpdateCommand({
      TableName: Resource.ProviderTable.name,
      Key: { providerId: providerId },
      UpdateExpression: 'SET referredBy = :referredBy, referralCode = :referralCode',
      ExpressionAttributeValues: {
        ':referredBy': referralCode,
        ':referralCode': providerId // Provider's own referral code is their ID
      }
    });

    await dynamodb.send(updateCommand);

    // Add direct referral bonus to the referrer
    try {
      const { addDirectReferralBonus } = await import('@/lib/referralRewards');
      await addDirectReferralBonus(referralCode, 'provider', dynamodb);
    } catch (error) {
      console.error('Error adding direct referral bonus:', error);
      // Don't fail the main operation if bonus fails
    }

    return NextResponse.json({
      success: true,
      message: 'Referral code applied successfully'
    });

  } catch (error) {
    console.error('Error updating provider referral:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 