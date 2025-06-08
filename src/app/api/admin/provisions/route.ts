import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '@/lib/auth';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function GET(_request: NextRequest) {
  try {
    await requireAdmin();

    // Get all provisions
    const provisionsCommand = new ScanCommand({
      TableName: Resource.ProvisionsTable.name
    });

    const provisionsResult = await dynamodb.send(provisionsCommand);
    const provisions = provisionsResult.Items || [];

    // Enhance with provider information
    const enhancedProvisions = await Promise.all(
      provisions.map(async (provision) => {
        let providerEmail = 'Unknown';
        
        // Try to get provider email from ProviderTable
        try {
          const providerCommand = new GetCommand({
            TableName: Resource.ProviderTable.name,
            Key: { providerId: provision.providerId }
          });
          
          const providerResult = await dynamodb.send(providerCommand);
          if (providerResult.Item) {
            providerEmail = providerResult.Item.providerEmail || provision.providerId;
          }
        } catch {
          console.warn('Could not fetch provider info for:', provision.providerId);
        }

        // Determine provision status (simplified - could be enhanced with health checks)
        const status = provision.lastHeartbeat 
          ? (new Date().getTime() - new Date(provision.lastHeartbeat).getTime() < 5 * 60 * 1000 ? 'online' : 'offline')
          : 'unknown';

        return {
          ...provision,
          providerEmail,
          status,
          services: provision.services || [],
          tier: provision.tier || 'Unknown'
        };
      })
    );

    // Sort by most recent first
    enhancedProvisions.sort((a, b) => 
      new Date((b as any).createdDate || 0).getTime() - new Date((a as any).createdDate || 0).getTime()
    );

    return NextResponse.json({
      provisions: enhancedProvisions,
      count: enhancedProvisions.length
    });

  } catch (error) {
    console.error('Error fetching provisions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 