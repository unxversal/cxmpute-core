// src/app/api/balances/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import type { Balance, TradingMode } from "@/lib/interfaces"; // Assuming Balance has { asset, balance, pending }
import { requireAuth } from "@/lib/auth"; // Your authentication helper

const ddb = new DynamoDBClient({});
const BALANCES_TABLE = Resource.BalancesTable.name;

// PK helper for BalancesTable: TRADER#<traderId>#<mode>
const pkTraderMode = (traderId: string, mode: TradingMode) => `TRADER#${traderId}#${mode.toUpperCase()}`;

export async function GET(req: NextRequest) {
  let authenticatedTraderId: string;
  try {
    // Authenticate the request and get the traderId
    const authResult = await requireAuth(); // Ensure this returns the correct internalDEXTraderId
    authenticatedTraderId = authResult.properties.traderId; // Or user.properties.id if that's the traderId
    if (!authenticatedTraderId) {
      throw new Error("Trader ID not found in authenticated subject.");
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (authError: any) {
    if (authError instanceof NextResponse) return authError; // Auth error already a NextResponse
    console.error("GET /api/balances - Authentication Error:", authError.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const url = req.nextUrl;
    const modeParam = url.searchParams.get("mode");
    // Note: traderId is now taken from the authenticated session, not query params for security.

    if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) {
      return NextResponse.json(
        { error: "Query parameter 'mode' (REAL or PAPER) is required" },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }
    const mode = modeParam as TradingMode;
    const traderId = authenticatedTraderId; // Use the ID from the authenticated session

    const queryInput: QueryCommandInput = {
      TableName: BALANCES_TABLE,
      KeyConditionExpression: "pk = :pkVal", // Query by the full PK
      ExpressionAttributeValues: marshall({
        ":pkVal": pkTraderMode(traderId, mode),
      }),
    };

    const { Items } = await ddb.send(new QueryCommand(queryInput));

    // Transform items to include asset from SK (ASSET#<asset>)
    const balances: Partial<Balance>[] = Items
      ? Items.map((item) => {
          const unmarshalled = unmarshall(item);
          const asset = unmarshalled.sk?.split("#")[1]; // Extract asset from SK
          return {
            asset: asset, // Add asset to the response object
            balance: unmarshalled.balance, // Keep as number as per interface
            pending: unmarshalled.pending, // Keep as number
          };
        })
      : [];

    return NextResponse.json(balances, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("GET /api/balances error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching balances." },
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization", // Allow Authorization for auth check
    },
  });
}