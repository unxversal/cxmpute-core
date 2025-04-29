// dex/settle.ts
import { SQSHandler } from "aws-lambda";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SettlementFill } from "./types";
import { polygonMumbai } from "viem/chains";

// Configure client with your contract and chain
const ENGINE_ADDRESS = process.env.ENGINE_CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.SETTLEMENT_WALLET_KEY;

const ddb = new DynamoDBClient({});
const TRADES_TABLE = Resource.TradesTable.name;

// Setup wallet from private key stored in environment
// In production, use AWS Secrets Manager
const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const wallet = createWalletClient({
  account,
  chain: polygonMumbai,
  transport: http()
});

export const handler: SQSHandler = async (event) => {
  const allFills: SettlementFill[] = [];
  
  // Collect all fills from queue batch
  for (const record of event.Records) {
    const fills = JSON.parse(record.body) as SettlementFill[];
    allFills.push(...fills);
  }
  
  if (allFills.length === 0) return;
  
  try {
    // Prepare the settlement data for the contract
    const settlementBatch = allFills.map(fill => ({
      market: fill.market,
      price: parseEther(fill.price.toString()),
      quantity: parseEther(fill.qty.toString()),
      buyer: fill.buyer,
      seller: fill.seller,
      tradeId: fill.tradeId,
      timestamp: BigInt(fill.ts)
    }));

    // Call Engine.settleBatch() on chain
    const tx = await wallet.writeContract({
      address: ENGINE_ADDRESS as `0x${string}`,
      abi: [{
        name: "settleBatch",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{
          name: "fills",
          type: "tuple[]",
          components: [
            { name: "market", type: "string" },
            { name: "price", type: "uint256" },
            { name: "quantity", type: "uint256" },
            { name: "buyer", type: "address" },
            { name: "seller", type: "address" },
            { name: "tradeId", type: "bytes32" },
            { name: "timestamp", type: "uint256" }
          ]
        }],
        outputs: []
      }],
      functionName: "settleBatch",
      args: [settlementBatch]
    });
    
    console.log(`Settlement batch of ${allFills.length} fills sent with tx: ${tx}`);
    
    // Mark trades as settled in DB
    await Promise.all(allFills.map(fill => 
      ddb.send(new UpdateItemCommand({
        TableName: TRADES_TABLE,
        Key: marshall({ 
          pk: `MARKET#${fill.market}`, 
          sk: `TS#${fill.ts}#${fill.tradeId}` 
        }),
        UpdateExpression: "SET settled = :true, txHash = :tx",
        ExpressionAttributeValues: marshall({
          ":true": true,
          ":tx": tx
        })
      }))
    ));
  } catch (error) {
    console.error("Settlement error:", error);
    // In production, add DLQ and retry logic
    throw error;
  }
};