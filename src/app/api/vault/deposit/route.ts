/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/vault/deposit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  DynamoDBClient,
  UpdateItemCommand,
  // For idempotency logging, you might use PutItemCommand with ConditionExpression
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { requireAuth, AuthenticatedUserSubject } from "@/lib/auth"; // Assuming requireAuth provides user's Peaq address
import type { TradingMode } from "@/lib/interfaces";
// Import pk helper if it's centralized, otherwise define locally
// import { pk } from "@/dex/matchers/matchEngine";
const pkTraderMode = (traderId: string, mode: TradingMode) => `TRADER#${traderId}#${mode.toUpperCase()}`;
const skAsset = (asset: string) => `ASSET#${asset.toUpperCase()}`;


/* ─── Environment Variables & Contract Setup ─────────────────────── */

const PEAQ_RPC_URL = "https://peaq.api.onfinality.io/public"
const CHAIN_ID = "3338"
const VAULT_ADDR = Resource.CoreVaultAddress.value
const SERVER_PK = Resource.CoreWalletPk.value;

if (!PEAQ_RPC_URL || !VAULT_ADDR || !SERVER_PK) {
  console.error("CRITICAL: Missing environment variables for Vault interactions (RPC_URL, VAULT_ADDR, SERVER_PK).");
  // This would ideally prevent the server from starting or this route from functioning.
}

// Minimal Vault ABI for the deposit function
const vaultAbi = [
  "function deposit(address user, uint256 amount)",
  // Event for logging/monitoring by other systems, though not used by this API route for balance updates
  "event Deposited(address indexed gateway, address indexed user, uint256 amount)"
];

const ddb = new DynamoDBClient({});
const BALANCES_TABLE = Resource.BalancesTable.name;
// const DEPOSIT_LOG_TABLE = "DepositLogTable"; // Optional: for robust idempotency

// Initialize provider and signer
let provider: ethers.JsonRpcProvider | null = null;
let gatewaySigner: ethers.Wallet | null = null;
let vaultContract: ethers.Contract | null = null;

if (PEAQ_RPC_URL && SERVER_PK && VAULT_ADDR) {
    provider = new ethers.JsonRpcProvider(PEAQ_RPC_URL, CHAIN_ID ? +CHAIN_ID : undefined);
    gatewaySigner = new ethers.Wallet(SERVER_PK, provider);
    vaultContract = new ethers.Contract(VAULT_ADDR, vaultAbi, gatewaySigner);
}


/* ───────────────── CORS Preflight Handler ───────────────── */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization", // Assuming your requireAuth checks Authorization
    },
  });
}

