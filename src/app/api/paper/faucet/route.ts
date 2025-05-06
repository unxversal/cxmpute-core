/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/paper/faucet/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { requireAuth } from "@/lib/auth"; // Your authentication helper
import type { TradingMode } from "@/lib/interfaces";
// import { pk } from "@/dex/matchers/matchEngine"; // Or redefine helper

const BALANCES_TABLE = Resource.BalancesTable.name;
const ddb = new DynamoDBClient({});

// Redefine or import PK helper for BalancesTable
const pkTraderMode = (traderId: string, mode: TradingMode) =>
  `TRADER#${traderId}#${mode.toUpperCase()}`;
const skAsset = (asset: string) => `ASSET#${asset.toUpperCase()}`;

// --- Configuration for Faucet ---
const FAUCET_ASSET = "USDC"; // Asset provided by the faucet
const FAUCET_AMOUNT_BASE_UNITS = "10000000000"; // e.g., 10,000 USDC with 6 decimals
const PAPER_MODE: TradingMode = "PAPER";
// --------------------------------

export async function POST(req: NextRequest) {
  let authenticatedTraderId: string;
  try {
    // --- Authentication ---
    // requireAuth should verify the request signature/token and return the traderId
    // or throw an error if authentication fails.
    const authResult = await requireAuth(req); // Modify based on your auth implementation
    // Assuming requireAuth returns an object with the traderId or similar identifier
    authenticatedTraderId = authResult.traderId; // Adjust based on your auth return value
    if (!authenticatedTraderId) {
        throw new Error("Authentication failed or traderId not returned.");
    }
    console.log(`Faucet request authenticated for traderId: ${authenticatedTraderId}`);
    // --- End Authentication ---

  } catch (authError: any) {
    console.error("Faucet Authentication Error:", authError.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
      // Optional: Check if the request body contains a specific traderId and validate it matches the authenticated one
      // const { traderId: bodyTraderId } = await req.json();
      // if (bodyTraderId && bodyTraderId !== authenticatedTraderId) {
      //      return NextResponse.json({ error: "Trader ID mismatch" }, { status: 403 });
      // }

    // Construct the keys for the paper balance item
    const balancePk = pkTraderMode(authenticatedTraderId, PAPER_MODE);
    const balanceSk = skAsset(FAUCET_ASSET);

    // --- Add Funds using UpdateItem ---
    // Using ADD ensures the item is created if it doesn't exist,
    // and the balance is incremented if it does.
    // We also initialize 'pending' to 0 if the item is created.
    console.log(`Adding ${FAUCET_AMOUNT_BASE_UNITS} ${FAUCET_ASSET} to ${balancePk}`);
    await ddb.send(
      new UpdateItemCommand({
        TableName: BALANCES_TABLE,
        Key: marshall({ pk: balancePk, sk: balanceSk }),
        UpdateExpression: `
                ADD balance :amount
                SET pending = if_not_exists(pending, :zero)
            `, // Add to balance, set pending if it doesn't exist
        ExpressionAttributeValues: marshall({
          ":amount": BigInt(FAUCET_AMOUNT_BASE_UNITS), // Use BigInt for the amount
          ":zero": BigInt(0), // Use BigInt for zero
        }),
        ReturnValues: "UPDATED_NEW", // Optional: return the new balance
      })
    );

    return NextResponse.json(
        {
            success: true,
            message: `Successfully added ${parseInt(FAUCET_AMOUNT_BASE_UNITS) / 1e6} paper ${FAUCET_ASSET} to your account.`, // Format for display
            traderId: authenticatedTraderId,
            asset: FAUCET_ASSET,
            amountAdded: FAUCET_AMOUNT_BASE_UNITS
        },
        { status: 200 }
    );

  } catch (error: any) {
    console.error(`Paper Faucet Error for trader ${authenticatedTraderId}:`, error);
    // Handle potential DynamoDB errors (e.g., ProvisionedThroughputExceededException)
    return NextResponse.json({ error: "Internal server error processing faucet request." }, { status: 500 });
  }
}