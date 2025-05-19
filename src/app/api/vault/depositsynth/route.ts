// src/app/api/vault/depositSynth/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers"; // Using ethers v6
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
    DynamoDBDocumentClient, 
    UpdateCommand, 
    UpdateCommandInput,
    GetCommand // For fetching linked wallet if not directly on auth subject
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { requireAuth, AuthenticatedUserSubject } from "@/lib/auth";
import type { TradingMode } from "@/lib/interfaces"; // Assuming TraderRecord for fetching wallet

// --- Configuration & Contract Setup ---
const PEAQ_RPC_URL = "https://peaq.api.onfinality.io/public";
const CHAIN_ID = "3338"; // Ensure this is a string if from env
const VAULT_ADDR = Resource.CoreVaultAddress.value;
const SERVER_PK = Resource.CoreWalletPk.value; // Backend's private key (CORE_ROLE on Vault)
const FACTORY_ADDR = Resource.CoreFactoryAddress.value;

if (!PEAQ_RPC_URL || !SERVER_PK || !VAULT_ADDR || !FACTORY_ADDR) {
  console.error("CRITICAL: depositSynth API - Missing environment variables for Vault/Factory interaction.");
}

// ABIs
const vaultAbi = [
    // function depositSynth(address userAddress, address synthContract, uint256 amount) external
    // Corrected: Matches the Vault.sol provided: depositSynthToVault
    "function depositSynthToVault(address userAddress, address synthContract, uint256 amount) external", 
    "event SynthDepositedToVault(address indexed userWallet, address indexed synthContract, uint256 sAssetAmount)"
];
const factoryAbi = ["function getSynthBySymbol(string calldata symbol) external view returns (address synthContract)"];
const erc20AbiMinimal = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)" // To fetch decimals if not hardcoded
];

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const BALANCES_TABLE_NAME = Resource.BalancesTable.name;
const TRADERS_TABLE_NAME = Resource.TradersTable.name; // To fetch linked wallet

let provider: ethers.JsonRpcProvider | null = null;
let coreSigner: ethers.Wallet | null = null;
let vaultContractAsCore: ethers.Contract | null = null;
let factoryContract: ethers.Contract | null = null;

if (PEAQ_RPC_URL && SERVER_PK && VAULT_ADDR && FACTORY_ADDR) {
    try {
        provider = new ethers.JsonRpcProvider(PEAQ_RPC_URL, CHAIN_ID ? parseInt(CHAIN_ID) : undefined);
        coreSigner = new ethers.Wallet(SERVER_PK, provider);
        vaultContractAsCore = new ethers.Contract(VAULT_ADDR, vaultAbi, coreSigner);
        factoryContract = new ethers.Contract(FACTORY_ADDR, factoryAbi, provider); // Factory can be read-only via provider
    } catch (e) {
        console.error("Failed to initialize ethers providers/contracts in depositSynth:", e);
        // This will cause the `if (!vaultContractAsCore ...)` check to fail later
    }
}

// Local Asset Decimals - In a real app, this might come from a config or MarketMeta
const SYNTH_ASSET_DECIMALS_LOCAL: Record<string, number> = {
    "SBTC": 8, "SETH": 8, "SPEAQ": 18, "SAVAX": 8, "SSOL": 9, 
    "SBNB": 8, "SNEAR": 24, "SOP": 18, "SDOT": 10,
};
const getAssetDecimalsLocal = (assetSymbol: string): number => {
    return SYNTH_ASSET_DECIMALS_LOCAL[assetSymbol.toUpperCase()] || 8; // Fallback, consider erroring if not found
};

const pkTraderBalanceKey = (traderId: string, mode: TradingMode) => `TRADER#${traderId}#${mode.toUpperCase()}`;
const skAssetBalanceKey = (assetSymbol: string) => `ASSET#${assetSymbol.toUpperCase()}`;

