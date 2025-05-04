/* runtime‑hints so Next.js keeps this lambda in Node */
export const runtime = "nodejs";      // ← SST Nextjs edge‑λ
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

/* ─── env single‑source‑of‑truth ─────────────────────── */
const {
  PEAQ_RPC_URL,            // e.g. `https://peaq.api.onfinality.io/public`
  VAULT_ADDR,              // deployed Vault address
  USDC_ADDR,               // bridged USDC (ERC‑20) on peaq
  SERVER_PK,               // hot wallet that pays gas (use test key on agung)
  CHAIN_ID = "3338",       // 3338 = peaq mainnet, 9990 = agung testnet
} = process.env;

/* minimal ABIs – only the functions we call */
const vaultAbi = ["function deposit(uint256 amt)"];
const erc20Abi = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amt) returns (bool)",
];

const ddb = new DynamoDBClient({});
const TABLE = Resource.BalancesTable.name;

/* ──────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const { traderId, amt, permit } = (await req.json()) as {
      traderId: string;
      amt: string;                     /* raw units string, e.g. "1000000" */
      /* optional EIP‑2612 permit {v,r,s,deadline} passed from front‑end */
      permit?: { v: number; r: string; s: string; deadline: string };
    };

    if (!traderId || !amt) {
      return NextResponse.json(
        { error: "traderId & amt required" },
        { status: 400 }
      );
    }

    /* signer pays gas; vault pulls funds from trader wallet */
    const provider = new ethers.JsonRpcProvider(PEAQ_RPC_URL, +CHAIN_ID);
    const signer   = new ethers.Wallet(SERVER_PK!, provider);

    /* 1️⃣  (optional) record permit if supplied */
    const usdc  = new ethers.Contract(USDC_ADDR!, erc20Abi, provider);
    if (permit) {
      /* front‑end already called permit() in USDC; nothing to do here */
    } else {
      /* fail fast if allowance is 0 – user forgot to approve */
      const allowance = await usdc.allowance(traderId, VAULT_ADDR);
      if (allowance < BigInt(amt)) {
        return NextResponse.json(
          { error: "USDC allowance insufficient" },
          { status: 402 }
        );
      }
    }

    /* 2️⃣  craft & broadcast tx */
    const vault = new ethers.Contract(VAULT_ADDR!, vaultAbi, signer);
    const tx    = await vault.deposit(amt);
    await tx.wait(1);                                      // 1 confirmation

    /* 3️⃣ optimistically bump Balances table (chain listener will confirm) */
    await ddb.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: marshall({ traderId, asset: "USDC" }),
        UpdateExpression: "ADD balance :b",
        ExpressionAttributeValues: { ":b": { N: amt } },
      })
    );

    return NextResponse.json({ txHash: tx.hash });
  } catch (err) {
    console.error("deposit error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}