// src/app/api/synths/exchange/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  QueryCommand, // To get oracle price
  TransactWriteItemsCommand, // For atomic balance updates
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { requireAuth, AuthenticatedUserSubject } from "@/lib/auth";
import type { TradingMode, PriceSnapshot } from "@/lib/interfaces";

const ddb = new DynamoDBClient({});
const BALANCES_TABLE_NAME = Resource.BalancesTable.name;
const PRICES_TABLE_NAME = Resource.PricesTable.name;

// PK helper for BalancesTable: TRADER#<traderId>#<mode>
const pkTraderMode = (traderId: string, mode: TradingMode) => `TRADER#${traderId}#${mode.toUpperCase()}`;
// SK helper for BalancesTable: ASSET#<assetSymbol>
const skAsset = (assetSymbol: string) => `ASSET#${assetSymbol.toUpperCase()}`;
// PK helper for PricesTable: ASSET#<assetSymbol>
const pkPriceAsset = (assetSymbol: string) => `ASSET#${assetSymbol.toUpperCase()}`;


const USDC_DECIMALS = 6;
// Define decimals for your synthetic assets (these are for internal accounting/display precision)
// The actual "value" is always pegged to the underlying via oracle price in USDC.
const SYNTH_ASSET_DECIMALS: Record<string, number> = {
    "sBTC": 8,
    "sETH": 8, // Example, ETH often uses 18 for real ERC20, but for internal balance might be less
    "sPEAQ": 6,
    "sAVAX": 8,
    "sSOL": 9,
    "sBNB": 8,
    "sNEAR": 8,
    "sOP": 8,
    "sDOT": 10,
    // Add other synths as needed
};
const ZERO = BigInt(0);

/**
 * Fetches the latest oracle price for a given asset against USDC.
 * @param baseAssetSymbol - e.g., "BTC", "ETH" (without the "s" prefix)
 */
async function getOraclePrice(baseAssetSymbol: string): Promise<number | null> {
  try {
    const { Items } = await ddb.send(
      new QueryCommand({
        TableName: PRICES_TABLE_NAME,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: marshall({ ":pk": pkPriceAsset(baseAssetSymbol) }),
        ScanIndexForward: false, // Get the latest price (assuming SK is timestamp based and descending)
        Limit: 1,
      })
    );
    if (!Items || Items.length === 0) {
      console.warn(`Oracle price not found for asset: ${baseAssetSymbol}`);
      return null;
    }
    const priceData = unmarshall(Items[0]) as PriceSnapshot;
    return priceData.price;
  } catch (error) {
    console.error(`Error fetching oracle price for ${baseAssetSymbol}:`, error);
    return null;
  }
}


