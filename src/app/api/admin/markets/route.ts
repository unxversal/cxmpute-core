// src/app/api/admin/markets/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
  UpdateItemCommandInput, // Explicitly import input type for clarity
  ReturnValue,          // Import ReturnValue for explicit casting if needed
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { requireAdmin } from "@/lib/auth";
import type { TradingMode, UnderlyingPairMeta, InstrumentMarketMeta, DerivativeType, OptionType } from "@/lib/interfaces";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});
const MARKETS_TABLE_NAME = Resource.MarketsTable.name;

const FACTORY_ADDR = Resource.CoreFactoryAddress.value;
const VAULT_ADDR = Resource.CoreVaultAddress.value;
const ADMIN_PK = Resource.CoreWalletPk.value;
const PEAQ_RPC_URL = "https://peaq.api.onfinality.io/public";
const CHAIN_ID = "3338";

const factoryAbi = [
  "event SynthCreated(address indexed synthContract, string name, string symbol)",
  "function createSynth(string calldata name, string calldata symbol) external returns (address synthContract)",
  "function getSynthBySymbol(string calldata symbol) external view returns (address synthContract)"
];
const vaultAbi = [
  "function registerSynth(address synthContract) external",
  "function isRegisteredSynth(address synthContract) external view returns (bool)"
];

