/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '@/lib/auth';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
// @ts-ignore typing lag
const TABLE: string = (Resource as any).PricingConfigTable.name;

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

type PaygTier = {
  upto: number; // inclusive upper bound of usage (e.g., 1_000 tokens)
  price: number; // price in CXPT (or USD) per unit for this tier
};

interface PricingPayload {
  configId: string; // always "current"
  endpoint: string; // e.g. "/chat/completions"
  paygTiers?: PaygTier[]; // variable length array
  subscriptionPlans?: {
    planId: number;
    monthlyPrice: number;
    quota: number; // included units
  }[];
}

// ---------------------------------------------------------------------
// GET – return the one row whose configId === "current" (or entire table)
// ---------------------------------------------------------------------

export async function GET(req: NextRequest) {
  await requireAdmin();
  const configId = req.nextUrl.searchParams.get("configId") ?? "current";
  const res = await ddb.send(new ScanCommand({ TableName: TABLE }));
  const items = res.Items ?? [];
  if (configId === "all") {
    return NextResponse.json(items);
  }
  const found = items.find((i: any) => i.configId === configId);
  return NextResponse.json(found ?? {});
}

// ---------------------------------------------------------------------
// POST – upsert tiered pricing config (payg tiers + subscription plans)
// ---------------------------------------------------------------------

export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = (await req.json()) as PricingPayload;
  const { configId, endpoint, paygTiers, subscriptionPlans } = body;
  if (!configId || !endpoint) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        configId,
        endpoint,
        paygTiers: paygTiers ?? [],
        subscriptionPlans: subscriptionPlans ?? [],
        lastUpdated: new Date().toISOString(),
      },
    })
  );
  return NextResponse.json({ success: true });
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
      
      return ddb.send(new PutCommand({
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