export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: NextRequest) {
  let authenticatedUser: AuthenticatedUserSubject;
  try {
    authenticatedUser = await requireAuth();
  } catch (authError: any) {
    if (authError instanceof NextResponse) return authError;
    console.error("/api/synths/exchange - Auth Error:", authError.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as {
      fromAsset: string; // e.g., "USDC" or "sBTC"
      toAsset: string;   // e.g., "sBTC" or "USDC"
      amount: string;    // Amount of fromAsset in its base units (string for BigInt)
      mode: TradingMode;
    };

    // --- Validation ---
    if (!body.fromAsset || !body.toAsset || !body.amount || !body.mode) {
      return NextResponse.json({ error: "Missing required fields: fromAsset, toAsset, amount, mode" }, { status: 400 });
    }
    if (body.mode !== "REAL" && body.mode !== "PAPER") {
      return NextResponse.json({ error: "Invalid mode. Must be REAL or PAPER." }, { status: 400 });
    }
    if (body.fromAsset === body.toAsset) {
      return NextResponse.json({ error: "fromAsset and toAsset cannot be the same." }, { status: 400 });
    }
    if (!((body.fromAsset === "USDC" && body.toAsset.startsWith("s")) || 
          (body.toAsset === "USDC" && body.fromAsset.startsWith("s")))) {
      return NextResponse.json({ error: "Exchange must be between USDC and an sAsset (e.g., sBTC)." }, { status: 400 });
    }
    
    let amountFromBigInt: bigint;
    try {
      amountFromBigInt = BigInt(body.amount);
      if (amountFromBigInt <= ZERO) throw new Error("Amount must be positive.");
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "Invalid amount. Must be a positive integer string." }, { status: 400 });
    }
    // --- End Validation ---

    const traderId = authenticatedUser.properties.traderId;
    const { fromAsset, toAsset, mode } = body;

    let oraclePrice: number | null = null;
    let amountToBigInt: bigint;
    let fromAssetDecimals: number;
    let toAssetDecimals: number;

    if (fromAsset === "USDC") { // Buying sAsset with USDC
      const baseSynthSymbol = toAsset.substring(1); // "sBTC" -> "BTC"
      oraclePrice = await getOraclePrice(baseSynthSymbol);
      if (oraclePrice === null) {
        return NextResponse.json({ error: `Oracle price for ${baseSynthSymbol} unavailable.` }, { status: 503 });
      }
      if (oraclePrice <= 0) {
        return NextResponse.json({ error: `Invalid oracle price (${oraclePrice}) for ${baseSynthSymbol}.` }, { status: 500 });
      }
      fromAssetDecimals = USDC_DECIMALS;
      toAssetDecimals = SYNTH_ASSET_DECIMALS[toAsset] || 8; // Default if not in map

      // amountToBigInt = (amountFromBigInt * BigInt(10**toAssetDecimals)) / BigInt(Math.round(oraclePrice * (10**fromAssetDecimals)));
      // To avoid precision loss with BigInt division, multiply by a large factor then divide, or use a bignumber library
      // (USDC amount / price) * 10^toAssetDecimals
      // Example: 100 USDC (100 * 10^6), price 50000 BTC/USDC. sBTC has 8 decimals.
      // (100 * 10^6 / 50000) * 10^8 = (100000000 / 50000) * 10^8 = 2000 * 10^8 = 200000000000 (0.002 sBTC)
      const usdcValueScaled = amountFromBigInt * BigInt(10 ** toAssetDecimals); // Scale USDC amount by target decimals
      const priceScaled = BigInt(Math.round(oraclePrice * (10 ** fromAssetDecimals))); // Scale price by fromAsset decimals
      amountToBigInt = usdcValueScaled / priceScaled;


    } else { // Selling sAsset for USDC (fromAsset starts with "s")
      const baseSynthSymbol = fromAsset.substring(1); // "sBTC" -> "BTC"
      oraclePrice = await getOraclePrice(baseSynthSymbol);
      if (oraclePrice === null) {
        return NextResponse.json({ error: `Oracle price for ${baseSynthSymbol} unavailable.` }, { status: 503 });
      }
       if (oraclePrice <= 0) {
        return NextResponse.json({ error: `Invalid oracle price (${oraclePrice}) for ${baseSynthSymbol}.` }, { status: 500 });
      }
      fromAssetDecimals = SYNTH_ASSET_DECIMALS[fromAsset] || 8;
      toAssetDecimals = USDC_DECIMALS;

      // amountToBigInt = (amountFromBigInt * BigInt(Math.round(oraclePrice * (10**toAssetDecimals)))) / BigInt(10**fromAssetDecimals);
      // (sAsset amount * price) * 10^toAssetDecimals (scaled by fromAssetDecimals)
      // Example: 0.1 sBTC (0.1 * 10^8), price 50000 BTC/USDC. USDC has 6 decimals.
      // (0.1 * 10^8 * 50000) * 10^6 / 10^8 = (10000000 * 50000 / 10^8) * 10^6 = 5000 * 10^6
      const synthValueInUsdcScaled = amountFromBigInt * BigInt(Math.round(oraclePrice * (10 ** toAssetDecimals)));
      amountToBigInt = synthValueInUsdcScaled / BigInt(10 ** fromAssetDecimals);
    }

    if (amountToBigInt <= ZERO) {
      return NextResponse.json({ error: "Calculated exchange amount is zero or less, possibly due to small input amount or price." }, { status: 400 });
    }

    const now = Date.now();
    const pk = pkTraderMode(traderId, mode);

    // Prepare transaction items
    const transactItems = [
      { // Debit fromAsset
        Update: {
          TableName: BALANCES_TABLE_NAME,
          Key: marshall({ pk, sk: skAsset(fromAsset) }),
          UpdateExpression: "SET balance = balance - :amount, updatedAt = :ts",
          ConditionExpression: "attribute_exists(balance) AND balance >= :amount", // Ensure sufficient balance
          ExpressionAttributeValues: marshall({ ":amount": amountFromBigInt, ":ts": now }),
        }
      },
      { // Credit toAsset
        Update: {
          TableName: BALANCES_TABLE_NAME,
          Key: marshall({ pk, sk: skAsset(toAsset) }),
          // If item doesn't exist, set balance to amountTo. Otherwise, add.
          // Also initialize pending to 0 if it's a new balance entry.
          UpdateExpression: "ADD balance :amountTo SET pending = if_not_exists(pending, :zero), updatedAt = :ts",
          ExpressionAttributeValues: marshall({ ":amountTo": amountToBigInt, ":zero": ZERO, ":ts": now }),
        }
      }
    ];

    try {
      await ddb.send(new TransactWriteItemsCommand({ TransactItems: transactItems }));
      
      // For REAL mode, if sASSETs were actual on-chain tokens that users could withdraw,
      // this is where you'd interact with the Vault contract to reflect the DEX's internal accounting change.
      // E.g., if user bought sBTC with USDC:
      // Vault might internally "mint" sBTC (just an accounting update for its total sBTC liability)
      // and "burn" USDC (move it to a different pool or just account for it).
      // But since we're using internal balances, this on-chain step for this specific API is not needed for user balances.

      // Consider logging this exchange event to a separate audit table if required.

      console.log( // This notification won't be seen by API caller, but good for server log
        `Exchange successful: ${body.amount} ${fromAsset} -> ${amountToBigInt.toString()} ${toAsset} for trader ${traderId} in ${mode} mode.`
      );
      // The /api/orders route (and subsequently WebSocketContext) will push balanceUpdate.
      // Or this API can directly publish to SNS for a balanceUpdate. Let's do that for immediate feedback.
      // TODO: Consider if an SNS topic for balance updates triggered by non-trade actions is needed.
      // For now, rely on client to re-fetch balances or on next trade-related balance update.

      return NextResponse.json({
        success: true,
        message: "Exchange successful.",
        fromAsset,
        fromAmount: body.amount,
        toAsset,
        toAmount: amountToBigInt.toString(),
        oraclePriceUsed: oraclePrice,
        mode,
      }, { status: 200 });

    } catch (error: any) {
      if (error.name === 'TransactionCanceledException') {
        // One of the conditions failed, likely insufficient balance
        console.warn(`Synth exchange failed for ${traderId} due to transaction cancellation (likely insufficient balance):`, error.CancellationReasons);
        return NextResponse.json({ error: "Exchange failed: Insufficient balance or concurrent update." }, { status: 400 });
      }
      console.error(`Synth exchange transaction failed for ${traderId}:`, error);
      return NextResponse.json({ error: "Exchange transaction failed." }, { status: 500 });
    }

  } catch (err: any) {
    console.error("POST /api/synths/exchange error:", err);
    return NextResponse.json({ error: "Internal server error during synth exchange." }, { status: 500 });
  }
}