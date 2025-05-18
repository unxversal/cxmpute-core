// src/app/api/synths/exchange/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers"; // Using ethers v6
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb"; // For PricesTable
import { Resource } from "sst";
import { requireAuth, AuthenticatedUserSubject } from "@/lib/auth";
import type { TradingMode, PriceSnapshot } from "@/lib/interfaces";

// --- Configuration & Contract Setup ---
const PEAQ_RPC_URL = process.env.PEAQ_RPC_URL || "https://peaq.api.onfinality.io/public";
const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || "3338";
const VAULT_ADDR = Resource.CoreVaultAddress.value;
const SERVER_PK = Resource.CoreWalletPk.value; // Backend's private key (CORE_ROLE on Vault)
const FACTORY_ADDR = Resource.CoreFactoryAddress.value;
const USDC_CONTRACT_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || "0xbba60da06c2c5424f03f7434542280fcad453d10"; // Actual USDC on Peaq

if (!PEAQ_RPC_URL || !SERVER_PK || !VAULT_ADDR || !FACTORY_ADDR || !USDC_CONTRACT_ADDR || USDC_CONTRACT_ADDR === "0xReplaceWithActualUSDConPeaqAddress") {
  console.error("CRITICAL: SynthExchange API - Missing environment variables for Vault/Factory/USDC interaction.");
}

// ABIs
const vaultExchangeAbi = [
    "function exchangeUSDCToSAsset(address userWallet, address sAssetContract, uint256 usdcAmountToSpend, uint256 sAssetAmountToMint) external returns (uint256)",
    "function exchangeSAssetToUSDC(address userWallet, address sAssetContract, uint256 sAssetAmountToSpend, uint256 usdcAmountToCredit) external returns (uint256)",
    "event USDCToSAssetExchanged(address indexed coreAddress, address indexed userWallet, address indexed sAssetContract, uint256 usdcAmountSpent, uint256 sAssetAmountMinted)",
    "event SAssetToUSDCExchanged(address indexed coreAddress, address indexed userWallet, address indexed sAssetContract, uint256 sAssetAmountBurned, uint256 usdcAmountReceived)"
];
const factoryAbiMinimal = ["function getSynthBySymbol(string calldata symbol) external view returns (address synthContract)"];
const erc20AbiMinimal = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)" // Standard ERC20 decimals function
];

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const PRICES_TABLE_NAME = Resource.PricesTable.name;
const TRADERS_TABLE_NAME = Resource.TradersTable.name; // To fetch linked wallet

let provider: ethers.JsonRpcProvider | null = null;
let coreSigner: ethers.Wallet | null = null;
let vaultContractForExchange: ethers.Contract | null = null;
let factoryContractForExchange: ethers.Contract | null = null;

if (PEAQ_RPC_URL && SERVER_PK && VAULT_ADDR && FACTORY_ADDR && USDC_CONTRACT_ADDR && USDC_CONTRACT_ADDR !== "0xReplaceWithActualUSDConPeaqAddress") {
    try {
        provider = new ethers.JsonRpcProvider(PEAQ_RPC_URL, CHAIN_ID ? parseInt(CHAIN_ID) : undefined);
        coreSigner = new ethers.Wallet(SERVER_PK, provider);
        vaultContractForExchange = new ethers.Contract(VAULT_ADDR, vaultExchangeAbi, coreSigner);
        factoryContractForExchange = new ethers.Contract(FACTORY_ADDR, factoryAbiMinimal, provider);
    } catch(e) {
        console.error("Failed to initialize ethers providers/contracts in synthExchange:", e);
    }
}

