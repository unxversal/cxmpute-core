// src/app/api/public/klines/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"; // Keep for raw client if ever needed, but we use DocClient
import { 
    DynamoDBDocumentClient, 
    QueryCommand, 
    QueryCommandInput 
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import type { TradingMode, Kline } from "@/lib/interfaces";

// Use DocumentClient for simplified interaction
const rawDdbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawDdbClient, {
    marshallOptions: { removeUndefinedValues: true }
});

const KLINES_TABLE_NAME = Resource.KlinesTable.name; // This will resolve after SST build

interface TradingViewKline {
  time: number; 
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

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
  const url = req.nextUrl; // Define here for use in error logging
  try {
    const marketSymbol = url.searchParams.get("market");
    const modeParam = url.searchParams.get("mode");
    const interval = url.searchParams.get("interval") || "1h";
    const startTimeParam = url.searchParams.get("startTime");
    const endTimeParam = url.searchParams.get("endTime");
    const limitParam = url.searchParams.get("limit");

    // --- Validation ---
    if (!marketSymbol) {
      return NextResponse.json({ error: "Query parameter 'market' (instrument symbol) is required" }, { status: 400 });
    }
    if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) {
      return NextResponse.json({ error: "Query parameter 'mode' (REAL or PAPER) is required" }, { status: 400 });
    }
    const validIntervals = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "1w", "1M"];
    if (!validIntervals.includes(interval)) {
      return NextResponse.json({ error: `Invalid interval. Supported: ${validIntervals.join(', ')}` }, { status: 400 });
    }
    const limit = limitParam ? parseInt(limitParam, 10) : 500;
    if (isNaN(limit) || limit <= 0 || limit > 2000) {
      return NextResponse.json({ error: "Invalid 'limit'. Must be positive (max 2000)." }, { status: 400 });
    }
    let startTimeSeconds: number | undefined = undefined;
    let endTimeSeconds: number | undefined = undefined;

    if (startTimeParam) {
        const st = parseInt(startTimeParam);
        if (isNaN(st)) return NextResponse.json({ error: "Invalid startTime format (must be UNIX ms)."}, {status: 400});
        startTimeSeconds = Math.floor(st / 1000);
    }
    if (endTimeParam) {
        const et = parseInt(endTimeParam);
        if (isNaN(et)) return NextResponse.json({ error: "Invalid endTime format (must be UNIX ms)."}, {status: 400});
        endTimeSeconds = Math.floor(et / 1000);
    }
    if (startTimeSeconds && endTimeSeconds && startTimeSeconds > endTimeSeconds) {
        return NextResponse.json({ error: "startTime cannot be after endTime." }, { status: 400 });
    }
    // --- End Validation ---

    const mode = modeParam as TradingMode;
    const klineTablePk = `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`;

    const queryInput: QueryCommandInput = {
      TableName: KLINES_TABLE_NAME,
      KeyConditionExpression: "pk = :pkVal",
      ExpressionAttributeValues: { // DocumentClient expects plain JS objects for ExpressionAttributeValues
        ":pkVal": klineTablePk,
      },
      ScanIndexForward: true, 
      Limit: limit,
    };

    if (startTimeSeconds !== undefined && endTimeSeconds !== undefined) {
        queryInput.KeyConditionExpression += " AND sk BETWEEN :skStart AND :skEnd";
        queryInput.ExpressionAttributeValues![":skStart"] = `INTERVAL#${interval}#TS#${startTimeSeconds}`;
        queryInput.ExpressionAttributeValues![":skEnd"] = `INTERVAL#${interval}#TS#${endTimeSeconds}`;
    } else if (startTimeSeconds !== undefined) {
        queryInput.KeyConditionExpression += " AND sk >= :skStart";
        queryInput.ExpressionAttributeValues![":skStart"] = `INTERVAL#${interval}#TS#${startTimeSeconds}`;
    } else if (endTimeSeconds !== undefined) {
        queryInput.KeyConditionExpression += " AND sk <= :skEnd";
        queryInput.ExpressionAttributeValues![":skEnd"] = `INTERVAL#${interval}#TS#${endTimeSeconds}`;
        queryInput.ScanIndexForward = false; 
    } else {
        queryInput.KeyConditionExpression += " AND begins_with(sk, :skPrefix)";
        queryInput.ExpressionAttributeValues![":skPrefix"] = `INTERVAL#${interval}#TS#`;
        queryInput.ScanIndexForward = false;
    }

    // console.log("Querying KlinesTable with:", JSON.stringify(queryInput, null, 2)); // For debugging
    const { Items } = await docClient.send(new QueryCommand(queryInput)); // Use docClient

    const klinesForTV: TradingViewKline[] = [];
    if (Items) { // Corrected: Use Items (capitalized)
      Items.forEach((item: Record<string, any>) => { // Corrected: Add type for item
        const kline = item as Kline; // Cast to Kline (DocumentClient already unmarshalls)
        if (kline.time !== undefined && kline.open !== undefined && kline.high !== undefined && kline.low !== undefined && kline.close !== undefined) {
            klinesForTV.push({
              time: kline.time, 
              open: Number(kline.open),
              high: Number(kline.high),
              low: Number(kline.low),
              close: Number(kline.close),
              volume: kline.volumeBase !== undefined ? Number(kline.volumeBase) : undefined,
            });
        } else {
            console.warn("Skipping kline item with missing OHLC or time data:", kline);
        }
      });
    }
    
    if (queryInput.ScanIndexForward === false && klinesForTV.length > 0) {
        klinesForTV.reverse();
    }

    return NextResponse.json(klinesForTV, { status: 200 });

  } catch (error: any) {
    console.error(`GET /api/public/klines error for ${url.searchParams.get("market") || 'unknown market'}:`, error);
    return NextResponse.json(
      { error: "Internal server error fetching kline data." },
      { status: 500 }
    );
  }
}