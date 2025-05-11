/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/public/markets/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import type { MarketMeta, TradingMode } from "@/lib/interfaces";

const ddb = new DynamoDBClient({});
const MARKETS_TABLE_NAME = Resource.MarketsTable.name;

// Helper to construct the GSI SK prefix for querying by status and mode
// Example: If GSI SK is `pk` (MARKET#symbol#mode), then to filter by mode,
// you'd actually query the GSI PK (`status`) and then filter the results if SK doesn't include mode directly.
// However, your MarketsTable GSI `ByStatusMode` has PK=`status`, SK=`pk` (original PK: `MARKET#symbol#mode`)
// This allows direct filtering by mode in the SK of the GSI.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const modeParam = searchParams.get("mode")?.toUpperCase();
  const statusParam = searchParams.get("status")?.toUpperCase() || "ACTIVE"; // Default to ACTIVE markets

  if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) {
    return NextResponse.json(
      { error: "Missing or invalid 'mode' query parameter (REAL or PAPER)." },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
  const mode = modeParam as TradingMode;

  if (statusParam !== "ACTIVE" && statusParam !== "PAUSED" && statusParam !== "DELISTED") {
     return NextResponse.json(
      { error: "Invalid 'status' query parameter (ACTIVE, PAUSED, or DELISTED)." },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    const queryInput: QueryCommandInput = {
      TableName: MARKETS_TABLE_NAME,
      IndexName: "ByStatusMode", // GSI: PK=status, SK=pk (original PK: MARKET#symbol#mode)
      KeyConditionExpression: "#s = :statusVal AND begins_with(sk, :modePrefix)",
      ExpressionAttributeNames: {
        "#s": "status",
      },
      ExpressionAttributeValues: marshall({
        ":statusVal": statusParam,
        ":modePrefix": `MARKET#` // We will filter for mode in the application logic after fetching
                                // Or, if GSI SK is `pk` which includes mode, we can use it:
                                // ':modePrefix': `MARKET#` // This would fetch all markets of a status
                                // We need to be more specific if possible.
                                // Let's adjust: SK for ByStatusMode is the original PK, which IS MARKET#symbol#mode
                                // So we can use begins_with on SK to filter by mode.
                                // Correction: No, begins_with on SK of GSI won't directly filter by mode if mode is the last part of original PK.
                                // We must query for status, then filter by mode in the application.
                                // OR, if we know the market symbols, we can do a BatchGetItem or multiple GetItems.
                                // For a public listing, it's better to query by status and then filter.

                                // Re-evaluating the GSI: ByStatusMode: PK=status, SK=pk (original PK: MARKET#<symbol>#<mode>)
                                // This means we *can* filter the sort key of the GSI.
                                // The sort key `pk` (which is `MARKET#symbol#mode`) can be filtered.
                                // Example: status = ACTIVE, sk begins_with MARKET#BTC-PERP#PAPER
                                // But we want ALL markets of a mode.
                                // So we scan with a filter, or query the GSI and then filter client-side.
                                // Let's adjust to query by status and use a FilterExpression for the mode on the items fetched.
      }),
    };

    // Updated query to fetch by status and then filter for mode
    // This is not ideal if many markets exist, a GSI that includes mode in its key structure
    // for querying (e.g. PK=mode, SK=status_symbol) would be more efficient.
    // Given the current GSI (PK=status, SK=original_pk), we fetch all for status and filter.
    // OR, make mode part of the GSI key.
    // Let's assume your current GSI `ByStatusMode` (PK=`status`, SK=`pk`)
    // The `pk` here IS the main table's PK `MARKET#symbol#mode`.
    // So we can filter effectively.

    queryInput.KeyConditionExpression = "#s = :statusVal"; // Query only by status
    queryInput.FilterExpression = "mode = :modeVal"; // Add filter for mode attribute
    queryInput.ExpressionAttributeValues![':modeVal'] = { S: mode }; // Add mode to expression values

    let allItems: MarketMeta[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      queryInput.ExclusiveStartKey = lastEvaluatedKey;
      const command = new QueryCommand(queryInput);
      const { Items, LastEvaluatedKey: lek } = await ddb.send(command);

      if (Items) {
        allItems = allItems.concat(Items.map(item => unmarshall(item) as MarketMeta));
      }
      lastEvaluatedKey = lek;
    } while (lastEvaluatedKey);

    // Sort markets alphabetically by symbol by default
    allItems.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return NextResponse.json(allItems, { headers: { 'Access-Control-Allow-Origin': '*' } });

  } catch (error) {
    console.error("Error fetching public markets:", error);
    return NextResponse.json(
      { error: "Internal server error fetching markets." },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}