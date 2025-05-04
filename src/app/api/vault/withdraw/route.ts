import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const {
  PEAQ_RPC_URL,
  VAULT_ADDR,
  SERVER_PK,
  CHAIN_ID = "3338",
} = process.env;

const vaultAbi = ["function withdraw(uint256 amt,bool asCxpt)"];

const ddb   = new DynamoDBClient({});
const TABLE = Resource.BalancesTable.name;

/* ──────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const { traderId, amt, asCxpt = false } = (await req.json()) as {
      traderId: string;
      amt: string;        /* raw units */
      asCxpt?: boolean;
    };

    if (!traderId || !amt) {
      return NextResponse.json(
        { error: "traderId & amt required" },
        { status: 400 }
      );
    }

    const provider = new ethers.JsonRpcProvider(PEAQ_RPC_URL, +CHAIN_ID);
    const signer   = new ethers.Wallet(SERVER_PK!, provider);
    const vault    = new ethers.Contract(VAULT_ADDR!, vaultAbi, signer);

    const tx = await vault.withdraw(amt, asCxpt);
    await tx.wait(1);

    /* optimistically subtract – listener will reconcile */
    await ddb.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: marshall({ traderId, asset: asCxpt ? "CXPT" : "USDC" }),
        UpdateExpression: "ADD balance :neg",
        ExpressionAttributeValues: { ":neg": { N: "-" + amt } },
      })
    );

    return NextResponse.json({ txHash: tx.hash });
  } catch (err) {
    console.error("withdraw error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}