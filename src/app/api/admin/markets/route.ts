// src/app/api/admin/markets/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { requireAdmin } from "@/lib/auth";
import type { TradingMode, UnderlyingPairMeta, InstrumentMarketMeta } from "@/lib/interfaces";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});
const MARKETS_TABLE_NAME = Resource.MarketsTable.name;

const FACTORY_ADDR = Resource.CoreFactoryAddress.value
const VAULT_ADDR = Resource.CoreVaultAddress.value
const ADMIN_PK = Resource.CoreWalletPk.value
const PEAQ_RPC_URL = "https://peaq.api.onfinality.io/public"
const CHAIN_ID = "3338"

// ABI for SynthFactory
const factoryAbi = [
  "event SynthCreated(address indexed synthContract, string name, string symbol)",
  "function createSynth(string calldata name, string calldata symbol) external returns (address synthContract)",
  // It's good if Factory can report if a synth symbol is already created
  "function getSynthBySymbol(string calldata symbol) external view returns (address synthContract)"
];

// ABI for Vault (relevant part)
const vaultAbi = [
  "function registerSynth(address synthContract) external",
  "function isRegisteredSynth(address synthContract) external view returns (bool)" // To check if already registered
];

const getSigner = () => {
  if (!ADMIN_PK || !PEAQ_RPC_URL || !CHAIN_ID) {
    console.warn("Admin Market Route: ADMIN_PK, PEAQ_RPC_URL, or CHAIN_ID not set. On-chain operations will be skipped for REAL mode.");
    return null;
  }
  try {
    const provider = new ethers.JsonRpcProvider(PEAQ_RPC_URL, parseInt(CHAIN_ID));
    return new ethers.Wallet(ADMIN_PK, provider);
  } catch (e) {
    console.error("Failed to initialize admin signer:", e);
    return null;
  }
};

// Helper to generate PK for underlying pair definitions
const pkUnderlyingPairKey = (baseAsset: string, quoteAsset: string, mode: TradingMode) =>
  `MARKET#${baseAsset.toUpperCase()}/${quoteAsset.toUpperCase()}#${mode.toUpperCase()}`;


