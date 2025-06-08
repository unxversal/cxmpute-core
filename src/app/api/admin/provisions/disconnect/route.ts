import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '@/lib/auth';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin();
    const { provisionId, reason } = await request.json();

    if (!provisionId) {
      return NextResponse.json(
        { error: 'Provision ID is required' },
        { status: 400 }
      );
    }

    // Get the provision details first
    const getProvisionCommand = new GetCommand({
      TableName: Resource.ProvisionsTable.name,
      Key: { provisionId }
    });

    const provisionResult = await dynamodb.send(getProvisionCommand);
    
    if (!provisionResult.Item) {
      return NextResponse.json(
        { error: 'Provision not found' },
        { status: 404 }
      );
    }

    const provision = provisionResult.Item;

    // Remove from provision pools
    const poolTables = [
      { table: Resource.LLMProvisionPoolTable.name, key: 'provisionId' },
      { table: Resource.EmbeddingsProvisionPoolTable.name, key: 'provisionId' },
      { table: Resource.ScrapingProvisionPoolTable.name, key: 'provisionId' },
      { table: Resource.TTSProvisionPoolTable.name, key: 'provisionId' }
    ];

    // Remove from all pools in parallel
    const poolDeletions = poolTables.map(async ({ table, key }) => {
      try {
        const deleteCommand = new DeleteCommand({
          TableName: table,
          Key: { [key]: provisionId }
        });
        await dynamodb.send(deleteCommand);
      } catch (error) {
        console.warn(`Failed to remove provision ${provisionId} from ${table}:`, error);
      }
    });

    await Promise.allSettled(poolDeletions);

    // Update provision status to disconnected
    const updateProvisionCommand = new PutCommand({
      TableName: Resource.ProvisionsTable.name,
      Item: {
        ...provision,
        status: 'disconnected',
        disconnectedBy: adminUser.properties.id,
        disconnectedAt: new Date().toISOString(),
        disconnectedReason: reason || 'Admin disconnection',
        lastHeartbeat: null // Clear heartbeat to mark as offline
      }
    });

    await dynamodb.send(updateProvisionCommand);

    return NextResponse.json({
      success: true,
      message: `Provision ${provisionId} has been disconnected`,
      provision: {
        provisionId,
        status: 'disconnected',
        disconnectedBy: adminUser.properties.id,
        disconnectedAt: new Date().toISOString(),
        reason: reason || 'Admin disconnection'
      }
    });

  } catch (error) {
    console.error('Error disconnecting provision:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 