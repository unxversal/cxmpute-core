// src/app/api/paper/faucet/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import {
  DynamoDBClient,
  // UpdateItemCommand as RawUpdateItemCommand, // Not needed if using DocClient consistently
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  UpdateCommandInput, // Explicit import for clarity
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { requireAuth, AuthenticatedUserSubject } from "@/lib/auth";
import type { TradingMode, TraderRecord } from "@/lib/interfaces";
import { ethers } from "ethers";

// Initialize DynamoDB Document Client
const rawDdbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawDdbClient, {
    marshallOptions: { removeUndefinedValues: true }
});

const BALANCES_TABLE_NAME = Resource.BalancesTable.name;
const TRADERS_TABLE_NAME = Resource.TradersTable.name;

// PK Helpers (consistent with auth/index.ts and other modules)
const pkTraderModeBalance = (traderId: string, mode: TradingMode) => `TRADER#${traderId}#${mode.toUpperCase()}`;
const skAssetBalance = (assetSymbol: string) => `ASSET#${assetSymbol.toUpperCase()}`;

// --- Configuration for Faucet ---
const FAUCET_ASSET = "USDC";
const FAUCET_AMOUNT_BASE_UNITS_BIGINT = BigInt("10000000000"); // 10,000 USDC (6 decimals) as BigInt
const PAPER_MODE: TradingMode = "PAPER";
const FAUCET_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
// const FAUCET_COOLDOWN_MS = 1 * 60 * 1000; // For testing: 1 minute
// --------------------------------

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

export async function POST() {
  let authenticatedUser: AuthenticatedUserSubject;
  try {
    authenticatedUser = await requireAuth();
  } catch (authError: any) {
    if (authError instanceof NextResponse) return authError;
    console.error("Paper Faucet API - Authentication Error:", authError.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const authenticatedTraderId = authenticatedUser.properties.traderId;

  if (!authenticatedTraderId) {
      console.error("Paper Faucet API - Missing traderId in authenticated subject.");
      return NextResponse.json({ error: "Authentication context error." }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const now = Date.now();

  try {
    // 1. Fetch Trader Record to check lastFaucetClaimPaper
    const traderGetCommand = new GetCommand({
      TableName: TRADERS_TABLE_NAME,
      Key: { traderId: authenticatedTraderId },
    });
    const traderResult = await docClient.send(traderGetCommand);

    if (!traderResult.Item) {
      console.warn(`Paper Faucet: TraderRecord not found for traderId ${authenticatedTraderId}, though authenticated.`);
      // This case should ideally not happen if auth/index.ts ensures TraderRecord creation.
      // If it does, we might allow the faucet claim and create/update lastFaucetClaimPaper.
      // For now, let's treat it as an issue to investigate, but still allow claim if no record for lastFaucetClaimPaper.
    }
    
    const lastClaimTimestamp = (traderResult.Item as TraderRecord | undefined)?.lastFaucetClaimPaper || 0;

    if (now - lastClaimTimestamp < FAUCET_COOLDOWN_MS) {
      const timeLeftMs = FAUCET_COOLDOWN_MS - (now - lastClaimTimestamp);
      const daysLeft = Math.floor(timeLeftMs / (24 * 60 * 60 * 1000));
      const hoursLeft = Math.floor((timeLeftMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutesLeft = Math.ceil((timeLeftMs % (60 * 60 * 1000)) / (60 * 1000));
      let timeRemainingStr = "";
      if (daysLeft > 0) timeRemainingStr += `${daysLeft}d `;
      if (hoursLeft > 0) timeRemainingStr += `${hoursLeft}h `;
      timeRemainingStr += `${minutesLeft}m`;

      return NextResponse.json(
        { error: `Faucet can only be used once per month. Please try again in approximately ${timeRemainingStr.trim()}.` },
        { status: 429, headers: { 'Access-Control-Allow-Origin': '*' } } // 429 Too Many Requests
      );
    }

    // 2. Add Funds to BalancesTable
    const balancePk = pkTraderModeBalance(authenticatedTraderId, PAPER_MODE);
    const balanceSk = skAssetBalance(FAUCET_ASSET);

    const balanceUpdateInput: UpdateCommandInput = {
      TableName: BALANCES_TABLE_NAME,
      Key: { pk: balancePk, sk: balanceSk },
      UpdateExpression: `
            SET balance = if_not_exists(balance, :zeroB) + :amount, 
                pending = if_not_exists(pending, :zeroP), 
                asset = if_not_exists(asset, :assetSym), 
                updatedAt = :ts, 
                mode = if_not_exists(mode, :paperModeVal)
            `,
      ExpressionAttributeValues: {
        ":amount": FAUCET_AMOUNT_BASE_UNITS_BIGINT,
        ":zeroB": BigInt(0),
        ":zeroP": BigInt(0),
        ":assetSym": FAUCET_ASSET,
        ":ts": now,
        ":paperModeVal": PAPER_MODE,
      },
      ReturnValues: "UPDATED_NEW",
    };
    await docClient.send(new UpdateCommand(balanceUpdateInput));
    console.log(`Paper Faucet: Credited ${FAUCET_AMOUNT_BASE_UNITS_BIGINT.toString()} ${FAUCET_ASSET} to trader ${authenticatedTraderId}.`);

    // 3. Update lastFaucetClaimPaper in TradersTable
    const traderUpdateInput: UpdateCommandInput = {
      TableName: TRADERS_TABLE_NAME,
      Key: { traderId: authenticatedTraderId },
      UpdateExpression: "SET lastFaucetClaimPaper = :nowVal",
      ExpressionAttributeValues: { ":nowVal": now },
      // ConditionExpression: "attribute_exists(traderId)" // Ensure trader item exists
    };
    await docClient.send(new UpdateCommand(traderUpdateInput));
    console.log(`Paper Faucet: Updated lastFaucetClaimPaper for trader ${authenticatedTraderId} to ${now}.`);

    // Calculate display amount (e.g., 10000.00)
    const faucetAmountDisplay = parseFloat(ethers.formatUnits(FAUCET_AMOUNT_BASE_UNITS_BIGINT, 6)); // Assuming 6 decimals for USDC

    return NextResponse.json(
      {
        success: true,
        message: `Successfully added ${faucetAmountDisplay.toFixed(2)} paper ${FAUCET_ASSET} to your account.`,
        traderId: authenticatedTraderId,
        asset: FAUCET_ASSET,
        amountAddedBaseUnits: FAUCET_AMOUNT_BASE_UNITS_BIGINT.toString(),
      },
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error: any) {
    console.error(`Paper Faucet API Error for trader ${authenticatedTraderId}:`, error);
    return NextResponse.json(
      { error: "Internal server error processing faucet request." },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}