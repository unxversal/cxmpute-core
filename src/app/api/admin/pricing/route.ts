import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '@/lib/auth';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// GET - Fetch current pricing configuration
export async function GET() {
  try {
    await requireAdmin();

    const scanCommand = new ScanCommand({
      TableName: Resource.PricingConfigTable.name
    });

    const result = await dynamodb.send(scanCommand);

    // Sort by endpoint and model
    const configs = (result.Items || []).sort((a, b) => {
      if (a.endpoint !== b.endpoint) {
        return a.endpoint.localeCompare(b.endpoint);
      }
      return (a.model || '').localeCompare(b.model || '');
    });

    return NextResponse.json({
      configs,
      count: configs.length,
      isInitialized: configs.length > 0
    });

  } catch (error) {
    console.error('Error fetching pricing config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Update or create pricing configuration
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    
    const { endpoint, model, basePrice, markup, currency, unit, adminId } = await request.json();
    
    if (!endpoint || basePrice === undefined || markup === undefined || !currency || !unit || !adminId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate values
    if (basePrice < 0 || markup < 0) {
      return NextResponse.json(
        { error: 'Prices and markup must be non-negative' },
        { status: 400 }
      );
    }

    const configId = `${endpoint}${model ? `#${model}` : ''}`;
    const now = new Date().toISOString();
    
    // Calculate final price
    const finalPrice = basePrice * (1 + markup / 100);

    const config = {
      configId,
      endpoint,
      model: model || null,
      basePrice: Number(basePrice),
      markup: Number(markup),
      finalPrice: Number(finalPrice.toFixed(6)),
      currency,
      unit,
      updatedDate: now,
      updatedBy: adminId
    };

    const putCommand = new PutCommand({
      TableName: Resource.PricingConfigTable.name,
      Item: config
    });

    await dynamodb.send(putCommand);

    console.log(`Admin ${admin.properties.email} updated pricing for ${endpoint}${model ? ` (${model})` : ''}`);

    return NextResponse.json({
      success: true,
      message: 'Pricing configuration updated successfully',
      config
    });

  } catch (error) {
    console.error('Error updating pricing config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Initialize default pricing for all endpoints
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    
    const { adminId } = await request.json();
    
    if (!adminId) {
      return NextResponse.json(
        { error: 'Admin ID required' },
        { status: 400 }
      );
    }

    // Default pricing configuration
    const defaultConfigs = [
      { endpoint: '/chat/completions', basePrice: 0.002, markup: 20, currency: 'USD', unit: 'per 1K tokens' },
      { endpoint: '/embeddings', basePrice: 0.0001, markup: 20, currency: 'USD', unit: 'per 1K tokens' },
      { endpoint: '/tts', basePrice: 0.015, markup: 25, currency: 'USD', unit: 'per 1K characters' },
      { endpoint: '/scrape', basePrice: 0.01, markup: 30, currency: 'USD', unit: 'per request' },
      { endpoint: '/image', basePrice: 0.04, markup: 25, currency: 'USD', unit: 'per image' },
      { endpoint: '/video', basePrice: 0.12, markup: 30, currency: 'USD', unit: 'per video' },
      { endpoint: '/m', basePrice: 0.01, markup: 20, currency: 'USD', unit: 'per request' }
    ];

    const now = new Date().toISOString();
    const putPromises = defaultConfigs.map(config => {
      const configId = config.endpoint;
      const finalPrice = config.basePrice * (1 + config.markup / 100);
      
      return dynamodb.send(new PutCommand({
        TableName: Resource.PricingConfigTable.name,
        Item: {
          configId,
          endpoint: config.endpoint,
          model: null,
          basePrice: config.basePrice,
          markup: config.markup,
          finalPrice: Number(finalPrice.toFixed(6)),
          currency: config.currency,
          unit: config.unit,
          updatedDate: now,
          updatedBy: adminId
        }
      }));
    });

    await Promise.all(putPromises);

    console.log(`Admin ${admin.properties.email} initialized default pricing configuration`);

    return NextResponse.json({
      success: true,
      message: 'Default pricing configuration initialized successfully',
      configsCreated: defaultConfigs.length
    });

  } catch (error) {
    console.error('Error initializing pricing config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 