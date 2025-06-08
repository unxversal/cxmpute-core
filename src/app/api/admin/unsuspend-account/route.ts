import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '@/lib/auth';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const admin = await requireAdmin();
    
    const { accountId, accountType, adminId } = await request.json();
    
    if (!accountId || !accountType || !adminId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['user', 'provider'].includes(accountType)) {
      return NextResponse.json(
        { error: 'Invalid account type' },
        { status: 400 }
      );
    }

    // Check if account is suspended
    const getSuspendedCommand = new GetCommand({
      TableName: Resource.SuspendedAccountsTable.name,
      Key: { accountId }
    });

    const suspendedResult = await dynamodb.send(getSuspendedCommand);
    if (!suspendedResult.Item || !suspendedResult.Item.isActive) {
      return NextResponse.json(
        { error: 'Account is not currently suspended' },
        { status: 400 }
      );
    }

    // Update suspension record to inactive
    const updateSuspensionCommand = new UpdateCommand({
      TableName: Resource.SuspendedAccountsTable.name,
      Key: { accountId },
      UpdateExpression: 'SET isActive = :inactive, unsuspendedBy = :adminId, unsuspendedDate = :date',
      ExpressionAttributeValues: {
        ':inactive': false,
        ':adminId': adminId,
        ':date': new Date().toISOString()
      }
    });

    await dynamodb.send(updateSuspensionCommand);

    console.log(`Admin ${admin.properties.email} unsuspended ${accountType} account: ${accountId}`);

    return NextResponse.json({
      success: true,
      message: `${accountType} account unsuspended successfully`
    });

  } catch (error) {
    console.error('Error unsuspending account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 