async function getLinkedWalletAddress(traderId: string): Promise<string | null> {
    if (!traderId) return null;
    try {
        const command = new GetCommand({
            TableName: TRADERS_TABLE_NAME,
            Key: { traderId: traderId },
            ProjectionExpression: "walletAddress"
        });
        const { Item } = await docClient.send(command);
        if (Item && Item.walletAddress && ethers.isAddress(Item.walletAddress)) {
            return Item.walletAddress;
        }
        console.warn(`getLinkedWalletAddress: No valid walletAddress found for traderId ${traderId}`);
        return null;
    } catch (error) {
        console.error(`getLinkedWalletAddress: Error fetching wallet for traderId ${traderId}:`, error);
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
    if (!vaultContractAsCore || !coreSigner || !factoryContract || !provider) {
        console.error("depositSynth API: Server contracts not initialized.");
        return NextResponse.json({ error: "Server configuration error for synth deposits." }, { status: 503 });
    }

    let authenticatedUser: AuthenticatedUserSubject;
    try {
        authenticatedUser = await requireAuth();
    } catch (authError: any) {
        return authError instanceof NextResponse ? authError : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const internalDEXTraderId = authenticatedUser.properties.traderId; // This is the PK of TradersTable
    const userWalletAddress = authenticatedUser.properties.walletAddress || await getLinkedWalletAddress(internalDEXTraderId);

    if (!userWalletAddress || !ethers.isAddress(userWalletAddress)) {
        return NextResponse.json({ error: "User's Peaq wallet not linked or invalid. Please link your wallet first via your profile." }, { status: 400 });
    }

    try {
        const body = await req.json() as { synthSymbol: string; amount: string; mode: TradingMode };
        if (!body.synthSymbol || !body.amount || !body.mode || body.mode !== "REAL") {
            return NextResponse.json({ error: "Missing/invalid fields: synthSymbol (e.g. sBTC), amount (base units string), or mode (must be REAL)" }, { status: 400 });
        }
        if (!body.synthSymbol.startsWith("s")) {
            return NextResponse.json({ error: "Only sASSETs (e.g., sBTC) can be deposited via this route." }, { status: 400 });
        }

        const sAssetDecimals = getAssetDecimalsLocal(body.synthSymbol);
        let amountBigInt: bigint;
        try {
            amountBigInt = ethers.parseUnits(body.amount, sAssetDecimals);
        } catch (e) {
            return NextResponse.json({ error: `Invalid amount format for ${body.synthSymbol}. Expected up to ${sAssetDecimals} decimals as a string.` }, { status: 400 });
        }

        if (amountBigInt <= BigInt(0)) {
            return NextResponse.json({ error: "Amount must be positive." }, { status: 400 });
        }

        const synthContractAddress = await factoryContract.getSynthBySymbol(body.synthSymbol);
        if (!synthContractAddress || synthContractAddress === ethers.ZeroAddress) {
            return NextResponse.json({ error: `Synth contract for ${body.synthSymbol} not found or not registered with Factory.` }, { status: 404 });
        }

        // Check user's allowance for the Vault on the sAssetContract
        const sAssetContract = new ethers.Contract(synthContractAddress, erc20AbiMinimal, provider);
        const allowance: bigint = await sAssetContract.allowance(userWalletAddress, VAULT_ADDR);
        if (allowance < amountBigInt) {
             return NextResponse.json({ 
                error: `Insufficient allowance. Vault requires approval to spend ${ethers.formatUnits(amountBigInt, sAssetDecimals)} ${body.synthSymbol} from your wallet. Current allowance: ${ethers.formatUnits(allowance, sAssetDecimals)}.`,
                needsApproval: true,
                tokenToApprove: synthContractAddress,
                spenderAddress: VAULT_ADDR,
                requiredAmountFormatted: ethers.formatUnits(amountBigInt, sAssetDecimals),
                requiredAmountBaseUnits: amountBigInt.toString()
            }, { status: 400 }); // 400 Bad Request or 403 Forbidden could also be used
        }
        
        // Backend (CORE_ROLE via coreSigner) calls Vault.depositSynthToVault
        const tx = await vaultContractAsCore.depositSynthToVault(userWalletAddress, synthContractAddress, amountBigInt);
        console.log(`SynthDeposit API: Transaction sent for ${body.synthSymbol} from ${userWalletAddress} to Vault. TxHash: ${tx.hash}`);
        const receipt = await tx.wait(1); // Wait for 1 confirmation

        if (receipt.status !== 1) {
            console.error(`SynthDeposit API: On-chain depositSynthToVault transaction failed for ${userWalletAddress}, synth ${body.synthSymbol}. TxHash: ${tx.hash}`, receipt);
            throw new Error(`On-chain synth deposit transaction failed (Tx: ${tx.hash}).`);
        }
        console.log(`SynthDeposit API: On-chain depositSynthToVault confirmed for ${userWalletAddress}, synth ${body.synthSymbol}. TxHash: ${tx.hash}`);

        // Atomically update the user's internal BalancesTable
        const balancePk = pkTraderBalanceKey(internalDEXTraderId, "REAL");
        const balanceSk = skAssetBalanceKey(body.synthSymbol);
        try {
            const balanceUpdateInput: UpdateCommandInput = {
                TableName: BALANCES_TABLE_NAME,
                Key: { pk: balancePk, sk: balanceSk },
                UpdateExpression: "SET balance = if_not_exists(balance, :zeroB) + :amt, pending = if_not_exists(pending, :zeroP), asset = if_not_exists(asset, :assetSym), updatedAt = :ts, mode = if_not_exists(mode, :modeReal)",
                ExpressionAttributeValues: {
                    ":amt": amountBigInt, 
                    ":zeroB": BigInt(0),
                    ":zeroP": BigInt(0),
                    ":assetSym": body.synthSymbol, 
                    ":ts": Date.now(),
                    ":modeReal": "REAL" as TradingMode
                },
                ReturnValues: "UPDATED_NEW"
            };
            await docClient.send(new UpdateCommand(balanceUpdateInput));
            console.log(`SynthDeposit API: BalancesTable updated for trader ${internalDEXTraderId}, asset ${body.synthSymbol}.`);
        } catch (dbError: any) {
            console.error(`CRITICAL: SynthDeposit API: On-chain deposit for ${userWalletAddress} (Tx: ${tx.hash}) succeeded, but BalancesTable update FAILED for trader ${internalDEXTraderId}, synth ${body.synthSymbol}:`, dbError);
            // This requires manual reconciliation. Return error but acknowledge on-chain success.
            return NextResponse.json({ error: "Synth deposit confirmed on-chain, but off-chain balance update failed. Please contact support.", txHash: tx.hash, onChainSuccess: true }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            message: "Synth deposited successfully and internal DEX balance updated.", 
            txHash: tx.hash, 
            depositedAsset: body.synthSymbol, 
            amountDepositedInBaseUnits: amountBigInt.toString(),
            amountDepositedFormatted: ethers.formatUnits(amountBigInt, sAssetDecimals)
        }, { status: 200 });

    } catch (err: any) {
        console.error("SynthDeposit API Outer Error:", err);
        let errorMessage = "Internal server error during synth deposit.";
        if (err.code === 'INSUFFICIENT_FUNDS' && typeof err.message === 'string') errorMessage = "Transaction failed: Insufficient funds for gas on your wallet.";
        else if (err.reason && typeof err.reason === 'string') errorMessage = `Transaction failed: ${err.reason}`;
        else if (err.message && typeof err.message === 'string') errorMessage = err.message;
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}