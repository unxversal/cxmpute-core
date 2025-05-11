// src/app/api/trades/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import type { Trade, TradingMode } from "@/lib/interfaces";
import { requireAuth } from "@/lib/auth"; // Your authentication helper

const ddb = new DynamoDBClient({});
const TRADES_TABLE = Resource.TradesTable.name;

// PK helper for TradesTable PK (GSI SK): MARKET#<symbol>#<mode>
const pkMarketMode = (market: string, mode: TradingMode) => `MARKET#${market}#${mode.toUpperCase()}`;

export async function GET(req: NextRequest) {
  let authenticatedTraderId: string;
  try {
    const authResult = await requireAuth();
    authenticatedTraderId = authResult.properties.traderId;
    if (!authenticatedTraderId) {
      throw new Error("Trader ID not found in authenticated subject.");
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (authError: any) {
    if (authError instanceof NextResponse) return authError;
    console.error("GET /api/trades/history - Authentication Error:", authError.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const url = req.nextUrl;
    const modeParam = url.searchParams.get("mode");
    const marketParam = url.searchParams.get("market"); // Optional
    const limitParam = url.searchParams.get("limit");
    const nextToken = url.searchParams.get("nextToken"); // For pagination

    if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) {
      return NextResponse.json(
        { error: "Query parameter 'mode' (REAL or PAPER) is required" },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }
    const mode = modeParam as TradingMode;
    const traderId = authenticatedTraderId;

    const limit = limitParam ? parseInt(limitParam, 10) : 25; // Default limit
    if (isNaN(limit) || limit <= 0 || limit > 100) { // Max limit
      return NextResponse.json(
        { error: "Invalid 'limit' parameter. Must be a positive number (max 100)." },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let exclusiveStartKey: Record<string, any> | undefined = undefined;
    if (nextToken) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(nextToken, "base64").toString("utf-8"));
      } catch (e) {
        console.error("Invalid 'nextToken'. Must be a valid base64 encoded JSON.", e);
        return NextResponse.json(
          { error: "Invalid 'nextToken'. Must be a valid base64 encoded JSON." },
          { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }
    }

    // Using GSI `ByTraderMode`: PK=traderId, SK=pk (original PK of TradesTable: MARKET#<symbol>#<mode>)
    const queryInput: QueryCommandInput = {
      TableName: TRADES_TABLE,
      IndexName: "ByTraderMode",
      KeyConditionExpression: "#tid = :traderIdVal" + 
                              (marketParam ? " AND begins_with(#pkVal, :pkPrefixVal)" : ""),
      ExpressionAttributeNames: {
        "#tid": "traderId", // GSI PK
        ...(marketParam && { "#pkVal": "pk" }), // GSI SK (original table's PK)
      },
      ExpressionAttributeValues: marshall({
        ":traderIdVal": traderId,
        ...(marketParam && { ":pkPrefixVal": pkMarketMode(marketParam, mode) }),
      }),
      ScanIndexForward: false, // To get most recent trades first (assuming SK in TradesTable is TS#<tradeId>)
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
    };

    const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand(queryInput));

    const trades: Trade[] = Items
      ? Items.map((item) => unmarshall(item) as Trade)
      : [];

    let newNextToken: string | null = null;
    if (LastEvaluatedKey) {
      newNextToken = Buffer.from(JSON.stringify(LastEvaluatedKey)).toString("base64");
    }

    return NextResponse.json(
        { items: trades, nextToken: newNextToken },
        { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("GET /api/trades/history error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching trade history." },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}