import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '@/lib/auth';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    await requireAdmin();
    
    const { query } = await request.json();
    
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const searchTerm = query.trim().toLowerCase();
    
    // Search users
    const userScanCommand = new ScanCommand({
      TableName: Resource.UserTable.name,
      FilterExpression: 'contains(lower(email), :query) OR contains(lower(userId), :query)',
      ExpressionAttributeValues: {
        ':query': searchTerm
      },
      Limit: 50
    });

    // Search providers
    const providerScanCommand = new ScanCommand({
      TableName: Resource.ProviderTable.name,
      FilterExpression: 'contains(lower(providerEmail), :query) OR contains(lower(providerId), :query)',
      ExpressionAttributeValues: {
        ':query': searchTerm
      },
      Limit: 50
    });

    // Get suspended accounts to mark them in results
    const suspendedScanCommand = new ScanCommand({
      TableName: Resource.SuspendedAccountsTable.name,
      FilterExpression: 'isActive = :active',
      ExpressionAttributeValues: {
        ':active': true
      }
    });

    const [userResults, providerResults, suspendedResults] = await Promise.all([
      dynamodb.send(userScanCommand),
      dynamodb.send(providerScanCommand),
      dynamodb.send(suspendedScanCommand)
    ]);

    const suspendedAccountIds = new Set(
      (suspendedResults.Items || []).map(item => item.accountId)
    );

    // Format results
    const results = [
      ...(userResults.Items || []).map(user => ({
        id: user.userId,
        email: user.email,
        type: 'user' as const,
        isSuspended: suspendedAccountIds.has(user.userId)
      })),
      ...(providerResults.Items || []).map(provider => ({
        id: provider.providerId,
        email: provider.providerEmail,
        type: 'provider' as const,
        isSuspended: suspendedAccountIds.has(provider.providerId)
      }))
    ];

    return NextResponse.json({
      results: results.slice(0, 20) // Limit total results
    });

  } catch (error) {
    console.error('Error searching accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 