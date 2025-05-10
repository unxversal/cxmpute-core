/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/vault/withdraw/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
  ConditionalCheckFailedException,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { requireAuth, AuthenticatedUserSubject } from "@/lib/auth";
import type { TradingMode, Balance as BalanceItem, TraderRecord } from "@/lib/interfaces";

// PK Helpers
const pkTraderMode = (traderId: string, mode: TradingMode) => `TRADER#${traderId}#${mode.toUpperCase()}`;
const skAsset = (asset: string) => `ASSET#${asset.toUpperCase()}`;

/* ─── Environment Variables & Contract Setup ─────────────────────── */
const PEAQ_RPC_URL = "https://peaq.api.onfinality.io/public";
const CHAIN_ID = "3338";
const VAULT_ADDR = Resource.CoreVaultAddress.value;
const SERVER_PK = Resource.CoreWalletPk.value;

if (!PEAQ_RPC_URL || !VAULT_ADDR || !SERVER_PK) {
  console.error("CRITICAL: Missing environment variables for Vault interactions (RPC_URL, VAULT_ADDR, SERVER_PK).");
}

const vaultAbi = [
  "function withdraw(address user, uint256 amount, bool asCxpt)",
  "event Withdrawn(address indexed gateway, address indexed user, uint256 amount, bool asCxpt)"
];

const ddb = new DynamoDBClient({});
const BALANCES_TABLE = Resource.BalancesTable.name;
const TRADERS_TABLE_NAME = Resource.TradersTable.name; // Added

let provider: ethers.JsonRpcProvider | null = null;
let gatewaySigner: ethers.Wallet | null = null;
let vaultContract: ethers.Contract | null = null;

if (PEAQ_RPC_URL && SERVER_PK && VAULT_ADDR) {
    provider = new ethers.JsonRpcProvider(PEAQ_RPC_URL, CHAIN_ID ? +CHAIN_ID : undefined);
    gatewaySigner = new ethers.Wallet(SERVER_PK, provider);
    vaultContract = new ethers.Contract(VAULT_ADDR, vaultAbi, gatewaySigner);
}

/* ───────────────── Utility to get linked wallet ───────────────── */
// (Same function as in deposit/route.ts - consider moving to a shared util file)
async function getLinkedWalletForTrader(internalDEXTraderId: string): Promise<string | null> {
    if (!internalDEXTraderId) {
        console.warn("[getLinkedWalletForTrader] internalDEXTraderId is missing.");
        return null;
    }
    try {
        // console.log(`[getLinkedWalletForTrader] Fetching wallet for traderId: ${internalDEXTraderId}`);
        const { Item } = await ddb.send(
            new GetItemCommand({
                TableName: TRADERS_TABLE_NAME,
                Key: marshall({ traderId: internalDEXTraderId }),
                ProjectionExpression: "walletAddress",
            })
        );
        if (Item) {
            const traderData = unmarshall(Item) as Partial<Pick<TraderRecord, "walletAddress">>;
            if (traderData.walletAddress && ethers.isAddress(traderData.walletAddress)) {
                // console.log(`[getLinkedWalletForTrader] Found wallet: ${traderData.walletAddress} for traderId: ${internalDEXTraderId}`);
                return traderData.walletAddress;
            } else {
                console.warn(`[getLinkedWalletForTrader] walletAddress attribute missing or invalid for traderId: ${internalDEXTraderId}. Found:`, traderData.walletAddress);
                return null;
            }
        } else {
            console.warn(`[getLinkedWalletForTrader] No record found in TradersTable for traderId: ${internalDEXTraderId}`);
            return null;
        }
    } catch (error) {
        console.error(`[getLinkedWalletForTrader] Error fetching wallet for traderId ${internalDEXTraderId}:`, error);
        return null;
    }
}


/* ───────────────── CORS Preflight Handler ───────────────── */
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

