import { NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '@/lib/auth';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function GET() {
  try {
    // Verify admin access
    await requireAdmin();

    // Get all active suspended accounts
    const scanCommand = new ScanCommand({
      TableName: Resource.SuspendedAccountsTable.name,
      FilterExpression: 'isActive = :active',
      ExpressionAttributeValues: {
        ':active': true
      }
    });

    const result = await dynamodb.send(scanCommand);

    // Sort by most recent suspensions first
    const accounts = (result.Items || []).sort((a, b) => 
      new Date(b.suspendedDate).getTime() - new Date(a.suspendedDate).getTime()
    );

    return NextResponse.json({
      accounts,
      count: accounts.length
    });

  } catch (error) {
    console.error('Error fetching suspended accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 