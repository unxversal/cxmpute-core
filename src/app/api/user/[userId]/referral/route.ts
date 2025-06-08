import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { requireAuth } from '@/lib/auth';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    const { referralCode } = await request.json();

    if (!referralCode || typeof referralCode !== 'string') {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      );
    }

    // Verify the user making the request
    const user = await requireAuth();
    if (user.properties.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user already has a referee
    const getUserCommand = new GetCommand({
      TableName: Resource.UserTable.name,
      Key: { userId: userId }
    });

    const userResult = await dynamodb.send(getUserCommand);
    if (!userResult.Item) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (userResult.Item.referredBy) {
      return NextResponse.json(
        { error: 'You have already set a referee' },
        { status: 400 }
      );
    }

    // Verify the referral code exists (should be another user's ID)
    const getRefereeCommand = new GetCommand({
      TableName: Resource.UserTable.name,
      Key: { userId: referralCode }
    });

    const refereeResult = await dynamodb.send(getRefereeCommand);
    if (!refereeResult.Item) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 400 }
      );
    }

    // Prevent self-referral
    if (referralCode === userId) {
      return NextResponse.json(
        { error: 'You cannot refer yourself' },
        { status: 400 }
      );
    }

    // Update user with referral information
    const updateCommand = new UpdateCommand({
      TableName: Resource.UserTable.name,
      Key: { userId: userId },
      UpdateExpression: 'SET referredBy = :referredBy, referralCode = :referralCode',
      ExpressionAttributeValues: {
        ':referredBy': referralCode,
        ':referralCode': userId // User's own referral code is their ID
      }
    });

    await dynamodb.send(updateCommand);

    return NextResponse.json({
      success: true,
      message: 'Referral code applied successfully'
    });

  } catch (error) {
    console.error('Error updating user referral:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 