/* eslint-disable @typescript-eslint/no-explicit-any */
/* app/api/admin/markets/route.ts */
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { requireAdmin } from "@/lib/auth"; // ← your auth helper
import type { TradingMode, MarketMeta } from "@/lib/interfaces"; // Ensure TradingMode is defined
import { Resource } from "sst";

/* ─── env & contracts (Ensure these are correctly set via SST Secrets/Env) ── */
const {
  FACTORY_ADDR,
  VAULT_ADDR,
  PEAQ_RPC_URL,
  CHAIN_ID = "3338", // Default to peaq mainnet
  ADMIN_PK,          // Ensure this is securely managed (SST Secret)
} = process.env;

interface ExtendedMarketMeta extends MarketMeta {
  strike?: number;
  optionType?: "CALL" | "PUT";
}

// Basic validation for required environment variables
if (!ADMIN_PK || !PEAQ_RPC_URL || (!FACTORY_ADDR && !VAULT_ADDR)) {
    console.error("Admin Market Route Error: Missing critical environment variables (ADMIN_PK, PEAQ_RPC_URL, FACTORY_ADDR/VAULT_ADDR)");
    // Avoid throwing here during module load, handle in requests instead or log prominently
}


const factoryAbi = [
  "event SynthCreated(address indexed synth,string name,string symbol)",
  "function createSynth(string name,string symbol) returns (address)",
];
const vaultAbi = ["function registerSynth(address synth)"];

// Initialize provider and signer only if needed and env vars are present
const getSigner = () => {
    if (!ADMIN_PK || !PEAQ_RPC_URL) return null;
    try {
        const provider = new ethers.JsonRpcProvider(PEAQ_RPC_URL!, CHAIN_ID ? +CHAIN_ID : undefined);
        return new ethers.Wallet(ADMIN_PK!, provider);
    } catch (e) {
        console.error("Failed to initialize admin signer:", e);
        return null;
    }
};

const getFactory = (signer: ethers.Wallet | null) => {
    if (!signer || !FACTORY_ADDR) return null;
    return new ethers.Contract(FACTORY_ADDR, factoryAbi, signer);
};

const getVault = (signer: ethers.Wallet | null) => {
    if (!signer || !VAULT_ADDR) return null;
    return new ethers.Contract(VAULT_ADDR, vaultAbi, signer);
};


const ddb = new DynamoDBClient({});
const MARKETS_TABLE = Resource.MarketsTable.name;

/**
 * Helper: derive PK for Markets table
 * NEW: Incorporates trading mode.
 */
const pkMarketMode = (market: string, mode: TradingMode) =>
  `MARKET#${market}#${mode.toUpperCase()}`;

