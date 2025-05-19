// src/app/api/trades/history/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import type {
  Trade,        // This interface should now include optional enrichment fields
  TradingMode,
  MarketMeta,   // Union: UnderlyingPairMeta | InstrumentMarketMeta
} from "@/lib/interfaces";
import { requireAuth, AuthenticatedUserSubject } from "@/lib/auth";

const rawDdbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawDdbClient);

const TRADES_TABLE_NAME = Resource.TradesTable.name;
const MARKETS_TABLE_NAME = Resource.MarketsTable.name;

const pkMarketMetaKey = (marketSymbol: string, mode: TradingMode) => `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`;
const pkMarketModeTradeForGSI = (marketSymbol: string, mode: TradingMode) => `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`;

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

export async function GET(req: NextRequest) {
  let authenticatedUser: AuthenticatedUserSubject;
  try {
    authenticatedUser = await requireAuth(); // Corrected: No argument needed for requireAuth
  } catch (authError: any) {
    if (authError instanceof NextResponse) return authError;
    console.error("GET /api/trades/history - Auth Error:", authError.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const traderId = authenticatedUser.properties.traderId;

  try {
    const url = req.nextUrl;
    const modeParam = url.searchParams.get("mode");
    const marketParam = url.searchParams.get("market");
    const limitParam = url.searchParams.get("limit");
    const nextToken = url.searchParams.get("nextToken");

    if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) {
      return NextResponse.json({ error: "Query parameter 'mode' (REAL or PAPER) is required" }, { status: 400 });
    }
    const mode = modeParam as TradingMode;

    const limit = limitParam ? parseInt(limitParam, 10) : 25;
    if (isNaN(limit) || limit <= 0 || limit > 100) {
      return NextResponse.json({ error: "Invalid 'limit' parameter." }, { status: 400 });
    }
    let exclusiveStartKey: Record<string, any> | undefined = undefined;
    if (nextToken) {
      try { exclusiveStartKey = JSON.parse(Buffer.from(nextToken, "base64").toString("utf-8")); }
      catch { return NextResponse.json({ error: "Invalid 'nextToken'." }, { status: 400 }); }
    }

    let keyConditionExpression = "#tid = :traderIdVal";
    const expressionAttributeNames: Record<string, string> = { "#tid": "traderId", "#gsiSK": "pk" };
    const expressionAttributeValues: Record<string, any> = { ":traderIdVal": traderId };

    if (marketParam) {
        const marketPkForFilter = pkMarketModeTradeForGSI(marketParam, mode);
        keyConditionExpression += " AND #gsiSK = :marketPkVal";
        expressionAttributeValues[":marketPkVal"] = marketPkForFilter;
    } else {
        keyConditionExpression += ` AND ends_with(#gsiSK, :modeSuffix)`;
        expressionAttributeValues[":modeSuffix"] = `#${mode.toUpperCase()}`;
    }

    const queryInput: QueryCommandInput = {
      TableName: TRADES_TABLE_NAME,
      IndexName: "ByTraderMode",
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
    };

    const { Items, LastEvaluatedKey } = await docClient.send(new QueryCommand(queryInput));
    const enrichedTrades: Trade[] = [];

    if (Items) {
      for (const item of Items) {
        // item is already an unmarshalled JS object. It contains the core Trade fields.
        // We will create a new object that conforms to the full Trade interface (including optional enriched fields).
        const baseTrade = item as Omit<Trade, 'tickSize' | 'lotSize' | 'baseAsset' | 'quoteAsset' | 'instrumentType'>;
        
        const enrichedTrade: Trade = { 
            ...baseTrade,
            // Initialize optional fields that will be enriched
            tickSize: undefined,
            lotSize: undefined,
            baseAsset: undefined,
            quoteAsset: undefined,
            instrumentType: undefined,
         };

        const marketPkForMeta = pkMarketMetaKey(baseTrade.market, baseTrade.mode);
        try {
          const marketRes = await docClient.send(new GetCommand({
            TableName: MARKETS_TABLE_NAME,
            Key: { pk: marketPkForMeta, sk: "META" },
          }));

          if (marketRes.Item) {
            const marketMeta = marketRes.Item as MarketMeta; // Union: UnderlyingPairMeta | InstrumentMarketMeta
            
            enrichedTrade.baseAsset = marketMeta.baseAsset;
            enrichedTrade.quoteAsset = marketMeta.quoteAsset;
            enrichedTrade.instrumentType = marketMeta.type; // Store the type of market

            // Correctly access tickSize/lotSize based on the actual type of marketMeta
            if (marketMeta.type === "SPOT") { // It's an UnderlyingPairMeta
              enrichedTrade.tickSize = marketMeta.tickSizeSpot;
              enrichedTrade.lotSize = marketMeta.lotSizeSpot;
            } else if (marketMeta.type === "PERP" || marketMeta.type === "OPTION" || marketMeta.type === "FUTURE") {
              // It's an InstrumentMarketMeta
              enrichedTrade.tickSize = marketMeta.tickSize;
              enrichedTrade.lotSize = marketMeta.lotSize;
            }
          } else {
            console.warn(`TradeHistory API: MarketMeta not found for trade ${baseTrade.tradeId} market ${baseTrade.market}. Formatting may use defaults.`);
            // Set fallback defaults if MarketMeta is missing
            enrichedTrade.baseAsset = baseTrade.market.split(/[-/]/)[0];
            enrichedTrade.quoteAsset = baseTrade.market.split(/[-/]/)[1] || "USDC";
            enrichedTrade.tickSize = 0.01; 
            enrichedTrade.lotSize = 0.001;
          }
        } catch (metaError: any) {
          console.error(`TradeHistory API: Error enriching trade ${baseTrade.tradeId}:`, metaError.message);
          enrichedTrade.baseAsset = baseTrade.market.split(/[-/]/)[0];
          enrichedTrade.quoteAsset = baseTrade.market.split(/[-/]/)[1] || "USDC";
          enrichedTrade.tickSize = 0.01;
          enrichedTrade.lotSize = 0.001;
        }
        enrichedTrades.push(enrichedTrade);
      }
    }
    
    const newNextToken = LastEvaluatedKey ? Buffer.from(JSON.stringify(LastEvaluatedKey)).toString("base64") : null;
    return NextResponse.json({ items: enrichedTrades, nextToken: newNextToken }, { status: 200 });

  } catch (err: any) {
    console.error("GET /api/trades/history error:", err);
    return NextResponse.json({ error: "Internal server error fetching trade history." }, { status: 500 });
  }
}