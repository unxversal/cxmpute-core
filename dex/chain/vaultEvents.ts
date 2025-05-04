import { Handler } from "aws-lambda";
import { ethers } from "ethers";
import {
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const {
  PEAQ_WSS_URL,   // wss://peaq-rpc.publicnode.com  (or private)
  VAULT_ADDR,
  CHAIN_ID = "3338",
} = process.env;

const vaultAbi = [
  "event Deposited(address indexed user,uint256 amt)",
  "event Withdrawn(address indexed user,uint256 amt,bool asCxpt)",
  "event SynthMinted(address indexed synth,address indexed to,uint256 amt)",
  "event SynthBurned(address indexed synth,address indexed from,uint256 amt)",
];

const ddb   = new DynamoDBClient({});
const BAL   = Resource.BalancesTable.name;

/* helper */
const up = (trader: string, asset: string, delta: bigint) =>
  ddb.send(
    new UpdateItemCommand({
      TableName: BAL,
      Key: marshall({ traderId: trader, asset }),
      UpdateExpression: "ADD balance :d",
      ExpressionAttributeValues: { ":d": { N: delta.toString() } },
    })
  );

/* ───────────────────────── Lambda entry ─────────────────────────── */
export const handler: Handler = async () => {
  const provider = new ethers.WebSocketProvider(PEAQ_WSS_URL!, +CHAIN_ID);
  const vault    = new ethers.Contract(VAULT_ADDR!, vaultAbi, provider);

  console.log("📡 listening for Vault events ...");

  vault.on(
    "Deposited",
    async (user: string, amt: bigint) => {
      await up(user, "USDC", amt);
      console.log("→ deposit", user, amt.toString());
    }
  );

  vault.on(
    "Withdrawn",
    async (user: string, amt: bigint, asCxpt: boolean) => {
      await up(user, asCxpt ? "CXPT" : "USDC", -amt);
      console.log("← withdraw", user, amt.toString(), asCxpt ? "CXPT" : "USDC");
    }
  );

  vault.on(
    "SynthMinted",
    async (_synth, to: string, amt: bigint) => {
      await up(to, "SYNTH", amt); /* asset string not strictly used here */
    }
  );

  vault.on(
    "SynthBurned",
    async (_synth, from: string, amt: bigint) => {
      await up(from, "SYNTH", -amt);
    }
  );

  /* keep the WS alive until Lambda timeout (max 15 min) */
  await new Promise(() => undefined);
};