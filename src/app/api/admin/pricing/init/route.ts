import { NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '@/lib/auth';
// import { SystemProvisionReference } from '@/lib/privateutils';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function POST() {
  try {
    // Check admin access
    const admin = await requireAdmin();

    // Default pricing records (simplified)
    const pricingRecords = [
      // Chat completions - per token pricing
      {
        endpoint: '/chat/completions',
        model: 'default',
        priceType: 'per-token',
        inputPrice: 0.0001,
        outputPrice: 0.0003,
        basePrice: 0,
        currency: 'USD',
        lastUpdated: new Date().toISOString(),
        updatedBy: admin.properties.email,
        active: true
      },
      // Embeddings - per request pricing
      {
        endpoint: '/embeddings',
        model: 'default',
        priceType: 'per-request',
        inputPrice: 0,
        outputPrice: 0,
        basePrice: 0.001,
        currency: 'USD',
        lastUpdated: new Date().toISOString(),
        updatedBy: admin.properties.email,
        active: true
      },
      // TTS - per minute pricing
      {
        endpoint: '/tts',
        model: 'default',
        priceType: 'per-minute',
        inputPrice: 0,
        outputPrice: 0,
        basePrice: 0.01,
        currency: 'USD',
        lastUpdated: new Date().toISOString(),
        updatedBy: admin.properties.email,
        active: true
      },
      // Other services
      {
        endpoint: '/scrape',
        model: 'default',
        priceType: 'per-request',
        inputPrice: 0,
        outputPrice: 0,
        basePrice: 0.005,
        currency: 'USD',
        lastUpdated: new Date().toISOString(),
        updatedBy: admin.properties.email,
        active: true
      }
    ];

    // Batch write pricing records (DynamoDB limits to 25 items per batch)
    const batchSize = 25;
    let recordsWritten = 0;

    for (let i = 0; i < pricingRecords.length; i += batchSize) {
      const batch = pricingRecords.slice(i, i + batchSize);
      
      const putRequests = batch.map(record => ({
        PutRequest: { Item: record }
      }));

      await dynamodb.send(new BatchWriteCommand({
        RequestItems: {
          // @ts-expect-error - PricingTable will be available after deployment
          [Resource.PricingTable.name]: putRequests
        }
      }));

      recordsWritten += batch.length;
    }

    return NextResponse.json({
      success: true,
      message: `Initialized pricing for ${recordsWritten} service/model combinations`,
      recordsWritten
    });

  } catch (error) {
    console.error('Error initializing pricing:', error);
    return NextResponse.json(
      { error: 'Failed to initialize pricing' },
      { status: 500 }
    );
  }
} 