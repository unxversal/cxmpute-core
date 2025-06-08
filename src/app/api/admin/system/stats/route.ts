import { NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '@/lib/auth';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function GET() {
  try {
    // Check admin access
    await requireAdmin();

    // Get counts from all tables
    const [usersRes, providersRes, provisionsRes] = await Promise.all([
      dynamodb.send(new ScanCommand({
        TableName: Resource.UserTable.name,
        Select: 'COUNT'
      })),
      dynamodb.send(new ScanCommand({
        TableName: Resource.ProviderTable.name,
        Select: 'COUNT'
      })),
      dynamodb.send(new ScanCommand({
        TableName: Resource.ProvisionsTable.name,
        Select: 'COUNT'
      }))
    ]);

    // Calculate total earnings (this is a simplified version)
    // In a real scenario, you might want to aggregate from all providers
    let totalEarnings = 0;
    try {
      const providersData = await dynamodb.send(new ScanCommand({
        TableName: Resource.ProviderTable.name
      }));
      
      if (providersData.Items) {
        totalEarnings = providersData.Items.reduce((total, provider) => {
          return total + (provider.totalRewards || 0);
        }, 0);
      }
    } catch (error) {
      console.warn('Failed to calculate total earnings:', error);
    }

    const stats = {
      totalUsers: usersRes.Count || 0,
      totalProviders: providersRes.Count || 0,
      activeProvisions: provisionsRes.Count || 0,
      totalEarnings,
      pendingActions: 0, // Could be implemented based on admin actions queue
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching system stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system statistics' },
      { status: 500 }
    );
  }
} 