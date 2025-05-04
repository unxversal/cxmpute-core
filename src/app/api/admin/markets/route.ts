import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { requireAdmin } from "@/lib/auth";                    // ← your helper
import { Resource } from "sst";

/* ─── env & contracts ───────────────────────────────────── */
const {
  FACTORY_ADDR,
  VAULT_ADDR,
  PEAQ_RPC_URL,
  CHAIN_ID = "3338",
  ADMIN_PK,
} = process.env;

const factoryAbi = [
  "event SynthCreated(address indexed synth,string name,string symbol)",
  "function createSynth(string name,string symbol) returns (address)",
];
const vaultAbi = ["function registerSynth(address synth)"];

const provider = new ethers.JsonRpcProvider(PEAQ_RPC_URL!, +CHAIN_ID);
const signer   = new ethers.Wallet(ADMIN_PK!, provider);
const factory  = new ethers.Contract(FACTORY_ADDR!, factoryAbi, signer);
const vault    = new ethers.Contract(VAULT_ADDR!,   vaultAbi,   signer);

const ddb     = new DynamoDBClient({});
const MKT_TBL = Resource.MarketsTable.name;

/* pk helper identical to matchEngine */
const pk = (sym: string) => `MARKET#${sym}`;

/* ───────────────────────── POST = create market ────────── */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);            // throws if not admin

  try {
    const {
      symbol,                 // e.g. "SOL-PERP"
      type,                   // "PERP" | "FUTURE" | "OPTION" | "SPOT"
      tickSize,
      lotSize,
      fundingIntervalSec,     // optional
      expiryTs,               // optional (future / option)
    } = await req.json();

    if (!symbol || !type || !tickSize || !lotSize)
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });

    /* 1️⃣  Deploy synth via Factory (deterministic CREATE2) */
    const asset = symbol.split("-")[0];                 // "SOL"
    const synthName   = `Synthetic ${asset}`;
    const synthSymbol = `s${asset}`;

    const tx   = await factory.createSynth(synthName, synthSymbol);
    const rcpt = await tx.wait(1);

    const synthAddr = rcpt.logs
      .map((l) => factory.interface.parseLog(l))
      .find((l) => l?.name === "SynthCreated")!.args.synth as string;

    /* 2️⃣  Vault whitelist */
    await vault.registerSynth(synthAddr);

    /* 3️⃣  Insert Markets row (status = PAUSED until unpaused explicitly) */
    await ddb.send(
      new PutItemCommand({
        TableName: MKT_TBL,
        Item: marshall({
          pk: pk(symbol),
          sk: "META",
          symbol,
          type,
          status: "PAUSED",
          tickSize,
          lotSize,
          fundingIntervalSec,
          expiryTs,
          synth: synthAddr,
          createdAt: Date.now(),
          createdBy: admin.email,
        }),
        ConditionExpression: "attribute_not_exists(pk)",
      })
    );

    return NextResponse.json({ symbol, synthAddr, txHash: tx.hash }, { status: 201 });
  } catch (err) {
    console.error("admin create market", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

/* ───────────────────────── PATCH = pause / unpause ─────── */
export async function PATCH(req: NextRequest) {
  await requireAdmin(req);

  const { symbol, action } = await req.json() as {
    symbol: string;
    action: "PAUSE" | "UNPAUSE";
  };

  if (!symbol || !action)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: MKT_TBL,
        Key: marshall({ pk: pk(symbol), sk: "META" }),
        UpdateExpression: "SET #s = :st",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":st": { S: action === "PAUSE" ? "PAUSED" : "ACTIVE" } },
      })
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin pause/unpause", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

/* ───────────────────────── DELETE = delist market ──────── */
export async function DELETE(req: NextRequest) {
  await requireAdmin(req);

  const { symbol } = await req.json();
  if (!symbol)
    return NextResponse.json({ error: "symbol required" }, { status: 400 });

  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: MKT_TBL,
        Key: marshall({ pk: pk(symbol), sk: "META" }),
        UpdateExpression: "SET #s = :del",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":del": { S: "DELISTED" } },
      })
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin delist", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}