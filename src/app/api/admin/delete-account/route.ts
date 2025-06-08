import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '@/lib/auth';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function DELETE(request: NextRequest) {
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

    // Verify account exists before deletion
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

    const deletionTasks = [];

    // Delete the main account
    deletionTasks.push(
      dynamodb.send(new DeleteCommand({
        TableName: tableName,
        Key: { [keyField]: accountId }
      }))
    );

    // Delete suspended account record if exists
    deletionTasks.push(
      dynamodb.send(new DeleteCommand({
        TableName: Resource.SuspendedAccountsTable.name,
        Key: { accountId }
      }))
    );

    // For providers, also clean up provisions
    if (accountType === 'provider') {
      try {
        // Get all provisions for this provider
        const provisionsCommand = new QueryCommand({
          TableName: Resource.ProvisionsTable.name,
          IndexName: 'ByProviderId',
          KeyConditionExpression: 'providerId = :providerId',
          ExpressionAttributeValues: {
            ':providerId': accountId
          }
        });

        const provisionsResult = await dynamodb.send(provisionsCommand);
        
        // Delete each provision
        if (provisionsResult.Items) {
          for (const provision of provisionsResult.Items) {
            deletionTasks.push(
              dynamodb.send(new DeleteCommand({
                TableName: Resource.ProvisionsTable.name,
                Key: { provisionId: provision.provisionId }
              }))
            );

            // Remove from provision pools
            const poolTables = [
              Resource.LLMProvisionPoolTable.name,
              Resource.EmbeddingsProvisionPoolTable.name,
              Resource.ScrapingProvisionPoolTable.name,
              Resource.TTSProvisionPoolTable.name
            ];

            for (const poolTable of poolTables) {
              deletionTasks.push(
                dynamodb.send(new DeleteCommand({
                  TableName: poolTable,
                  Key: { provisionId: provision.provisionId }
                })).catch(() => {
                  // Ignore errors if provision not in this pool
                })
              );
            }
          }
        }
      } catch (error) {
        console.warn('Error cleaning up provisions:', error);
      }
    }

    // Execute all deletions
    await Promise.allSettled(deletionTasks);

    console.log(`Admin ${admin.properties.email} deleted ${accountType} account: ${accountId}`);

    return NextResponse.json({
      success: true,
      message: `${accountType} account and all associated data deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 