/* ───────────────── POST /api/vault/deposit ───────────────── */
export async function POST(req: NextRequest) {
  if (!vaultContract || !gatewaySigner) {
    console.error("Deposit API Error: Vault contract or signer not initialized due to missing env vars.");
    return NextResponse.json({ error: "Server configuration error for deposits." }, { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  let authenticatedUser: AuthenticatedUserSubject;
  try {
    // requireAuth should verify the JWT/session and return user details including their Peaq address
    // For this example, let's assume `authenticatedUser.properties.id` is the Peaq wallet address.
    // And `authenticatedUser.properties.traderId` (or a mapping) is the internal DEX traderId.
    // Let's assume for now `requireAuth` gives us an object where `id` is the on-chain address.
    // We'll use `email` or another unique ID from the subject as the `traderId` for the off-chain `BalancesTable`.
    // This needs to be consistent with how `traderId` is defined elsewhere (e.g., in `TradersTable`).
    authenticatedUser = await requireAuth(); // This must give us the user's on-chain address
                                                // and a unique ID for off-chain systems.
    // If your user subject from `requireAuth` doesn't directly contain the Peaq wallet address,
    // you'll need a way to look it up based on the authenticated user.
    // For now, let's assume authenticatedUser.properties.id is the user's on-chain wallet address
    // and authenticatedUser.properties.email (or another stable ID) is used as the internal traderId.

  } catch (authError) {
    // requireAuth should throw NextResponse on failure
    if (authError instanceof NextResponse) return authError;
    console.error("Deposit API Authentication Error:", authError);
    return NextResponse.json({ error: "Authentication failed." }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  // The user's Peaq wallet address from which USDC will be transferred
  // This needs to be reliably obtained from the authenticated session.
  // For this example, assuming subject.id from OpenAuth is NOT the wallet address.
  // This part is CRITICAL: you need a secure way to map your authenticated user (e.g. subject.properties.id)
  // to their on-chain Peaq wallet address that holds the USDC and made the approval.
  // If the user logs in with email, and their wallet is linked elsewhere, fetch it.
  // For now, I will use a placeholder. YOU MUST REPLACE THIS with actual logic.
  // const userWalletAddress = authenticatedUser.properties.userAk; // Placeholder: userAk might be their wallet address or you need to map it
  const internalDEXTraderId = authenticatedUser.properties.id; // This is the `userId` from UserTable

  try {
    const body = (await req.json()) as {
      amount: string; // Raw units string, e.g., "1000000" for 1 USDC if 6 decimals
      userWalletAddress: string;
      // depositRequestId?: string; // Optional: for client-side idempotency tracking
    };

    if (!body.amount || typeof body.amount !== 'string' || !/^\d+$/.test(body.amount) || BigInt(body.amount) <= BigInt(0)) {
      return NextResponse.json(
        { error: "Valid 'amount' (as string in base units) is required." },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }
    const amountBigInt = BigInt(body.amount);

    const userWalletAddress = body.userWalletAddress;

    if (!ethers.isAddress(userWalletAddress)) {
      console.error(`Deposit API Error: Invalid or missing user wallet address for authenticated user ${internalDEXTraderId}. Retrieved: ${userWalletAddress}`);
      return NextResponse.json({ error: "User wallet address not configured or invalid." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // Optional: Idempotency check using depositRequestId or txHash for BalancesTable update
    // This would involve checking a log table before proceeding with Vault call or DB update.

    console.log(`Processing deposit for user wallet: ${userWalletAddress}, internal traderId: ${internalDEXTraderId}, amount: ${amountBigInt.toString()}`);

    // 1. Call Vault.deposit function
    //    `userWalletAddress` is the account the USDC is transferred FROM.
    //    `gatewaySigner` (SERVER_PK with GATEWAY_ROLE) is the `msg.sender` to the Vault.
    //    The Vault's `deposit` function will execute `usdc.transferFrom(userWalletAddress, vaultAddress, amount)`.
    //    This requires `userWalletAddress` to have approved `VAULT_ADDR` to spend USDC.
    const tx = await vaultContract.deposit(userWalletAddress, amountBigInt);
    console.log(`Deposit transaction sent: ${tx.hash}. Waiting for confirmation...`);
    const receipt = await tx.wait(1); // Wait for 1 confirmation

    if (receipt.status !== 1) {
        console.error(`On-chain deposit transaction failed for ${userWalletAddress}. TxHash: ${tx.hash}`, receipt);
        // Optionally log to a failed transactions table
        return NextResponse.json({ error: "On-chain deposit transaction failed." }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    console.log(`On-chain deposit confirmed for ${userWalletAddress}. TxHash: ${tx.hash}`);

    // 2. Update BalancesTable for REAL mode (Authoritative Update)
    const balancePk = pkTraderMode(internalDEXTraderId, "REAL");
    const balanceSk = skAsset("USDC"); // Assuming USDC deposits

    try {
      await ddb.send(
        new UpdateItemCommand({
          TableName: BALANCES_TABLE,
          Key: marshall({ pk: balancePk, sk: balanceSk }),
          UpdateExpression: "ADD balance :amt SET pending = if_not_exists(pending, :zero), updatedAt = :ts",
          ExpressionAttributeValues: marshall({
            ":amt": amountBigInt, // Use BigInt for ADD
            ":zero": BigInt(0),
            ":ts": Date.now(),
          }),
          // Optional: ConditionExpression to prevent re-crediting if using an idempotency key / txHash check
          // ConditionExpression: "attribute_not_exists(processedTxHashes.#txHash)"
          // ExpressionAttributeNames: {"#txHash": tx.hash} // If storing txHash in a map
        })
      );
      console.log(`BalancesTable updated for trader ${internalDEXTraderId}, REAL mode, asset USDC.`);
    } catch (dbError) {
      console.error(`CRITICAL: On-chain deposit for ${userWalletAddress} (Tx: ${tx.hash}) succeeded, but BalancesTable update FAILED for trader ${internalDEXTraderId}:`, dbError);
      // This is a critical state. The user's funds are in the Vault, but not reflected off-chain.
      // Requires manual intervention or a reconciliation process.
      // Respond with an error indicating potential inconsistency.
      return NextResponse.json(
        { error: "Deposit confirmed on-chain, but off-chain balance update failed. Please contact support.", txHash: tx.hash },
        { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return NextResponse.json(
      { success: true, message: "Deposit successful and balance updated.", txHash: tx.hash, amountCredited: body.amount },
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (err: any) {
    console.error(`Vault Deposit API Error for user ${authenticatedUser?.properties.id || 'unknown'}:`, err);
    let errorMessage = "Internal server error during deposit.";
    if (err.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = "Transaction failed: Insufficient funds for gas.";
    } else if (err.reason) { // Ethers.js often includes a 'reason'
        errorMessage = `Transaction failed: ${err.reason}`;
    } else if (typeof err.message === 'string' && err.message.includes('transfer amount exceeds allowance')) {
        errorMessage = "USDC allowance insufficient. Please approve the Vault contract to spend your USDC.";
    }
    return NextResponse.json({ error: errorMessage }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}