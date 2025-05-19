/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/traders/[traderId]/paper-points/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import type { PaperPoints } from "@/lib/interfaces";
import { requireAuth } from "@/lib/auth"; // Your authentication helper

const ddb = new DynamoDBClient({});
const TRADERS_TABLE = Resource.TradersTable.name;

// PK helper for TradersTable in PAPER mode: TRADER#<traderId>#PAPER
const pkTraderPaperMode = (traderId: string) => `TRADER#${traderId}#PAPER`;

export async function GET(
  req: NextRequest,
  { params }: { params: { traderId: string } }
) {
  let authenticatedTraderId: string;
  try {
    const authResult = await requireAuth();
    authenticatedTraderId = authResult.properties.traderId;
    if (!authenticatedTraderId) {
      throw new Error("Trader ID not found in authenticated subject.");
    }

    // Authorization: Ensure the authenticated user is requesting their own paper points
    if (params.traderId !== authenticatedTraderId) {
      console.warn(`PaperPoints API AuthZ Error: User ${authenticatedTraderId} tried to access points for ${params.traderId}`);
      return NextResponse.json({ error: "Forbidden: Cannot access another user's paper points." }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

  } catch (authError: any) {
    if (authError instanceof NextResponse) return authError;
    console.error("GET /api/traders/.../paper-points - Authentication Error:", authError.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    // Use the authenticated traderId from the token, not the path param directly for the query
    // Path param traderId was already validated against authenticatedTraderId
    const traderIdForQuery = authenticatedTraderId; 

    const getItemInput = {
      TableName: TRADERS_TABLE,
      Key: marshall({
        pk: pkTraderPaperMode(traderIdForQuery), // Query for the PAPER mode record
        sk: "META", // Assuming your TradersTable SK for main data is "META"
      }),
      ProjectionExpression: "paperPoints", // Only fetch the paperPoints attribute
    };

    const { Item } = await ddb.send(new GetItemCommand(getItemInput));

    if (!Item || !Item.paperPoints) {
      // If no record or no paperPoints attribute, return default/zero values
      return NextResponse.json(
        { totalPoints: 0, epoch: 1 }, // Default structure for PaperPoints
        { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const paperPoints = unmarshall(Item).paperPoints as PaperPoints;

    return NextResponse.json(paperPoints, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });

  } catch (error: any) {
    console.error(`GET /api/traders/${params.traderId}/paper-points error:`, error);
    return NextResponse.json(
      { error: "Internal server error fetching paper points." },
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