const USDC_DECIMALS = 6; // Standard
const SYNTH_ASSET_DECIMALS_EX: Record<string, number> = {
    "SBTC": 8, "SETH": 8, "SPEAQ": 18, "SAVAX": 8, "SSOL": 9, 
    "SBNB": 8, "SNEAR": 24, "SOP": 18, "SDOT": 10,
};
const getAssetDecimalsExchange = (assetSymbol: string | undefined): number => {
    if (!assetSymbol) return USDC_DECIMALS;
    const upperAsset = assetSymbol.toUpperCase();
    if (upperAsset === "USDC") return USDC_DECIMALS;
    return SYNTH_ASSET_DECIMALS_EX[upperAsset] || 8; // Fallback to 8 if not defined
};
const pkPriceAsset = (assetSymbol: string) => `ASSET#${assetSymbol.toUpperCase()}`;

async function getOraclePriceForExchange(baseAssetSymbol: string): Promise<number | null> {
    const assetKey = baseAssetSymbol.startsWith("s") ? baseAssetSymbol.substring(1) : baseAssetSymbol;
    try {
        const queryLatestInput: QueryCommandInput = {
            TableName: PRICES_TABLE_NAME,
            KeyConditionExpression: "pk = :pkVal",
            ExpressionAttributeValues: { ":pkVal": pkPriceAsset(assetKey) },
            ScanIndexForward: false, Limit: 1
        };
        const queryResult = await docClient.send(new QueryCommand(queryLatestInput));
        if (!queryResult.Items || queryResult.Items.length === 0) {
             console.warn(`SynthExchange: Oracle price not found for asset: ${assetKey}.`);
             return null;
        }
        return (queryResult.Items[0] as PriceSnapshot).price;
    } catch (error) {
        console.error(`SynthExchange: Error fetching oracle price for ${assetKey}:`, error);
        return null;
    }
}

async function getLinkedWalletAddress(traderId: string): Promise<string | null> {
    // ... (implementation from withdraw/route.ts)
    if (!traderId) return null;
    try {
        const { Item } = await docClient.send(new GetCommand({ TableName: TRADERS_TABLE_NAME, Key: { traderId }, ProjectionExpression: "walletAddress" }));
        return Item?.walletAddress && ethers.isAddress(Item.walletAddress) ? Item.walletAddress : null;
    } catch (e) { console.error("Error fetching linked wallet in SynthExchange:", e); return null; }
}


export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: {
        "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }});
}