/* ───────────────── POST /api/vault/withdraw ───────────────── */
export async function POST(req: NextRequest) {
  if (!vaultContract || !gatewaySigner) {
    console.error("Withdraw API Error: Vault contract or signer not initialized.");
    return NextResponse.json({ error: "Server configuration error for withdrawals." }, { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  let authenticatedUser: AuthenticatedUserSubject;
  try {
    authenticatedUser = await requireAuth();
  } catch (authError) {
    if (authError instanceof NextResponse) return authError;
    console.error("Withdraw API Authentication Error:", authError);
    return NextResponse.json({ error: "Authentication failed." }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const internalDEXTraderId = authenticatedUser.properties.id;

  // Fetch the user's linked wallet address to send funds TO
  const userWalletAddress = await getLinkedWalletForTrader(internalDEXTraderId);
  if (!userWalletAddress) {
      console.warn(`Withdraw API: No linked wallet address found for trader ${internalDEXTraderId} to send funds to.`);
      return NextResponse.json(
          { error: "No Peaq wallet linked to your account. Please link a wallet to receive REAL mode withdrawals." },
          { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
  }

  try {
    const body = (await req.json()) as {
      amount: string;
      asCxpt?: boolean;
      // userWalletAddress is NO LONGER taken from body for security
    };

    if (!body.amount || typeof body.amount !== 'string' || !/^\d+$/.test(body.amount) || BigInt(body.amount) <= BigInt(0)) {
      return NextResponse.json(
        { error: "Valid 'amount' (as string in base units) is required." },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }
    const amountBigInt = BigInt(body.amount);
    const asCxpt = body.asCxpt === true;

    const assetToWithdraw = asCxpt ? "CXPT" : "USDC";
    const balancePk = pkTraderMode(internalDEXTraderId, "REAL");
    const balanceSk = skAsset(assetToWithdraw);

    console.log(`Checking balance for withdrawal: Trader ${internalDEXTraderId}, Asset ${assetToWithdraw}, Amount ${amountBigInt}`);
    const balanceQuery = await ddb.send(new GetItemCommand({
        TableName: BALANCES_TABLE,
        Key: marshall({ pk: balancePk, sk: balanceSk })
    }));

    const currentBalanceItem = balanceQuery.Item ? unmarshall(balanceQuery.Item) as BalanceItem : null;
    const currentBalanceBigInt = BigInt(currentBalanceItem?.balance?.toString() ?? '0');

    if (currentBalanceBigInt < amountBigInt) {
        console.warn(`Insufficient balance for trader ${internalDEXTraderId}. Requested: ${amountBigInt}, Available: ${currentBalanceBigInt}`);
        return NextResponse.json({ error: "Insufficient balance." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    console.log(`Initiating on-chain withdrawal TO ${userWalletAddress}, amount ${amountBigInt}, asCxpt: ${asCxpt}`);
    const tx = await vaultContract.withdraw(userWalletAddress, amountBigInt, asCxpt);
    console.log(`Withdrawal transaction sent: ${tx.hash}. Waiting for confirmation...`);
    const receipt = await tx.wait(1);

    if (receipt.status !== 1) {
        console.error(`On-chain withdrawal transaction failed for ${userWalletAddress}. TxHash: ${tx.hash}`, receipt);
        return NextResponse.json({ error: "On-chain withdrawal transaction failed." }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    console.log(`On-chain withdrawal confirmed for ${userWalletAddress}. TxHash: ${tx.hash}`);

    try {
      await ddb.send(
        new UpdateItemCommand({
          TableName: BALANCES_TABLE,
          Key: marshall({ pk: balancePk, sk: balanceSk }),
          UpdateExpression: "SET balance = balance - :amt, updatedAt = :ts",
          ConditionExpression: "balance >= :amt",
          ExpressionAttributeValues: marshall({
            ":amt": amountBigInt,
            ":ts": Date.now(),
          }),
        })
      );
      console.log(`BalancesTable debited for trader ${internalDEXTraderId}, asset ${assetToWithdraw}.`);
    } catch (dbError: any) {
        if (dbError instanceof ConditionalCheckFailedException) {
            console.error(`CRITICAL: On-chain withdrawal TO ${userWalletAddress} (Tx: ${tx.hash}) succeeded, but BalancesTable debit FAILED due to conditional check. Trader: ${internalDEXTraderId}. Requires RECONCILIATION.`);
            return NextResponse.json(
                { error: "Withdrawal processed on-chain, but off-chain balance update conflict. Please contact support.", txHash: tx.hash },
                { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }
        console.error(`CRITICAL: On-chain withdrawal TO ${userWalletAddress} (Tx: ${tx.hash}) succeeded, but BalancesTable debit FAILED. Trader: ${internalDEXTraderId}:`, dbError);
        return NextResponse.json(
            { error: "Withdrawal processed on-chain, but off-chain balance update failed. Please contact support.", txHash: tx.hash },
            { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }

    return NextResponse.json(
      { success: true, message: "Withdrawal successful and balance updated.", txHash: tx.hash, amountDebited: body.amount, asset: assetToWithdraw },
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (err: any) {
    console.error(`Vault Withdraw API Error for user ${internalDEXTraderId || 'unknown'}:`, err);
    let errorMessage = "Internal server error during withdrawal.";
    if (err.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = "Transaction failed: Insufficient funds for gas.";
    } else if (err.reason) {
        errorMessage = `Transaction failed: ${err.reason}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}