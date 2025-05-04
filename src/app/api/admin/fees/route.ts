import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { requireAdmin } from "@/lib/auth";
import { Resource } from "sst";

const {
  VAULT_ADDR,
  PEAQ_RPC_URL,
  CHAIN_ID = "3338",
  ADMIN_PK,
} = process.env;

const vaultAbi = ["function withdrawFees(address to,uint256 amt)"];

const provider = new ethers.JsonRpcProvider(PEAQ_RPC_URL!, +CHAIN_ID);
const signer   = new ethers.Wallet(ADMIN_PK!, provider);
const vault    = new ethers.Contract(VAULT_ADDR!, vaultAbi, signer);

const LIFETIME = Resource.StatsLifetimeTable.name;

/* ───────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  await requireAdmin(req);

  const { to, amt } = await req.json() as { to: string; amt: string };
  if (!ethers.isAddress(to) || !amt)
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    const tx = await vault.withdrawFees(to, amt);
    await tx.wait(1);

    /* decrement outstanding fee counter (optional bookkeeping) */
    const ddb = new DynamoDBClient({});
    await ddb.send(
      new UpdateItemCommand({
        TableName: LIFETIME,
        Key: marshall({ pk: "KEY#GLOBAL", sk: "META" }),
        UpdateExpression: "ADD fees :neg",
        ExpressionAttributeValues: { ":neg": { N: "-" + amt } },
      })
    );

    return NextResponse.json({ txHash: tx.hash });
  } catch (err) {
    console.error("withdraw fees", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}