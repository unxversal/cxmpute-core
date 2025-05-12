// src/app/api/public/underlyings/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import type { TradingMode, UnderlyingPairMeta } from "@/lib/interfaces";

const ddb = new DynamoDBClient({});
const MARKETS_TABLE_NAME = Resource.MarketsTable.name;

// This API uses the ByStatusMode GSI to find ACTIVE SPOT markets (which are our underlying pair definitions)
// and then filters by mode.

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
  try {
    const url = req.nextUrl;
    const modeParam = url.searchParams.get("mode");
    const limitParam = url.searchParams.get("limit");
    const nextToken = url.searchParams.get("nextToken"); // Base64 encoded LastEvaluatedKey

    // --- Validation ---
    if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) {
      return NextResponse.json(
        { error: "Query parameter 'mode' (REAL or PAPER) is required" },
        { status: 400 }
      );
    }
    const mode = modeParam as TradingMode;

    const limit = limitParam ? parseInt(limitParam, 10) : 50; // Default limit
    if (isNaN(limit) || limit <= 0 || limit > 100) { // Max limit to prevent abuse
      return NextResponse.json(
        { error: "Invalid 'limit' parameter. Must be a positive number (max 100)." },
        { status: 400 }
      );
    }

    let exclusiveStartKey: Record<string, any> | undefined = undefined;
    if (nextToken) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(nextToken, "base64").toString("utf-8"));
      } catch (e) {
        console.error("Invalid 'nextToken'. Must be a valid base64 encoded JSON.", e);
        return NextResponse.json(
          { error: "Invalid 'nextToken'. Must be a valid base64 encoded JSON." },
          { status: 400 }
        );
      }
    }
    // --- End Validation ---

    // Query the ByStatusMode GSI for ACTIVE markets, then filter for type: "SPOT" and correct mode.
    // GSI: PK=status, SK=pk (original table PK: MARKET#[symbol]#<mode>)
    const queryInput: QueryCommandInput = {
      TableName: MARKETS_TABLE_NAME,
      IndexName: "ByStatusMode",
      KeyConditionExpression: "#statusAttr = :activeStatus", // Query by GSI PK
      FilterExpression: "#typeAttr = :spotType AND #modeAttr = :modeVal", // Filter results
      ExpressionAttributeNames: {
        "#statusAttr": "status",
        "#typeAttr": "type",
        "#modeAttr": "mode",
      },
      ExpressionAttributeValues: marshall({
        ":activeStatus": "ACTIVE",
        ":spotType": "SPOT", // Assuming SPOT entries are the underlying pair definitions
        ":modeVal": mode,
      }),
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      // ProjectionExpression can be used to fetch only necessary UnderlyingPairMeta fields
      // For now, fetching all and casting.
    };

    const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand(queryInput));

    const underlyingPairs: UnderlyingPairMeta[] = Items
      ? Items.map((item) => {
          // The item from MarketsTable needs to be cast to UnderlyingPairMeta
          // Ensure all fields of UnderlyingPairMeta are present or handled as optional
          const unmarshalledItem = unmarshall(item);
          // Sanitize/ensure defaults for boolean flags if they might be missing from older entries
          return {
              ...unmarshalledItem,
              allowsOptions: unmarshalledItem.allowsOptions === true || unmarshalledItem.allowsOptions === "true",
              allowsFutures: unmarshalledItem.allowsFutures === true || unmarshalledItem.allowsFutures === "true",
              allowsPerpetuals: unmarshalledItem.allowsPerpetuals === true || unmarshalledItem.allowsPerpetuals === "true",
          } as UnderlyingPairMeta;
        })
      : [];
    
    // Sort alphabetically by symbol for consistent UI display
    underlyingPairs.sort((a, b) => a.symbol.localeCompare(b.symbol));

    let newNextToken: string | null = null;
    if (LastEvaluatedKey) {
      newNextToken = Buffer.from(JSON.stringify(LastEvaluatedKey)).toString("base64");
    }

    return NextResponse.json(
      {
        items: underlyingPairs,
        nextToken: newNextToken,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("GET /api/public/underlyings error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching underlying pairs." },
      { status: 500 }
    );
  }
}