export async function POST(req: NextRequest) {
    if (!vaultContractForExchange || !coreSigner || !factoryContractForExchange || !provider || !USDC_CONTRACT_ADDR || USDC_CONTRACT_ADDR === "0xReplaceWithActualUSDConPeaqAddress") {
        console.error("SynthExchange API: Server contracts or USDC address not initialized.");
        return NextResponse.json({ error: "Server configuration error for synth exchange." }, { status: 503 });
    }

    let authenticatedUser: AuthenticatedUserSubject;
    try {
        authenticatedUser = await requireAuth();
    } catch (authError: any) {
        return authError instanceof NextResponse ? authError : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const internalDEXTraderId = authenticatedUser.properties.traderId; // For logging/internal reference
    const userWalletAddress = authenticatedUser.properties.walletAddress || await getLinkedWalletAddress(internalDEXTraderId);

    if (!userWalletAddress || !ethers.isAddress(userWalletAddress)) {
        return NextResponse.json({ error: "User's Peaq wallet not linked or invalid. Please link your wallet." }, { status: 400 });
    }

    try {
        const body = await req.json() as { fromAsset: string; toAsset: string; amount: string; mode: TradingMode; };
        if (!body.fromAsset || !body.toAsset || !body.amount || !body.mode || body.mode !== "REAL") {
            return NextResponse.json({ error: "Missing/invalid fields. Required: fromAsset, toAsset, amount (base units string), mode (must be REAL)." }, { status: 400 });
        }
        if (body.fromAsset === body.toAsset) return NextResponse.json({ error: "From and To assets cannot be the same." }, { status: 400 });
        if (!((body.fromAsset.toUpperCase() === "USDC" && body.toAsset.startsWith("s")) || 
              (body.toAsset.toUpperCase() === "USDC" && body.fromAsset.startsWith("s")))) {
            return NextResponse.json({ error: "Exchange must be between USDC and an sASSET (e.g., sBTC)." }, { status: 400 });
        }

        const fromAssetSymbol = body.fromAsset.toUpperCase();
        const toAssetSymbol = body.toAsset.toUpperCase();
        const fromAssetDecimals = getAssetDecimalsExchange(fromAssetSymbol);
        const toAssetDecimals = getAssetDecimalsExchange(toAssetSymbol);
        
        let amountFromBigInt: bigint;
        try {
            amountFromBigInt = ethers.parseUnits(body.amount, fromAssetDecimals);
        } catch {
            return NextResponse.json({ error: `Invalid amount format for ${fromAssetSymbol}. Expected up to ${fromAssetDecimals} decimals as string.` }, { status: 400 });
        }
        if (amountFromBigInt <= BigInt(0)) return NextResponse.json({ error: "Amount must be positive." }, { status: 400 });

        let txResponse;
        let txDescription: string;
        let sAssetContractAddress: string;
        let amountToReceiveBigInt: bigint; // This will be calculated based on oracle

        const sAssetInvolved = fromAssetSymbol === "USDC" ? toAssetSymbol : fromAssetSymbol;
        const underlyingForOracle = sAssetInvolved.substring(1); // "sBTC" -> "BTC"
        const oraclePrice = await getOraclePriceForExchange(underlyingForOracle);

        if (!oraclePrice || oraclePrice <= 0) {
            return NextResponse.json({ error: `Oracle price for ${underlyingForOracle} is currently unavailable or invalid.` }, { status: 503 });
        }

        if (fromAssetSymbol === "USDC") { // User spends USDC to get sASSET
            sAssetContractAddress = await factoryContractForExchange.getSynthBySymbol(toAssetSymbol);
            if (!sAssetContractAddress || sAssetContractAddress === ethers.ZeroAddress) {
                return NextResponse.json({ error: `Synth contract for ${toAssetSymbol} not found.` }, { status: 404 });
            }
            
            // Calculate sAssetAmountToMint based on oraclePrice
            // sAssetAmount = (usdcAmount / oraclePrice) * 10^sAssetDecimals (scaled appropriately)
            amountToReceiveBigInt = (amountFromBigInt * BigInt(10 ** toAssetDecimals)) / BigInt(Math.round(oraclePrice * (10 ** fromAssetDecimals)));
            if (amountToReceiveBigInt <= BigInt(0)) {
                 return NextResponse.json({ error: "Calculated amount of sAsset to receive is zero or less. Check input amount or oracle price." }, { status: 400 });
            }


            const usdcTokenContract = new ethers.Contract(USDC_CONTRACT_ADDR, erc20AbiMinimal, provider);
            const usdcAllowance: bigint = await usdcTokenContract.allowance(userWalletAddress, VAULT_ADDR);
            if (usdcAllowance < amountFromBigInt) {
                 return NextResponse.json({ error: `Vault needs approval to spend ${body.amount} USDC. Current allowance: ${ethers.formatUnits(usdcAllowance, fromAssetDecimals)}.`, needsApproval: true, tokenToApprove: USDC_CONTRACT_ADDR, spender: VAULT_ADDR, requiredAmountFormatted: body.amount, requiredAmountBaseUnits: amountFromBigInt.toString() }, { status: 400 });
            }

            txResponse = await vaultContractForExchange.exchangeUSDCToSAsset(userWalletAddress, sAssetContractAddress, amountFromBigInt, amountToReceiveBigInt);
            txDescription = `Exchanged ${ethers.formatUnits(amountFromBigInt, fromAssetDecimals)} USDC for ${ethers.formatUnits(amountToReceiveBigInt, toAssetDecimals)} ${toAssetSymbol}`;
        } else { // User spends sASSET to get USDC
            sAssetContractAddress = await factoryContractForExchange.getSynthBySymbol(fromAssetSymbol);
            if (!sAssetContractAddress || sAssetContractAddress === ethers.ZeroAddress) {
                return NextResponse.json({ error: `Synth contract for ${fromAssetSymbol} not found.` }, { status: 404 });
            }

            // Calculate usdcAmountToCredit based on oraclePrice
            // usdcAmount = (sAssetAmount * oraclePrice) * 10^usdcDecimals (scaled appropriately)
            amountToReceiveBigInt = (amountFromBigInt * BigInt(Math.round(oraclePrice * (10 ** toAssetDecimals)))) / BigInt(10 ** fromAssetDecimals);
            if (amountToReceiveBigInt <= BigInt(0)) {
                 return NextResponse.json({ error: "Calculated amount of USDC to receive is zero or less. Check input amount or oracle price." }, { status: 400 });
            }

            const sAssetTokenContract = new ethers.Contract(sAssetContractAddress, erc20AbiMinimal, provider);
            const sAssetAllowance: bigint = await sAssetTokenContract.allowance(userWalletAddress, VAULT_ADDR);
            if (sAssetAllowance < amountFromBigInt) {
                 return NextResponse.json({ error: `Vault needs approval to spend/burn ${body.amount} ${fromAssetSymbol}. Current allowance: ${ethers.formatUnits(sAssetAllowance, fromAssetDecimals)}.`, needsApproval: true, tokenToApprove: sAssetContractAddress, spender: VAULT_ADDR, requiredAmountFormatted: body.amount, requiredAmountBaseUnits: amountFromBigInt.toString() }, { status: 400 });
            }
            
            txResponse = await vaultContractForExchange.exchangeSAssetToUSDC(userWalletAddress, sAssetContractAddress, amountFromBigInt, amountToReceiveBigInt);
            txDescription = `Exchanged ${ethers.formatUnits(amountFromBigInt, fromAssetDecimals)} ${fromAssetSymbol} for ${ethers.formatUnits(amountToReceiveBigInt, toAssetDecimals)} USDC`;
        }

        console.log(`SynthExchange API: ${txDescription}. User: ${userWalletAddress}, TraderID: ${internalDEXTraderId}. Tx sent: ${txResponse.hash}`);
        const receipt = await txResponse.wait(1);
        if (receipt.status !== 1) throw new Error(`On-chain exchange transaction failed (Tx: ${txResponse.hash}).`);
        
        // The Vault functions now return the amounts.
        // We can try to parse events if needed, but let's assume the contract returns are reliable or we use the pre-calculated `amountToReceiveBigInt`.
        const actualAmountReceivedFormatted = ethers.formatUnits(amountToReceiveBigInt, toAssetDecimals);

        return NextResponse.json({ 
            success: true, 
            message: `Exchange successful! ${txDescription}. Funds are in your Peaq wallet.`, 
            txHash: txResponse.hash,
            fromAsset: fromAssetSymbol,
            fromAmountSpentBaseUnits: amountFromBigInt.toString(),
            fromAmountSpentFormatted: ethers.formatUnits(amountFromBigInt, fromAssetDecimals),
            toAsset: toAssetSymbol,
            amountReceivedBaseUnits: amountToReceiveBigInt.toString(),
            amountReceivedFormatted: actualAmountReceivedFormatted,
            oraclePriceUsed: oraclePrice // Good to return the price used for transparency
        }, { status: 200 });

    } catch (err: any) {
        console.error(`SynthExchange API Error for trader ${internalDEXTraderId}, wallet ${userWalletAddress}:`, err);
        let errorMessage = "Internal server error during synth exchange.";
        if (err.code === 'INSUFFICIENT_FUNDS' && typeof err.message === 'string') errorMessage = "Transaction failed: Insufficient funds for gas on your wallet.";
        else if (err.reason && typeof err.reason === 'string') errorMessage = `Transaction failed: ${err.reason}`;
        else if (err.message && typeof err.message === 'string') errorMessage = err.message; // Use error message directly if available
        return NextResponse.json({ error: errorMessage, txHashAttempted: (err as any).transactionHash || (err as any).hash }, { status: 500 });
    }
}