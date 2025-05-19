/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/prices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import type { PriceSnapshot } from "@/lib/interfaces";

// Initialize DynamoDB Document Client
const rawDdbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawDdbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const PRICES_TABLE_NAME = Resource.PricesTable.name;

// PK helper for PricesTable
const pkPriceAsset = (assetSymbol: string) => `ASSET#${assetSymbol.toUpperCase()}`;

/**
 * Handles CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type", // Adjust if other headers are sent by client
    },
  });
}

/**
 * GET /api/prices
 * Fetches the latest price snapshot for a given asset.
 * Query Parameters:
 *   - asset: string (e.g., "BTC", "ETH") - Required. The symbol of the asset.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  try {
    const assetSymbolParam = url.searchParams.get("asset");

    // --- Validation ---
    if (!assetSymbolParam || typeof assetSymbolParam !== 'string' || assetSymbolParam.trim() === '') {
      return NextResponse.json(
        { error: "Query parameter 'asset' (e.g., BTC, ETH) is required." },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }
    // --- End Validation ---

    const assetSymbol = assetSymbolParam.trim().toUpperCase();
    const priceTablePk = pkPriceAsset(assetSymbol);

    const queryInput: QueryCommandInput = {
      TableName: PRICES_TABLE_NAME,
      KeyConditionExpression: "pk = :pkVal",
      ExpressionAttributeValues: {
        ":pkVal": priceTablePk,
      },
      ScanIndexForward: false, // Sort by SK (TS#<ISO_timestamp>) in descending order to get the latest
      Limit: 1, // We only need the most recent price
    };

    // console.log("Querying PricesTable with:", JSON.stringify(queryInput, null, 2));
    const { Items } = await docClient.send(new QueryCommand(queryInput));

    if (!Items || Items.length === 0) {
      return NextResponse.json(
        { error: `Price data not found for asset: ${assetSymbol}` },
        { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // The item is already unmarshalled by DynamoDBDocumentClient
    const priceSnapshot = Items[0] as PriceSnapshot;

    // The SynthExchangeModal code was expecting `priceData.price` where priceData could be an array or single object.
    // Returning a single PriceSnapshot object is cleaner.
    return NextResponse.json(priceSnapshot, {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error: any) {
    console.error(`GET /api/prices error for asset '${url.searchParams.get("asset") || 'unknown'}':`, error);
    return NextResponse.json(
      { error: "Internal server error fetching price data." },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}