const getSigner = () => {
  if (!ADMIN_PK || !PEAQ_RPC_URL || !CHAIN_ID) {
    console.warn("Admin Market Route: ADMIN_PK, PEAQ_RPC_URL, or CHAIN_ID not set. On-chain ops will be skipped.");
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

const pkUnderlyingPairKey = (baseAsset: string, quoteAsset: string, mode: TradingMode) =>
  `MARKET#${baseAsset.toUpperCase()}/${quoteAsset.toUpperCase()}#${mode.toUpperCase()}`;

// <<< FIX: Re-add pkMarketKey (used for specific instrument PKs)
const pkMarketKey = (marketSymbol: string, mode: TradingMode) => 
  `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`;

const constructGsi1pk = (underlyingPairSymbol: string, mode: TradingMode, type: DerivativeType | "PERP" | "SPOT") => {
    return `${underlyingPairSymbol.toUpperCase()}#${mode.toUpperCase()}#${type.toUpperCase()}`;
};
const constructGsi1sk = (status: string, instrumentSymbol: string, expiryTs?: number, strikePrice?: number, optionType?: OptionType) => {
    return `${status.toUpperCase()}#${expiryTs || 0}#${strikePrice || 0}#${optionType || 'NONE'}#${instrumentSymbol.toUpperCase()}`;
};


export async function POST(req: NextRequest) {
  await requireAdmin();

  try {
    const body = (await req.json()) as Omit<UnderlyingPairMeta, 'pk' | 'sk' | 'createdAt' | 'updatedAt' | 'type' | 'baseAssetSynthContract' | 'gsi1pk' | 'gsi1sk'> & {
        symbol: string; baseAsset: string; quoteAsset: "USDC"; mode: TradingMode;
        allowsOptions: boolean; allowsFutures: boolean; allowsPerpetuals: boolean;
        tickSizeSpot: number; lotSizeSpot: number;
        defaultOptionTickSize: number; defaultOptionLotSize: number;
        defaultFutureTickSize: number; defaultFutureLotSize: number;
        defaultPerpTickSize?: number; defaultPerpLotSize?: number;
        fundingIntervalSecPerp?: number;
    };

    // --- Robust Validation ---
    const requiredFields: (keyof Omit<typeof body, 'defaultPerpTickSize' | 'defaultPerpLotSize' | 'fundingIntervalSecPerp'>)[] = [
        'symbol', 'baseAsset', 'quoteAsset', 'mode', 'allowsOptions', 'allowsFutures', 'allowsPerpetuals',
        'tickSizeSpot', 'lotSizeSpot', 'defaultOptionTickSize', 'defaultOptionLotSize',
        'defaultFutureTickSize', 'defaultFutureLotSize'
    ];
    for (const field of requiredFields) {
        if ((body as any)[field] === undefined || (body as any)[field] === null) {
            return NextResponse.json({ error: `Missing required field: '${field}'` }, { status: 400 });
        }
    }
    if (body.quoteAsset !== "USDC") return NextResponse.json({ error: "'quoteAsset' must be USDC." }, { status: 400 });
    if (body.mode !== "REAL" && body.mode !== "PAPER") return NextResponse.json({ error: "Invalid 'mode'." }, { status: 400 });
    if (!body.symbol.includes('/') || body.symbol.split('/').length !== 2 || body.symbol.split('/')[0].toUpperCase() !== body.baseAsset.toUpperCase() || body.symbol.split('/')[1].toUpperCase() !== body.quoteAsset.toUpperCase()) {
        return NextResponse.json({ error: "Symbol format incorrect or mismatch. Expected 'BASE/QUOTE', e.g., 'BTC/USDC'." }, { status: 400 });
    }
    const sizesAndTicksPositive: (keyof typeof body)[] = ['tickSizeSpot', 'lotSizeSpot', 'defaultOptionTickSize', 'defaultOptionLotSize', 'defaultFutureTickSize', 'defaultFutureLotSize'];
    if (body.allowsPerpetuals) {
        if (typeof body.defaultPerpTickSize !== 'number' || body.defaultPerpTickSize <= 0 || typeof body.defaultPerpLotSize !== 'number' || body.defaultPerpLotSize <= 0) {
            return NextResponse.json({ error: "defaultPerpTickSize/LotSize required and positive if allowsPerpetuals." }, { status: 400 });
        }
        sizesAndTicksPositive.push('defaultPerpTickSize', 'defaultPerpLotSize');
    }
     for (const field of sizesAndTicksPositive) {
        if (typeof (body as any)[field] !== 'number' || ((body as any)[field] as number) <= 0) {
             return NextResponse.json({ error: `Field '${field}' must be a positive number.` }, { status: 400 });
        }
    }
    // --- End Validation ---

    const {
      symbol, baseAsset, quoteAsset, mode, allowsOptions, allowsFutures, allowsPerpetuals,
      tickSizeSpot, lotSizeSpot,
      defaultOptionTickSize, defaultOptionLotSize,
      defaultFutureTickSize, defaultFutureLotSize,
      defaultPerpTickSize, defaultPerpLotSize,
      fundingIntervalSecPerp = 28800,
    } = body;

    const pk = pkUnderlyingPairKey(baseAsset, quoteAsset, mode);
    const now = Date.now();
    let baseAssetSynthContractAddress: string | null = null;
    let synthCreationDetails: any = null;

    if (mode === "REAL" && FACTORY_ADDR && VAULT_ADDR && ADMIN_PK && PEAQ_RPC_URL && CHAIN_ID) {
      const signer = getSigner();
      if (signer) {
        const factory = new ethers.Contract(FACTORY_ADDR, factoryAbi, signer);
        const vault = new ethers.Contract(VAULT_ADDR, vaultAbi, signer);
        const onChainSynthSymbol = `s${baseAsset.toUpperCase()}`;
        try {
          const existingSynthAddr = await factory.getSynthBySymbol(onChainSynthSymbol).catch(() => ethers.ZeroAddress);
          if (existingSynthAddr && existingSynthAddr !== ethers.ZeroAddress) {
            baseAssetSynthContractAddress = existingSynthAddr;
            const isRegistered = await vault.isRegisteredSynth(baseAssetSynthContractAddress).catch(() => false);
            if (!isRegistered) {
                await (await vault.registerSynth(baseAssetSynthContractAddress)).wait(1);
            }
            synthCreationDetails = { address: baseAssetSynthContractAddress, status: "existed_or_re-registered" };
          } else {
            const tx = await factory.createSynth(`Synthetic ${baseAsset}`, onChainSynthSymbol);
            const receipt = await tx.wait(1);
            const createdEvent = receipt.logs?.map((l: any) => { try { return factory.interface.parseLog(l); } catch { return null; } })
                                           .find((l: any) => l?.name === "SynthCreated");
            if (!createdEvent?.args?.synthContract) throw new Error("Synth creation event error.");
            baseAssetSynthContractAddress = createdEvent.args.synthContract as string;
            await (await vault.registerSynth(baseAssetSynthContractAddress)).wait(1);
            synthCreationDetails = { address: baseAssetSynthContractAddress, txHash: tx.hash, status: "created_and_registered" };
          }
        } catch (chainError: any) {
          return NextResponse.json({ error: `On-chain synth setup failed: ${chainError.reason || chainError.message}` }, { status: 502 });
        }
      }
    }

    const underlyingGsi1pk = constructGsi1pk(symbol, mode, "SPOT");
    const underlyingGsi1sk = constructGsi1sk("ACTIVE", symbol);

    const underlyingPairItem: UnderlyingPairMeta = {
      pk, sk: "META", symbol, baseAsset, quoteAsset, type: "SPOT", status: "ACTIVE", mode,
      allowsOptions, allowsFutures, allowsPerpetuals,
      tickSizeSpot, lotSizeSpot, defaultOptionTickSize, defaultOptionLotSize,
      defaultFutureTickSize, defaultFutureLotSize,
      ...(allowsPerpetuals && defaultPerpTickSize && defaultPerpLotSize && { defaultPerpTickSize, defaultPerpLotSize }),
      baseAssetSynthContract: baseAssetSynthContractAddress,
      createdAt: now, updatedAt: now,
      gsi1pk: underlyingGsi1pk, gsi1sk: underlyingGsi1sk,
    };

    await ddb.send(
      new PutItemCommand({ TableName: MARKETS_TABLE_NAME, Item: marshall(underlyingPairItem, { removeUndefinedValues: true }) })
    );
    console.log(`Admin: Underlying pair definition saved: ${symbol} (${mode})`);

    if (allowsPerpetuals && defaultPerpTickSize && defaultPerpLotSize) {
        const perpInstrumentSymbol = `${symbol}-PERP`;
        const perpMarketPK = pkMarketKey(perpInstrumentSymbol, mode); // Use pkMarketKey for specific instrument
        const perpGsi1pk = constructGsi1pk(symbol, mode, "PERP");
        const perpGsi1sk = constructGsi1sk("ACTIVE", perpInstrumentSymbol);

        const perpMarketItem: InstrumentMarketMeta = {
            pk: perpMarketPK, sk: "META", symbol: perpInstrumentSymbol, type: "PERP",
            underlyingPairSymbol: symbol, baseAsset: baseAsset, quoteAsset: quoteAsset,
            status: "ACTIVE", mode: mode,
            tickSize: defaultPerpTickSize, lotSize: defaultPerpLotSize,
            fundingIntervalSec: fundingIntervalSecPerp,
            createdAt: now, updatedAt: now,
            gsi1pk: perpGsi1pk, gsi1sk: perpGsi1sk,
        };
        await ddb.send(
            new PutItemCommand({ TableName: MARKETS_TABLE_NAME, Item: marshall(perpMarketItem, { removeUndefinedValues: true }) })
        );
        console.log(`Admin: PERP market auto-created/updated: ${perpInstrumentSymbol} (${mode})`);
    }

    return NextResponse.json(
      { message: `Underlying pair '${symbol}' (${mode}) definition saved.`, definedPair: underlyingPairItem, synthDetails: synthCreationDetails },
      { status: 201 }
    );

  } catch (err: any) {
    console.error("Admin POST /api/admin/markets error:", err);
    return NextResponse.json({ error: "Internal server error processing market definition." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  await requireAdmin();
  try {
    const body = (await req.json()) as {
      marketSymbol: string; 
      action: "PAUSE" | "UNPAUSE" | "EXPIRE" | "SETTLE";
      mode: TradingMode;
      settlementPrice?: number;
    };
    const { marketSymbol, action, mode, settlementPrice } = body;

    if (!marketSymbol || !action || !mode || !["PAUSE", "UNPAUSE", "EXPIRE", "SETTLE"].includes(action)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (action === "SETTLE" && typeof settlementPrice !== 'number') {
        return NextResponse.json({ error: "settlementPrice (number) required for SETTLE action" }, { status: 400 });
    }

    const pk = pkMarketKey(marketSymbol, mode); // Correctly use pkMarketKey for any marketSymbol
    const newStatus = action === "PAUSE" ? "PAUSED" :
                      action === "UNPAUSE" ? "ACTIVE" :
                      action === "EXPIRE" ? "EXPIRED" : "SETTLED";

    const updateExpressionParts = ["SET #s = :newStatus, updatedAt = :ts"];
    const expressionAttributeNames: Record<string, string> = { "#s": "status" };
    const expressionAttributeValuesMarshalled: Record<string, any> = { // Marshalled values
      ":newStatus": { S: newStatus },
      ":ts": { N: Date.now().toString() },
    };

    if (action === "SETTLE" && settlementPrice !== undefined) {
        updateExpressionParts.push("settlementPrice = :sp");
        expressionAttributeValuesMarshalled[":sp"] = { N: settlementPrice.toString() };
    }
    
    const updateParams: UpdateItemCommandInput = { // Explicitly type
        TableName: MARKETS_TABLE_NAME,
        Key: marshall({ pk: pk, sk: "META" }),
        UpdateExpression: updateExpressionParts.join(", "),
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValuesMarshalled, // Already marshalled
        ReturnValues: "ALL_NEW" as ReturnValue, // <<< FIX: Cast to ReturnValue type
    };

    const result = await ddb.send(new UpdateItemCommand(updateParams));

    return NextResponse.json({
      ok: true, marketSymbol, mode, status: newStatus,
      updatedAttributes: result.Attributes ? unmarshall(result.Attributes) : {},
    });

  } catch (err: any) { 
    let reqBodyForError = {}; try { reqBodyForError = await req.clone().json(); } catch {}
    if (err?.name === "ConditionalCheckFailedException") { return NextResponse.json({ error: `Market '${(reqBodyForError as any).marketSymbol}' not found for mode '${(reqBodyForError as any).mode}'.` }, { status: 404 });}
    console.error("Admin PATCH error:", err, "Body:", reqBodyForError);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await requireAdmin();
  try {
    const { marketSymbol, mode } = (await req.json()) as { marketSymbol: string; mode: TradingMode; };
    if (!marketSymbol || !mode) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    
    const pk = pkMarketKey(marketSymbol, mode); // Correctly use pkMarketKey
    const newStatus = "DELISTED";

    await ddb.send(
      new UpdateItemCommand({
        TableName: MARKETS_TABLE_NAME, Key: marshall({ pk: pk, sk: "META" }),
        UpdateExpression: "SET #s = :newStatus, updatedAt = :ts",
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: marshall({ ":newStatus": {S: newStatus}, ":ts": {N: Date.now().toString()} }),
        ReturnValues: "NONE" as ReturnValue, // Cast if needed, though NONE is usually fine
      })
    );
    return NextResponse.json({ ok: true, marketSymbol, mode, status: newStatus });
  } catch (err: any) { 
    let reqBodyForError = {}; try { reqBodyForError = await req.clone().json(); } catch {}
    if (err?.name === "ConditionalCheckFailedException") { return NextResponse.json({ error: `Market '${(reqBodyForError as any).marketSymbol}' not found for mode '${(reqBodyForError as any).mode}'.` }, { status: 404 });}
    console.error("Admin DELETE error:", err, "Body:", reqBodyForError);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}