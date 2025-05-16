// src/app/api/positions/route.ts
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
import type { TradingMode, Position, MarketMeta } from "@/lib/interfaces";
import { requireAuth, AuthenticatedUserSubject } from "@/lib/auth";

const rawDdbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawDdbClient);

const POSITIONS_TABLE_NAME = Resource.PositionsTable.name;
const MARKETS_TABLE_NAME = Resource.MarketsTable.name;

const pkTraderMode = (traderId: string, mode: TradingMode) => `TRADER#${traderId}#${mode.toUpperCase()}`;
const pkMarketMetaKey = (marketSymbol: string, mode: TradingMode) => `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`;

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
    authenticatedUser = await requireAuth();
  } catch (authError: any) {
    if (authError instanceof NextResponse) return authError;
    console.error("GET /api/positions - Auth Error:", authError.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const traderId = authenticatedUser.properties.traderId;

  const url = req.nextUrl;
  const modeParam = url.searchParams.get("mode");
  const marketFilter = url.searchParams.get("market");
  const includeZeroPositions = url.searchParams.get("includeZero") === "true";

  if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) {
    return NextResponse.json({ error: "Query parameter 'mode' is required" }, { status: 400 });
  }
  const mode = modeParam as TradingMode;

  try {
    const pk = pkTraderMode(traderId, mode);
    let keyConditionExpression = "pk = :pkVal";
    const expressionAttributeValues: Record<string, any> = { ":pkVal": pk };
    const expressionAttributeNames: Record<string, string> = {}; // Initialize
    const filterExpressionParts: string[] = [];

    if (marketFilter) {
      keyConditionExpression += " AND sk = :skVal";
      expressionAttributeValues[":skVal"] = `MARKET#${marketFilter.toUpperCase()}`;
    }

    if (!includeZeroPositions) {
        filterExpressionParts.push("#sz <> :zeroSize");
        expressionAttributeNames["#sz"] = "size";
        expressionAttributeValues[":zeroSize"] = 0;
    }

    const queryInput: QueryCommandInput = {
      TableName: POSITIONS_TABLE_NAME,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    };
    
    if (Object.keys(expressionAttributeNames).length > 0) {
        queryInput.ExpressionAttributeNames = expressionAttributeNames;
    }
    if (filterExpressionParts.length > 0) {
        queryInput.FilterExpression = filterExpressionParts.join(" AND ");
    }

    const { Items } = await docClient.send(new QueryCommand(queryInput));
    const enrichedPositions: Position[] = [];

    if (Items) {
      for (const item of Items) {
        // item is already an unmarshalled JavaScript object from DocumentClient
        const basePosition = item as Omit<Position, 'tickSize' | 'lotSize' | 'baseAsset' | 'quoteAsset' | 'instrumentType' | 'underlyingPairSymbol'>;
        
        const enrichedPosition: Position = { ...basePosition } as Position; // Start with base, cast to full Position

        const marketPkForMeta = pkMarketMetaKey(basePosition.market, basePosition.mode);
        try {
          const marketRes = await docClient.send(new GetCommand({
            TableName: MARKETS_TABLE_NAME,
            Key: { pk: marketPkForMeta, sk: "META" },
          }));

          if (marketRes.Item) {
            const marketMeta = marketRes.Item as MarketMeta; // This is UnderlyingPairMeta | InstrumentMarketMeta
            
            enrichedPosition.baseAsset = marketMeta.baseAsset;
            enrichedPosition.quoteAsset = marketMeta.quoteAsset;
            enrichedPosition.instrumentType = marketMeta.type;
            
            if ('underlyingPairSymbol' in marketMeta && marketMeta.underlyingPairSymbol) {
                enrichedPosition.underlyingPairSymbol = marketMeta.underlyingPairSymbol;
            }

            // Correctly access tickSize/lotSize based on the actual type of marketMeta
            if (marketMeta.type === "SPOT") { // It's an UnderlyingPairMeta
              enrichedPosition.tickSize = marketMeta.tickSizeSpot;
              enrichedPosition.lotSize = marketMeta.lotSizeSpot;
            } else if (marketMeta.type === "PERP" || marketMeta.type === "OPTION" || marketMeta.type === "FUTURE") {
              // It's an InstrumentMarketMeta (or a PERP which also fits InstrumentMarketMeta structure for these fields)
              enrichedPosition.tickSize = marketMeta.tickSize;
              enrichedPosition.lotSize = marketMeta.lotSize;
            }
          } else {
            console.warn(`MarketMeta not found for position in market ${basePosition.market} (${basePosition.mode}). Using fallbacks.`);
            enrichedPosition.baseAsset = basePosition.market.split(/[-/]/)[0];
            enrichedPosition.quoteAsset = basePosition.market.split(/[-/]/)[1] || "USDC";
            enrichedPosition.tickSize = 0.01; // Fallback
            enrichedPosition.lotSize = 0.001; // Fallback
          }
        } catch (metaError: any) {
          console.error(`Error enriching position for market ${basePosition.market}:`, metaError.message);
          enrichedPosition.baseAsset = basePosition.market.split(/[-/]/)[0];
          enrichedPosition.quoteAsset = basePosition.market.split(/[-/]/)[1] || "USDC";
          enrichedPosition.tickSize = 0.01;
          enrichedPosition.lotSize = 0.001;
        }
        enrichedPositions.push(enrichedPosition);
      }
    }
    return NextResponse.json(enrichedPositions, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/positions error:", err);
    return NextResponse.json({ error: "Internal server error fetching positions." }, { status: 500 });
  }
}