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
const MARKETS_TABLE = Resource.MarketsTable.name;

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const modeParam = url.searchParams.get("mode");
    const statusParam = url.searchParams.get("status") ?? "ACTIVE"; // Default to ACTIVE
    const limitParam = url.searchParams.get("limit");
    const nextToken = url.searchParams.get("nextToken");

    // 1. Validate query parameters
    if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) {
      return NextResponse.json(
        { error: "Query parameter 'mode' (REAL or PAPER) is required" },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }
    const mode = modeParam as TradingMode;

    const validStatuses = ["ACTIVE", "PAUSED", "DELISTED"];
    if (!validStatuses.includes(statusParam.toUpperCase())) {
        return NextResponse.json(
            { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
            { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }
    const status = statusParam.toUpperCase();

    const limit = limitParam ? parseInt(limitParam, 10) : 50; // Default limit
    if (isNaN(limit) || limit <= 0) {
        return NextResponse.json(
            { error: "Invalid 'limit' parameter. Must be a positive number." },
            { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }

    let exclusiveStartKey: Record<string, any> | undefined = undefined;
    if (nextToken) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(nextToken, "base64").toString("utf-8"));
      } catch (e) {
        console.error(e);
        return NextResponse.json(
            { error: "Invalid 'nextToken'. Must be a valid base64 encoded JSON." },
            { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }
    }

    // 2. Construct Query
    // Using GSI ByStatusMode (PK=status, SK=pk which is MARKET#<symbol>#<mode>)
    // We will query by status and filter by the 'mode' attribute.
    const queryInput: QueryCommandInput = {
      TableName: MARKETS_TABLE,
      IndexName: "ByStatusMode",
      KeyConditionExpression: "#s = :statusVal", // Query by GSI PK (status)
      FilterExpression: "#m = :modeVal", // Filter by the 'mode' attribute
      ExpressionAttributeNames: {
        "#s": "status",
        "#m": "mode",
      },
      ExpressionAttributeValues: marshall({
        ":statusVal": status,
        ":modeVal": mode,
      }),
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      // Results from GSI are sorted by the GSI SK (which is `pk` = `MARKET#<symbol>#<mode>`)
      // This means they will be naturally sorted by symbol within the mode.
    };

    // 3. Execute Query
    const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand(queryInput));

    const markets: MarketMeta[] = Items
      ? Items.map((item) => unmarshall(item) as MarketMeta)
      : [];

    // 4. Prepare Response
    let newNextToken: string | null = null;
    if (LastEvaluatedKey) {
      newNextToken = Buffer.from(JSON.stringify(LastEvaluatedKey)).toString("base64");
    }

    return NextResponse.json(
      {
        items: markets,
        nextToken: newNextToken,
      },
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error: any) {
    console.error("GET /api/public/markets error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching markets." },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

// Handle CORS preflight requests
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