// --- POST: Create or Update an Underlying Pair Definition ---
export async function POST(req: NextRequest) {
  // const adminUser = await requireAdmin(); // Ensure admin is authenticated

  try {
    const body = (await req.json()) as Partial<Omit<UnderlyingPairMeta, 'pk' | 'sk' | 'createdAt' | 'updatedAt' | 'type' | 'baseAssetSynthContract'>> & {
        symbol: string; // e.g. "BTC/USDC"
        baseAsset: string; // e.g. "BTC"
        quoteAsset: "USDC";
        mode: TradingMode;
        allowsOptions: boolean;
        allowsFutures: boolean;
        allowsPerpetuals: boolean;
        tickSizeSpot: number;
        lotSizeSpot: number;
        defaultOptionTickSize: number;
        defaultOptionLotSize: number;
        defaultFutureTickSize: number;
        defaultFutureLotSize: number;
        defaultPerpTickSize?: number;
        defaultPerpLotSize?: number;
        fundingIntervalSecPerp?: number; // For the auto-created PERP market
    };

    // --- Robust Validation ---
    const requiredFields: (keyof typeof body)[] = [
        'symbol', 'baseAsset', 'quoteAsset', 'mode', 'allowsOptions', 'allowsFutures', 'allowsPerpetuals',
        'tickSizeSpot', 'lotSizeSpot', 'defaultOptionTickSize', 'defaultOptionLotSize',
        'defaultFutureTickSize', 'defaultFutureLotSize'
    ];
    for (const field of requiredFields) {
        if (body[field] === undefined || body[field] === null) {
            return NextResponse.json({ error: `Missing required field: '${field}'` }, { status: 400 });
        }
    }
    if (body.quoteAsset !== "USDC") {
      return NextResponse.json({ error: "'quoteAsset' must be USDC." }, { status: 400 });
    }
    if (body.mode !== "REAL" && body.mode !== "PAPER") {
      return NextResponse.json({ error: "Invalid 'mode' (REAL or PAPER)" }, { status: 400 });
    }
    const sizesAndTicks: (keyof typeof body)[] = [
        'tickSizeSpot', 'lotSizeSpot', 'defaultOptionTickSize', 'defaultOptionLotSize',
        'defaultFutureTickSize', 'defaultFutureLotSize'
    ];
    if (body.allowsPerpetuals) {
        if (typeof body.defaultPerpTickSize !== 'number' || body.defaultPerpTickSize <= 0 ||
            typeof body.defaultPerpLotSize !== 'number' || body.defaultPerpLotSize <= 0) {
            return NextResponse.json({ error: "defaultPerpTickSize and defaultPerpLotSize required and must be positive if allowsPerpetuals is true." }, { status: 400 });
        }
        sizesAndTicks.push('defaultPerpTickSize', 'defaultPerpLotSize');
    }
    for (const field of sizesAndTicks) {
        if (typeof body[field] !== 'number' || (body[field] as number) <= 0) {
             return NextResponse.json({ error: `Field '${field}' must be a positive number.` }, { status: 400 });
        }
    }
    if (!body.symbol.includes('/') || body.symbol.split('/').length !== 2 || body.symbol.split('/')[0] !== body.baseAsset || body.symbol.split('/')[1] !== body.quoteAsset) {
        return NextResponse.json({ error: "Symbol format incorrect. Expected 'BASE/QUOTE', e.g., 'BTC/USDC', matching baseAsset and quoteAsset." }, { status: 400 });
    }
    // --- End Validation ---


    const {
      symbol, baseAsset, quoteAsset, mode, allowsOptions, allowsFutures, allowsPerpetuals,
      tickSizeSpot, lotSizeSpot,
      defaultOptionTickSize, defaultOptionLotSize,
      defaultFutureTickSize, defaultFutureLotSize,
      defaultPerpTickSize, defaultPerpLotSize,
      fundingIntervalSecPerp = 28800, // Default 8 hours for auto-created perp
    } = body;

    const pk = pkUnderlyingPairKey(baseAsset, quoteAsset, mode);
    const now = Date.now();
    let baseAssetSynthContractAddress: string | null = null;
    let synthCreationDetails: any = null;

    // --- On-chain SynthERC20 Deployment via Factory & Vault Registration (REAL mode, if configured) ---
    if (mode === "REAL" && FACTORY_ADDR && VAULT_ADDR && ADMIN_PK && PEAQ_RPC_URL && CHAIN_ID) {
      const signer = getSigner();
      if (signer) {
        const factory = new ethers.Contract(FACTORY_ADDR, factoryAbi, signer);
        const vault = new ethers.Contract(VAULT_ADDR, vaultAbi, signer);
        const onChainSynthSymbol = `s${baseAsset.toUpperCase()}`; // e.g., sBTC

        try {
          console.log(`Admin: Checking for existing synth ${onChainSynthSymbol} via factory...`);
          const existingSynthAddr = await factory.getSynthBySymbol(onChainSynthSymbol).catch(() => ethers.ZeroAddress);
          
          if (existingSynthAddr && existingSynthAddr !== ethers.ZeroAddress) {
            baseAssetSynthContractAddress = existingSynthAddr;
            console.log(`Admin: Synth ${onChainSynthSymbol} already exists at ${baseAssetSynthContractAddress}.`);
            // Verify it's registered with the Vault
            const isRegistered = await vault.isRegisteredSynth(baseAssetSynthContractAddress).catch(() => false);
            if (!isRegistered) {
                console.log(`Admin: Synth ${baseAssetSynthContractAddress} exists but not registered with Vault. Registering...`);
                const registerTx = await vault.registerSynth(baseAssetSynthContractAddress);
                await registerTx.wait(1);
                console.log(`Admin: Synth ${baseAssetSynthContractAddress} now registered with Vault.`);
            }
            synthCreationDetails = { address: baseAssetSynthContractAddress, status: "existed" };
          } else {
            console.log(`Admin: Synth ${onChainSynthSymbol} not found. Creating via factory...`);
            const tx = await factory.createSynth(`Synthetic ${baseAsset}`, onChainSynthSymbol);
            const receipt = await tx.wait(1);
            console.log(`Admin: Factory createSynth transaction mined: ${tx.hash}`);

            const createdEvent = receipt.logs?.map((l: any) => { try { return factory.interface.parseLog(l); } catch { return null; } })
                                           .find((l: any) => l?.name === "SynthCreated");
            if (!createdEvent?.args?.synthContract) {
              throw new Error("Synth creation event not found or synthContract address missing in event.");
            }
            baseAssetSynthContractAddress = createdEvent.args.synthContract as string;
            synthCreationDetails = { address: baseAssetSynthContractAddress, txHash: tx.hash, status: "created" };
            console.log(`Admin: Synth ${onChainSynthSymbol} deployed: ${baseAssetSynthContractAddress}`);

            console.log(`Admin: Registering new Synth ${baseAssetSynthContractAddress} with Vault ${VAULT_ADDR}`);
            const registerTx = await vault.registerSynth(baseAssetSynthContractAddress);
            await registerTx.wait(1);
            console.log(`Admin: Synth ${baseAssetSynthContractAddress} registered with Vault. Tx: ${registerTx.hash}`);
          }
        } catch (chainError: any) {
          console.error(`Admin: On-chain synth setup failed for ${baseAsset} (${mode}):`, chainError);
          // This is a critical failure for REAL mode if synths are essential for DEX accounting
          return NextResponse.json({ error: `On-chain synth setup failed: ${chainError.reason || chainError.message || 'Unknown chain error'}` }, { status: 502 });
        }
      } else {
        console.warn("Admin: Signer not available due to missing env vars for REAL mode on-chain operations. Synth will not be created/registered on-chain.");
      }
    } else if (mode === "REAL") {
      console.warn("Admin: On-chain synth creation/registration skipped for REAL mode due to missing FACTORY_ADDR, VAULT_ADDR or other critical env vars.");
    }

    const underlyingPairItem: UnderlyingPairMeta = {
      pk,
      sk: "META",
      symbol,
      baseAsset,
      quoteAsset,
      type: "SPOT", // This entry defines the underlying and its spot market.
      status: "ACTIVE",
      mode,
      allowsOptions,
      allowsFutures,
      allowsPerpetuals,
      tickSizeSpot,
      lotSizeSpot,
      defaultOptionTickSize,
      defaultOptionLotSize,
      defaultFutureTickSize,
      defaultFutureLotSize,
      ...(allowsPerpetuals && defaultPerpTickSize && defaultPerpLotSize && { defaultPerpTickSize, defaultPerpLotSize }),
      baseAssetSynthContract: baseAssetSynthContractAddress,
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(
      new PutItemCommand({
        TableName: MARKETS_TABLE_NAME,
        Item: marshall(underlyingPairItem, { removeUndefinedValues: true }),
      })
    );
    console.log(`Admin: Underlying pair definition saved: ${symbol} (${mode})`);

    // If allowsPerpetuals, automatically create the specific PERP market entry
    if (allowsPerpetuals && defaultPerpTickSize && defaultPerpLotSize) {
        const perpInstrumentSymbol = `${symbol}-PERP`;
        const perpMarketPK = `MARKET#${perpInstrumentSymbol}#${mode}`;
        const perpMarketItem: InstrumentMarketMeta = {
            pk: perpMarketPK,
            sk: "META",
            symbol: perpInstrumentSymbol,
            type: "PERP",
            underlyingPairSymbol: symbol,
            baseAsset: baseAsset,
            quoteAsset: quoteAsset,
            status: "ACTIVE",
            mode: mode,
            tickSize: defaultPerpTickSize,
            lotSize: defaultPerpLotSize,
            fundingIntervalSec: fundingIntervalSecPerp,
            createdAt: now,
            updatedAt: now,
        };
        await ddb.send(
            new PutItemCommand({
                TableName: MARKETS_TABLE_NAME,
                Item: marshall(perpMarketItem, { removeUndefinedValues: true }),
            })
        );
        console.log(`Admin: PERP market auto-created: ${perpInstrumentSymbol} (${mode})`);
    }

    return NextResponse.json(
      {
        message: `Underlying pair '${symbol}' (${mode}) definition saved.`,
        definedPair: underlyingPairItem,
        synthDetails: synthCreationDetails,
      },
      { status: 201 }
    );

  } catch (err: any) {
    console.error("Admin POST /api/admin/markets error:", err);
    // Check for specific DynamoDB errors like ConditionalCheckFailedException if using conditions
    return NextResponse.json({ error: "Internal server error processing market definition." }, { status: 500 });
  }
}

// --- PATCH and DELETE handlers from previous response (largely unchanged in core logic) ---
// They operate on `marketSymbol` which can be an underlying OR a specific instrument.
// Ensure their validation and PK construction `MARKET#${marketSymbol}#${mode}` is correct.
// The SETTLE action in PATCH is particularly relevant for derivative expiry.

export async function PATCH(req: NextRequest) {
  await requireAdmin();
  try {
    const body = (await req.json()) as {
      marketSymbol: string; 
      action: "PAUSE" | "UNPAUSE" | "EXPIRE" | "SETTLE";
      mode: TradingMode;
      settlementPrice?: number; // Only for SETTLE action
    };

    const { marketSymbol, action, mode, settlementPrice } = body;

    if (!marketSymbol || !action || !mode || (mode !== "REAL" && mode !== "PAPER") ||
        !["PAUSE", "UNPAUSE", "EXPIRE", "SETTLE"].includes(action)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (action === "SETTLE" && typeof settlementPrice !== 'number') {
        return NextResponse.json({ error: "settlementPrice (number) required for SETTLE action" }, { status: 400 });
    }

    const pk = `MARKET#${marketSymbol}#${mode.toUpperCase()}`;
    const newStatus = action === "PAUSE" ? "PAUSED" :
                      action === "UNPAUSE" ? "ACTIVE" :
                      action === "EXPIRE" ? "EXPIRED" : "SETTLED";

    const updateExpressionParts = ["SET #s = :newStatus, updatedAt = :ts"];
    const expressionAttributeNames: Record<string, string> = { "#s": "status" };
    const expressionAttributeValues: Record<string, any> = {
      ":newStatus": newStatus,
      ":ts": Date.now(),
    };

    if (action === "SETTLE" && settlementPrice !== undefined) {
        updateExpressionParts.push("settlementPrice = :sp");
        expressionAttributeValues[":sp"] = settlementPrice;
    }
    
    const updateParams = {
        TableName: MARKETS_TABLE_NAME,
        Key: marshall({ pk: pk, sk: "META" }),
        UpdateExpression: updateExpressionParts.join(", "),
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
        ReturnValues: "ALL_NEW",
    };

    const result = await ddb.send(new UpdateItemCommand(updateParams as any));

    return NextResponse.json({
      ok: true,
      marketSymbol,
      mode,
      status: newStatus,
      updatedAttributes: result.Attributes ? unmarshall(result.Attributes) : {},
    });

  } catch (err: any) {
    let reqBodyForError = {};
    try { reqBodyForError = await req.clone().json(); } catch {}
    if (err?.name === "ConditionalCheckFailedException") {
      return NextResponse.json({ error: `Market '${(reqBodyForError as any).marketSymbol}' not found for mode '${(reqBodyForError as any).mode}'.` }, { status: 404 });
    }
    console.error("Admin PATCH /api/admin/markets error:", err, "Request Body:", reqBodyForError);
    return NextResponse.json({ error: "Internal server error updating market status." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await requireAdmin();
  try {
    const { marketSymbol, mode } = (await req.json()) as {
      marketSymbol: string;
      mode: TradingMode;
    };

    if (!marketSymbol || !mode || (mode !== "REAL" && mode !== "PAPER")) {
      return NextResponse.json({ error: "Invalid payload: requires marketSymbol and mode" }, { status: 400 });
    }

    const pk = `MARKET#${marketSymbol}#${mode.toUpperCase()}`;
    const newStatus = "DELISTED";

    await ddb.send(
      new UpdateItemCommand({
        TableName: MARKETS_TABLE_NAME,
        Key: marshall({ pk: pk, sk: "META" }),
        UpdateExpression: "SET #s = :newStatus, updatedAt = :ts",
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: marshall({ ":newStatus": newStatus, ":ts": Date.now() }),
      })
    );
    return NextResponse.json({ ok: true, marketSymbol, mode, status: newStatus });
  } catch (err: any) {
    let reqBodyForError = {};
    try { reqBodyForError = await req.clone().json(); } catch {}
    if (err?.name === "ConditionalCheckFailedException") {
      return NextResponse.json({ error: `Market '${(reqBodyForError as any).marketSymbol}' not found for mode '${(reqBodyForError as any).mode}'.` }, { status: 404 });
    }
    console.error("Admin DELETE /api/admin/markets error:", err, "Request Body:", reqBodyForError);
    return NextResponse.json({ error: "Internal server error delisting market." }, { status: 500 });
  }
}