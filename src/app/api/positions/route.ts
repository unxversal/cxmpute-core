/* app/api/positions/route.ts */
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { TradingMode, Position } from "@/lib/interfaces"; // Ensure TradingMode is defined
import { Resource } from "sst";

const POSITIONS_TABLE = Resource.PositionsTable.name;
const ddb = new DynamoDBClient({});

/**
 * Helper: derive PK for Positions/Balances tables
 * NEW: Incorporates trading mode.
 */
const pkTraderMode = (traderId: string, mode: TradingMode) =>
  `TRADER#${traderId}#${mode.toUpperCase()}`;

/* ————————————————————————————— GET /positions ——————————————————————————— */
export async function GET(req: NextRequest) {
  const traderId = req.nextUrl.searchParams.get("traderId") ?? undefined;
  const modeParam = req.nextUrl.searchParams.get("mode") ?? undefined;
  const market = req.nextUrl.searchParams.get("market") ?? undefined; // Optional: filter by market

  // --- Validation ---
  if (!traderId) {
    return NextResponse.json(
      { error: "query parameter 'traderId' is required" },
      { status: 400 }
    );
  }
  if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) {
    return NextResponse.json(
      { error: "query parameter 'mode' (REAL or PAPER) is required" },
      { status: 400 }
    );
  }
  const mode = modeParam as TradingMode;
  // --- End Validation ---

  try {
    // Construct the primary key for the query
    const pk = pkTraderMode(traderId, mode);

    // Determine KeyConditionExpression based on whether market filter is applied
    let keyCondition = "pk = :pk";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expressionValues: Record<string, any> = { ":pk": pk }; // Use any type for flexibility

    if (market) {
      keyCondition += " AND begins_with(sk, :marketPrefix)";
      expressionValues[":marketPrefix"] = `MARKET#${market}`; // Filter by market symbol if provided
    }

    const resp = await ddb.send(
      new QueryCommand({
        TableName: POSITIONS_TABLE,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: marshall(expressionValues),
        // Add FilterExpression if you want to exclude zero positions, e.g., "size <> :zero"
        // FilterExpression: "size <> :zero",
        // ExpressionAttributeValues: marshall({ ...expressionValues, ":zero": 0 }),
      })
    );

    const positions = (resp.Items ?? []).map((item) => unmarshall(item) as Position);

    return NextResponse.json(positions);

  } catch (err) {
    console.error("GET /positions error", err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}