/* ——————————————————————— POST = create market ————————————————————————— */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req); // throws if not admin

  try {
    const body = (await req.json()) as Partial<ExtendedMarketMeta> & { mode: TradingMode };

    // --- Paper Trading Validation ---
    if (!body.mode || (body.mode !== "REAL" && body.mode !== "PAPER")) {
        return NextResponse.json(
            { error: "invalid or missing 'mode' (REAL or PAPER)" },
            { status: 400 }
        );
    }
    const mode = body.mode;
    // --- End Paper Trading Validation ---

    const {
      symbol,
      type,
      tickSize,
      lotSize,
      fundingIntervalSec, // optional
      expiryTs,           // optional (future / option)
      strike,             // optional (option)
      optionType          // optional (option)
    } = body;


    if (!symbol || !type || tickSize === undefined || lotSize === undefined)
      return NextResponse.json({ error: "invalid market payload" }, { status: 400 });

    let synthAddr: string | null = null; // Synth address only relevant for REAL mode
    let txHash: string | null = null;    // Transaction hash only for REAL mode

    // --- Conditional Blockchain Interaction ---
    if (mode === "REAL") {
        const signer = getSigner();
        const factory = getFactory(signer);
        const vault = getVault(signer);

        if (!signer || !factory || !vault || !FACTORY_ADDR || !VAULT_ADDR) {
            console.error("Admin Create Market Error: Missing signer/contracts for REAL mode interaction.");
            return NextResponse.json({ error: "server configuration error for REAL mode" }, { status: 500 });
        }

        /* 1️⃣ Deploy synth via Factory (deterministic CREATE2) */
        const asset = symbol.split("-")[0]; // e.g., "SOL"
        const synthName = `Synthetic ${asset}`;
        const synthSymbol = `s${asset.toUpperCase()}`; // Convention: sBTC, sETH

        console.log(`Creating REAL Synth: ${synthName} (${synthSymbol})`);
        const tx = await factory.createSynth(synthName, synthSymbol);
        txHash = tx.hash;
        console.log(`Tx submitted: ${txHash}, waiting for confirmation...`);
        const rcpt = await tx.wait(1); // Wait for 1 confirmation

        // Find the SynthCreated event log to get the deployed address
        const createdEvent = rcpt.logs
            ?.map((l: any) => { try { return factory.interface.parseLog(l); } catch { return null; } })
            .find((l: any) => l?.name === "SynthCreated");

        if (!createdEvent?.args?.synth) {
            console.error("Failed to find SynthCreated event in transaction receipt", rcpt);
            throw new Error("Synth creation failed: could not parse synth address from logs.");
        }
        synthAddr = createdEvent.args.synth as string;
        console.log(`Synth Deployed: ${synthAddr}`);


        /* 2️⃣ Vault whitelist the new synth address */
        console.log(`Registering Synth ${synthAddr} with Vault ${VAULT_ADDR}`);
        const registerTx = await vault.registerSynth(synthAddr);
        await registerTx.wait(1); // Wait for confirmation
        console.log(`Synth registered with Vault.`);
    } else {
        console.log(`Skipping blockchain interaction for PAPER market: ${symbol}`);
        // For PAPER mode, synthAddr remains null or you could use a placeholder if needed downstream
    }
    // --- End Conditional Blockchain Interaction ---

    /* 3️⃣ Insert Markets row (status = PAUSED until unpaused explicitly) */
    const pk = pkMarketMode(symbol, mode);
    const marketItem = {
        pk: pk,
        sk: "META",
        symbol,
        type,
        status: "PAUSED", // Always start paused
        tickSize,
        lotSize,
        fundingIntervalSec,
        expiryTs,
        strike,
        optionType,
        synth: synthAddr, // Will be null for PAPER mode
        createdAt: Date.now(),
        createdBy: admin.email, // Or admin ID
        mode: mode, // Store mode explicitly as an attribute too
    };

    console.log(`Writing ${mode} market to DynamoDB: ${pk}`);
    await ddb.send(
      new PutItemCommand({
        TableName: MARKETS_TABLE,
        Item: marshall(marketItem, { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(pk)", // Prevent overwriting
      })
    );

    return NextResponse.json(
        { symbol, mode, synthAddr, txHash, status: "PAUSED" }, // Return relevant info
        { status: 201 }
    );

  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") {
        return NextResponse.json({ error: `market ${err.message?.includes('pk') ? 'already exists' : 'creation conflict'}` }, { status: 409 });
    }
    console.error("Admin Create Market Error:", err);
    // Check for common ethers errors (e.g., insufficient funds, network issues)
     if (err.code) { // Ethers errors often have codes
       return NextResponse.json({ error: `Blockchain interaction failed: ${err.reason || err.code}` }, { status: 502 }); // Bad Gateway/Upstream Error
     }
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}

/* ——————————————————————— PATCH = pause / unpause —————————————————————— */
export async function PATCH(req: NextRequest) {
  await requireAdmin(req);

  const { symbol, action, mode } = (await req.json()) as {
    symbol: string;
    action: "PAUSE" | "UNPAUSE";
    mode: TradingMode; // Expect mode
  };

  // --- Validation ---
  if (!symbol || !action || !mode || (mode !== "REAL" && mode !== "PAPER")) {
    return NextResponse.json({ error: "bad request: requires symbol, action (PAUSE/UNPAUSE), and mode (REAL/PAPER)" }, { status: 400 });
  }
  // --- End Validation ---

  try {
    const pk = pkMarketMode(symbol, mode); // Construct mode-specific PK
    const newStatus = action === "PAUSE" ? "PAUSED" : "ACTIVE";

    console.log(`Admin PATCH: Setting market ${pk} status to ${newStatus}`);
    await ddb.send(
      new UpdateItemCommand({
        TableName: MARKETS_TABLE,
        Key: marshall({ pk: pk, sk: "META" }),
        UpdateExpression: "SET #s = :st",
        ConditionExpression: "attribute_exists(pk)", // Ensure market exists
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: marshall({ ":st": newStatus }),
      })
    );
    return NextResponse.json({ ok: true, symbol, mode, status: newStatus });
  } catch (err: any) {
     if (err?.name === "ConditionalCheckFailedException") {
        return NextResponse.json({ error: `market not found for symbol '${symbol}' and mode '${mode}'` }, { status: 404 });
    }
    console.error(`Admin Pause/Unpause Error for ${symbol} (${mode}):`, err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}

/* ——————————————————————— DELETE = delist market ——————————————————————— */
// Note: Delisting usually means setting status=DELISTED, not physically deleting.
// Actual deletion might orphan data unless carefully managed.
export async function DELETE(req: NextRequest) {
  await requireAdmin(req);

  const { symbol, mode } = (await req.json()) as {
      symbol: string;
      mode: TradingMode; // Expect mode
  };

  // --- Validation ---
   if (!symbol || !mode || (mode !== "REAL" && mode !== "PAPER")) {
    return NextResponse.json({ error: "bad request: requires symbol and mode (REAL/PAPER)" }, { status: 400 });
  }
  // --- End Validation ---


  try {
    const pk = pkMarketMode(symbol, mode); // Construct mode-specific PK
    const newStatus = "DELISTED";

    console.log(`Admin DELETE (Delist): Setting market ${pk} status to ${newStatus}`);
    await ddb.send(
      new UpdateItemCommand({
        TableName: MARKETS_TABLE,
        Key: marshall({ pk: pk, sk: "META" }),
        UpdateExpression: "SET #s = :del",
         ConditionExpression: "attribute_exists(pk)", // Ensure market exists
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: marshall({ ":del": newStatus }),
      })
    );
    return NextResponse.json({ ok: true, symbol, mode, status: newStatus });
  } catch (err: any) {
     if (err?.name === "ConditionalCheckFailedException") {
        return NextResponse.json({ error: `market not found for symbol '${symbol}' and mode '${mode}'` }, { status: 404 });
    }
    console.error(`Admin Delist Error for ${symbol} (${mode}):`, err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}