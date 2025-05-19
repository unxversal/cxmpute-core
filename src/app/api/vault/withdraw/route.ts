// src/app/api/vault/withdraw/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { 
    DynamoDBClient, 
} from "@aws-sdk/client-dynamodb";
import { 
    DynamoDBDocumentClient, 
    UpdateCommand, 
    GetCommand,
    UpdateCommandInput // For explicit typing
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { requireAuth, AuthenticatedUserSubject } from "@/lib/auth";
import type { TradingMode } from "@/lib/interfaces";

// --- Configuration & Contract Setup ---
const PEAQ_RPC_URL = "https://peaq.api.onfinality.io/public";
const CHAIN_ID = "3338";
const VAULT_ADDR = Resource.CoreVaultAddress.value;
const SERVER_PK = Resource.CoreWalletPk.value; // Backend's private key (CORE_ROLE on Vault)
const FACTORY_ADDR = Resource.CoreFactoryAddress.value;

if (!PEAQ_RPC_URL || !SERVER_PK || !VAULT_ADDR || !FACTORY_ADDR) {
  console.error("CRITICAL: Withdraw API - Missing environment variables for Vault/Factory interaction.");
}

const vaultAbi = [
    "function withdraw(address userWallet, uint256 amount, bool withdrawAsCxpt) external",
    "function withdrawSynthFromVault(address userWallet, address synthContract, uint256 amount) external",
    // Events (not strictly needed by this API route but good for contract)
    "event WithdrawnUSDC(address indexed coreAddress, address indexed userWallet, uint256 usdcAmount)",
    "event WithdrawnCXPT(address indexed coreAddress, address indexed userWallet, uint256 cxptAmount)",
    "event SynthWithdrawnFromVault(address indexed coreAddress, address indexed userWallet, address indexed synthContract, uint256 sAssetAmount)"
];
const factoryAbi = ["function getSynthBySymbol(string calldata symbol) external view returns (address synthContract)"];

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const BALANCES_TABLE_NAME = Resource.BalancesTable.name;
const TRADERS_TABLE_NAME = Resource.TradersTable.name;

let provider: ethers.JsonRpcProvider | null = null;
let coreSigner: ethers.Wallet | null = null;
let vaultContractAsCore: ethers.Contract | null = null;
let factoryContract: ethers.Contract | null = null;

if (PEAQ_RPC_URL && SERVER_PK && VAULT_ADDR && FACTORY_ADDR) {
    try {
        provider = new ethers.JsonRpcProvider(PEAQ_RPC_URL, CHAIN_ID ? parseInt(CHAIN_ID) : undefined);
        coreSigner = new ethers.Wallet(SERVER_PK, provider);
        vaultContractAsCore = new ethers.Contract(VAULT_ADDR, vaultAbi, coreSigner);
        factoryContract = new ethers.Contract(FACTORY_ADDR, factoryAbi, provider);
    } catch (e) {
        console.error("Failed to initialize ethers providers/contracts in withdraw API:", e);
    }
}

// Local Asset Decimals - ensure consistency with other parts of your application
const USDC_DECIMALS_LOCAL = 6;
const SYNTH_ASSET_DECIMALS_LOCAL: Record<string, number> = {
    "SBTC": 8, "SETH": 8, "SPEAQ": 18, "SAVAX": 8, "SSOL": 9, 
    "SBNB": 8, "SNEAR": 24, "SOP": 18, "SDOT": 10, "CXPT": 18
};
const getAssetDecimalsLocal = (assetSymbol: string): number => {
    if (!assetSymbol) return USDC_DECIMALS_LOCAL;
    const upperAsset = assetSymbol.toUpperCase();
    if (upperAsset === "USDC") return USDC_DECIMALS_LOCAL;
    return SYNTH_ASSET_DECIMALS_LOCAL[upperAsset] || 8; // Fallback
};

const pkTraderBalanceKey = (traderId: string, mode: TradingMode) => `TRADER#${traderId}#${mode.toUpperCase()}`;
const skAssetBalanceKey = (assetSymbol: string) => `ASSET#${assetSymbol.toUpperCase()}`;

async function getLinkedWalletAddress(traderId: string): Promise<string | null> {
    if (!traderId) return null;
    try {
        const command = new GetCommand({
            TableName: TRADERS_TABLE_NAME, Key: { traderId: traderId }, ProjectionExpression: "walletAddress"
        });
        const { Item } = await docClient.send(command);
        if (Item && Item.walletAddress && ethers.isAddress(Item.walletAddress)) {
            return Item.walletAddress;
        }
        console.warn(`getLinkedWalletAddress (Withdraw): No valid walletAddress for traderId ${traderId}`);
        return null;
    } catch (error) {
        console.error(`getLinkedWalletAddress (Withdraw): Error for traderId ${traderId}:`, error);
        return null;
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: {
        "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }});
}

export async function POST(req: NextRequest) {
    if (!vaultContractAsCore || !coreSigner || !factoryContract) {
        console.error("Withdraw API: Server contracts not initialized.");
        return NextResponse.json({ error: "Server configuration error for withdrawals." }, { status: 503 });
    }

    let authenticatedUser: AuthenticatedUserSubject;
    try {
        authenticatedUser = await requireAuth();
    } catch (authError: any) {
        return authError instanceof NextResponse ? authError : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const internalDEXTraderId = authenticatedUser.properties.traderId; // Use traderId from subject
    const userWalletAddress = authenticatedUser.properties.walletAddress || await getLinkedWalletAddress(internalDEXTraderId);

    if (!userWalletAddress) {
        return NextResponse.json({ error: "No Peaq wallet linked to your account for REAL mode withdrawals. Please link your wallet." }, { status: 400 });
    }

    let body: { assetSymbol: string; amount: string; mode: TradingMode };
    try {
        body = await req.json();
        if (!body.assetSymbol || !body.amount || !body.mode || body.mode !== "REAL") {
            return NextResponse.json({ error: "Missing/invalid fields: assetSymbol, amount (base units string), or mode (must be REAL)" }, { status: 400 });
        }
    } catch {
        return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    
    const { assetSymbol, amount: amountStr } = body;
    const assetDecimals = getAssetDecimalsLocal(assetSymbol);
    let amountBigInt: bigint;
    try {
        amountBigInt = ethers.parseUnits(amountStr, assetDecimals);
    } catch {
        return NextResponse.json({ error: `Invalid amount format for ${assetSymbol}. Expected up to ${assetDecimals} decimals as a string.` }, { status: 400 });
    }

    if (amountBigInt <= BigInt(0)) {
        return NextResponse.json({ error: "Amount must be positive." }, { status: 400 });
    }

    const balancePk = pkTraderBalanceKey(internalDEXTraderId, "REAL");
    const balanceSk = skAssetBalanceKey(assetSymbol);

    // Step 1: Atomically DEBIT internal balance first
    console.log(`Withdraw API: Attempting to debit internal balance for ${internalDEXTraderId}, Asset: ${assetSymbol}, Amount: ${amountStr}`);
    try {
        const debitInput: UpdateCommandInput = {
            TableName: BALANCES_TABLE_NAME,
            Key: { pk: balancePk, sk: balanceSk },
            UpdateExpression: "SET balance = balance - :amt, updatedAt = :ts",
            ConditionExpression: "attribute_exists(balance) AND balance >= :amt",
            ExpressionAttributeValues: { ":amt": amountBigInt, ":ts": Date.now() },
            ReturnValues: "UPDATED_OLD" // To get the balance before debit for logging or revert
        };
        await docClient.send(new UpdateCommand(debitInput));
        console.log(`Withdraw API: Internal balance successfully debited for ${internalDEXTraderId}, Asset: ${assetSymbol}.`);
    } catch (dbError: any) {
        if (dbError.name === 'ConditionalCheckFailedException') {
            console.warn(`Withdraw API: Insufficient internal balance for ${internalDEXTraderId}, Asset: ${assetSymbol}, Amount: ${amountStr}.`);
            return NextResponse.json({ error: `Insufficient ${assetSymbol} balance in your DEX account.` }, { status: 400 });
        }
        console.error(`Withdraw API: Error debiting internal balance for ${internalDEXTraderId}, Asset: ${assetSymbol}:`, dbError);
        return NextResponse.json({ error: "Failed to debit internal balance before on-chain withdrawal. Please try again." }, { status: 500 });
    }

    // Step 2: Perform On-Chain Withdrawal
    let txResponse;
    let txHash: string | undefined;
    console.log(`Withdraw API: Initiating on-chain transfer of ${amountStr} ${assetSymbol} to ${userWalletAddress}`);
    try {
        if (assetSymbol === `USDC`) {
            txResponse = await vaultContractAsCore.withdraw(userWalletAddress, amountBigInt, false);
        } else if (assetSymbol === "CXPT") {
            txResponse = await vaultContractAsCore.withdraw(userWalletAddress, amountBigInt, true);
        } else if (assetSymbol.startsWith("s")) { // sASSET withdrawal
            const synthContractAddress = await factoryContract.getSynthBySymbol(assetSymbol);
            if (!synthContractAddress || synthContractAddress === ethers.ZeroAddress) {
                throw new Error(`Synth contract address for ${assetSymbol} not found via factory.`);
            }
            txResponse = await vaultContractAsCore.withdrawSynthFromVault(userWalletAddress, synthContractAddress, amountBigInt);
        } else {
            throw new Error(`Unsupported asset for withdrawal: ${assetSymbol}`);
        }
        txHash = txResponse.hash;
        console.log(`Withdraw API: Transaction sent for ${assetSymbol} to ${userWalletAddress}. TxHash: ${txHash}`);
        const receipt = await txResponse.wait(1); // Wait for 1 confirmation
        if (receipt.status !== 1) {
            throw new Error(`On-chain withdrawal transaction failed (Tx: ${txHash}). Status: ${receipt.status}`);
        }
        console.log(`Withdraw API: On-chain withdrawal confirmed for ${assetSymbol} to ${userWalletAddress}. TxHash: ${txHash}`);
        
        // On-chain success, internal debit already done.
        return NextResponse.json({ 
            success: true, 
            message: "Withdrawal successful. Funds sent to your linked wallet.", 
            txHash, 
            withdrawnAsset: assetSymbol, 
            amountWithdrawnBaseUnits: amountBigInt.toString(),
            amountWithdrawnFormatted: ethers.formatUnits(amountBigInt, assetDecimals)
        }, { status: 200 });

    } catch (onChainError: any) {
        console.error(`CRITICAL: Withdraw API: On-chain withdrawal FAILED for ${internalDEXTraderId}, Asset: ${assetSymbol}, Amount: ${amountStr}, To: ${userWalletAddress}. TxHash (if any): ${txHash}. Error: ${onChainError.message}`, onChainError);
        
        // Attempt to REVERT internal balance debit
        console.log(`Withdraw API: Attempting to revert internal balance debit for ${internalDEXTraderId}, Asset: ${assetSymbol} due to on-chain failure.`);
        try {
            const revertInput: UpdateCommandInput = {
                TableName: BALANCES_TABLE_NAME,
                Key: { pk: balancePk, sk: balanceSk },
                UpdateExpression: "SET balance = balance + :amt, updatedAt = :ts", // Add back
                ExpressionAttributeValues: { ":amt": amountBigInt, ":ts": Date.now() },
            };
            await docClient.send(new UpdateCommand(revertInput));
            console.log(`Withdraw API: Internal balance debit REVERTED for ${internalDEXTraderId}, Asset: ${assetSymbol}.`);
        } catch (revertError: any) {
            console.error(`CRITICAL FAILURE: Withdraw API: On-chain withdrawal FAILED AND internal balance debit REVERT FAILED for ${internalDEXTraderId}, Asset: ${assetSymbol}. REQUIRES MANUAL RECONCILIATION. Revert Error: ${revertError.message}`);
            // This is the worst-case scenario. Alert administrators immediately.
            // The error message to the user should reflect the on-chain failure but also hint that support might be needed.
             return NextResponse.json({ error: `On-chain withdrawal failed. Internal balance adjustment failed to revert. Please contact support immediately with TxID (if available: ${txHash}) and OrderID (if related).` }, { status: 500 });
        }
        
        let errorMessage = `On-chain withdrawal failed: ${onChainError.reason || onChainError.message || "Unknown on-chain error."}. Your internal DEX balance has been restored.`;
        if (onChainError.code === 'INSUFFICIENT_FUNDS') errorMessage = "On-chain transaction failed: Insufficient funds in Vault for gas or withdrawal amount.";
        
        return NextResponse.json({ error: errorMessage, txHashAttempted: txHash }, { status: 500 });
    }
}