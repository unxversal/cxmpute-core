// src/app/api/public/instruments/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import type {
  TradingMode,
  InstrumentMarketMeta,
  DerivativeType,
  ExpiryData,
  OptionInstrumentData,
  // FutureInstrumentData, // Used within ExpiryData
  InstrumentsApiResponse,
  PerpInstrumentApiResponse,
  // OptionType, // Used within InstrumentMarketMeta
} from "@/lib/interfaces";

const ddb = new DynamoDBClient({});
const MARKETS_TABLE_NAME = Resource.MarketsTable.name; // This will resolve after SST build

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  try {
    const underlyingPairSymbolParam = url.searchParams.get("underlyingPairSymbol");
    const instrumentTypeParam = url.searchParams.get("instrumentType");
    const modeParam = url.searchParams.get("mode");
    const limitParam = url.searchParams.get("limit");
    const nextToken = url.searchParams.get("nextToken");

    // --- Validation ---
    if (!underlyingPairSymbolParam) {
      return NextResponse.json({ error: "Query parameter 'underlyingPairSymbol' is required" }, { status: 400 });
    }
    if (!instrumentTypeParam || !["OPTION", "FUTURE", "PERP"].includes(instrumentTypeParam.toUpperCase())) {
      return NextResponse.json({ error: "Query parameter 'instrumentType' (OPTION, FUTURE, or PERP) is required" }, { status: 400 });
    }
    if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) {
      return NextResponse.json({ error: "Query parameter 'mode' (REAL or PAPER) is required" }, { status: 400 });
    }

    const underlyingPairSymbol = underlyingPairSymbolParam;
    const instrumentType = instrumentTypeParam.toUpperCase() as DerivativeType | "PERP";
    const mode = modeParam as TradingMode;

    const limit = limitParam ? parseInt(limitParam, 10) : 100;
    if (isNaN(limit) || limit <= 0 || limit > 500) {
      return NextResponse.json({ error: "Invalid 'limit' parameter. Must be a positive number (max 500)." }, { status: 400 });
    }

    let exclusiveStartKey: Record<string, any> | undefined = undefined;
    if (nextToken) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(nextToken, "base64").toString("utf-8"));
      } catch (parseError: unknown) {
        console.warn("Failed to parse nextToken:", nextToken, parseError);
        return NextResponse.json({ error: "Invalid 'nextToken'." }, { status: 400 });
      }
    }
    // --- End Validation ---

    const gsi1pkValue = `${underlyingPairSymbol}#${mode}#${instrumentType}`;
    const gsi1skBeginsWithValue = `ACTIVE#`;

    const queryInput: QueryCommandInput = {
      TableName: MARKETS_TABLE_NAME,
      IndexName: "InstrumentsByUnderlying",
      KeyConditionExpression: "gsi1pk = :gsi1pkVal AND begins_with(gsi1sk, :gsi1skPrefix)",
      ExpressionAttributeValues: marshall({
        ":gsi1pkVal": gsi1pkValue,
        ":gsi1skPrefix": gsi1skBeginsWithValue,
      }),
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
    };

    const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand(queryInput));

    const instruments: InstrumentMarketMeta[] = Items
      ? Items.map((item) => unmarshall(item) as InstrumentMarketMeta)
      : [];

    const newNextToken: string | null = LastEvaluatedKey ? Buffer.from(JSON.stringify(LastEvaluatedKey)).toString("base64") : null;

    if (instrumentType === "OPTION") {
      const expiriesMap = new Map<number, ExpiryData>();
      instruments.forEach(instr => {
        if (instr.type === "OPTION" && instr.expiryTs && instr.strikePrice !== undefined && instr.optionType) {
          if (!expiriesMap.has(instr.expiryTs)) {
            expiriesMap.set(instr.expiryTs, {
              expiryTs: instr.expiryTs,
              displayDate: new Date(instr.expiryTs).toISOString().split('T')[0],
              callStrikes: [],
              putStrikes: [],
            });
          }
          const expiryDetail = expiriesMap.get(instr.expiryTs)!;
          const optionData: OptionInstrumentData = {
            strikePrice: instr.strikePrice,
            instrumentSymbol: instr.symbol,
            // lastPrice: instr.lastPrice, // Populate if available from 'instr'
            // openInterest: instr.openInterest,
          };
          if (instr.optionType === "CALL") {
            expiryDetail.callStrikes!.push(optionData);
          } else if (instr.optionType === "PUT") {
            expiryDetail.putStrikes!.push(optionData);
          }
        }
      });
      expiriesMap.forEach(expiry => {
        expiry.callStrikes?.sort((a, b) => a.strikePrice - b.strikePrice);
        expiry.putStrikes?.sort((a, b) => a.strikePrice - b.strikePrice);
      });
      
      const responsePayload: InstrumentsApiResponse = { // Explicitly typed
        underlyingPairSymbol,
        instrumentType: "OPTION",
        expiries: Array.from(expiriesMap.values()).sort((a,b) => a.expiryTs - b.expiryTs), // Renamed 'items' to 'expiries'
        nextToken: newNextToken,
      };
      return NextResponse.json(responsePayload, { status: 200 });

    } else if (instrumentType === "FUTURE") {
      const expiriesMap = new Map<number, ExpiryData>();
      instruments.forEach(instr => {
        if (instr.type === "FUTURE" && instr.expiryTs) {
           if (!expiriesMap.has(instr.expiryTs)) { // Ensure only one future per expiry (if that's the model)
               expiriesMap.set(instr.expiryTs, {
                 expiryTs: instr.expiryTs,
                 displayDate: new Date(instr.expiryTs).toISOString().split('T')[0],
                 futureInstrument: { // Populate the FutureInstrumentData
                    instrumentSymbol: instr.symbol,
                    // lastPrice: instr.lastPrice,
                    // openInterest: instr.openInterest,
                 }
               });
           }
        }
      });
      const responsePayload: InstrumentsApiResponse = { // Explicitly typed
        underlyingPairSymbol,
        instrumentType: "FUTURE",
        expiries: Array.from(expiriesMap.values()).sort((a,b) => a.expiryTs - b.expiryTs), // Renamed 'items' to 'expiries'
        nextToken: newNextToken,
      };
      return NextResponse.json(responsePayload, { status: 200 });

    } else if (instrumentType === "PERP") {
      // For PERP, we expect only one active instrument for the underlyingPairSymbol+mode+type.
      // The 'instruments' array should contain 0 or 1 item.
      if (instruments.length > 1) {
        console.warn(`PERP query for ${gsi1pkValue} returned multiple active instruments: ${instruments.length}. Returning first one.`);
      }
      const perpInstrument = instruments.length > 0 ? instruments[0] : null;
      
      if (!perpInstrument) {
        // It's possible no PERP market is defined for this underlying, return empty success
        const emptyPerpResponse: PerpInstrumentApiResponse = {
            instrument: null, // Or a specific "NotFound" structure if preferred
            nextToken: null,
        };
        return NextResponse.json(emptyPerpResponse, { status: 200 });
      }

      const responsePayload: PerpInstrumentApiResponse = { // Explicitly typed
        instrument: perpInstrument, // 'instrument' field instead of 'items'
        nextToken: newNextToken, // Usually null for PERP query as it targets one
      };
      return NextResponse.json(responsePayload, { status: 200 });

    } else {
        // Should not be reached due to initial validation
        console.error("Internal error: Unhandled instrument type in response construction:", instrumentType);
        return NextResponse.json({ error: "Internal server error: Invalid instrument type processing." }, { status: 500 });
    }

  } catch (error: any) {
    console.error(`GET /api/public/instruments error for ${url.searchParams.get("underlyingPairSymbol") || 'unknown underlying'}:`, error);
    return NextResponse.json(
      { error: "Internal server error fetching instruments." },
      { status: 500 }
    );
  }
}