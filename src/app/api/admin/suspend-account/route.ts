import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const admin = await requireAdmin();
    
    const { accountId, accountType, reason, adminId } = await request.json();
    
    if (!accountId || !accountType || !reason || !adminId) {
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

    // Verify account exists
    const tableName = accountType === 'user' ? Resource.UserTable.name : Resource.ProviderTable.name;
    const keyField = accountType === 'user' ? 'userId' : 'providerId';
    
    const getAccountCommand = new GetCommand({
      TableName: tableName,
      Key: { [keyField]: accountId }
    });

    const accountResult = await dynamodb.send(getAccountCommand);
    if (!accountResult.Item) {
      return NextResponse.json(
        { error: `${accountType} account not found` },
        { status: 404 }
      );
    }

    // Check if account is already suspended
    const getSuspendedCommand = new GetCommand({
      TableName: Resource.SuspendedAccountsTable.name,
      Key: { accountId }
    });

    const suspendedResult = await dynamodb.send(getSuspendedCommand);
    if (suspendedResult.Item && suspendedResult.Item.isActive) {
      return NextResponse.json(
        { error: 'Account is already suspended' },
        { status: 400 }
      );
    }

    // Create suspension record
    const suspensionId = uuidv4();
    const suspendedDate = new Date().toISOString();
    
    const putSuspensionCommand = new PutCommand({
      TableName: Resource.SuspendedAccountsTable.name,
      Item: {
        accountId,
        accountType,
        suspendedDate,
        suspendedBy: adminId,
        reason: reason.trim(),
        isActive: true,
        suspensionId
      }
    });

    await dynamodb.send(putSuspensionCommand);

    console.log(`Admin ${admin.properties.email} suspended ${accountType} account: ${accountId}`);

    return NextResponse.json({
      success: true,
      message: `${accountType} account suspended successfully`,
      suspensionId
    });

  } catch (error) {
    console.error('Error suspending account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 