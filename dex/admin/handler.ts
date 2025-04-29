/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/admin/handler.ts
import { EventBridgeHandler } from "aws-lambda";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { SSMClient, PutParameterCommand, GetParameterCommand } from "@aws-sdk/client-ssm";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});
const ssm = new SSMClient({});
const sqs = new SQSClient({});

// Table names
const MARKETS = Resource.MarketsTable.name;
const SETTLEMENT_QUEUE = Resource.SettlementQueue.url;

// SSM parameter paths
const FEE_PARAM_PATH = "/dex/config/platform-fee-bps";
const PAUSED_MARKETS_PATH = "/dex/config/paused-markets";

interface AdminEvent {
  action: "PAUSE_MARKET" | "RESUME_MARKET" | "UPDATE_FEE" | "FORCE_SETTLEMENT";
  market?: string; // For market-specific actions
  feeRateBps?: number; // For fee updates
  data?: Record<string, any>; // For other action-specific data
  initiator?: string; // Who triggered this
  timestamp?: string; // When it was triggered
}

const handler: EventBridgeHandler<string, AdminEvent, void> = async (event) => {
  const adminEvent = event.detail;
  console.log("Processing admin event:", adminEvent);

  switch (adminEvent.action) {
    case "PAUSE_MARKET":
      await pauseMarket(adminEvent.market!);
      break;
    case "RESUME_MARKET":
      await resumeMarket(adminEvent.market!);
      break;
    case "UPDATE_FEE":
      await updatePlatformFee(adminEvent.feeRateBps!);
      break;
    case "FORCE_SETTLEMENT":
      await forceSettlement(adminEvent.market);
      break;
    default:
      console.error("Unknown admin action:", adminEvent.action);
  }
};

export default handler;

/**
 * Pause trading for a market by adding it to paused-markets SSM parameter
 */
async function pauseMarket(market: string) {
  // Get current paused markets
  const pausedMarkets = await getPausedMarkets();
  
  // Add the market if not already paused
  if (!pausedMarkets.includes(market)) {
    pausedMarkets.push(market);
    
    // Update the parameter
    await ssm.send(
      new PutParameterCommand({
        Name: PAUSED_MARKETS_PATH,
        Value: JSON.stringify(pausedMarkets),
        Type: "String",
        Overwrite: true,
      })
    );
    
    console.log(`Market ${market} paused successfully`);
  }
  
  // Update market status in database
  await ddb.send(
    new UpdateItemCommand({
      TableName: MARKETS,
      Key: marshall({ pk: `MARKET#${market}`, sk: "INFO" }),
      UpdateExpression: "SET marketStatus = :paused",
      ExpressionAttributeValues: marshall({ ":paused": "PAUSED" }),
    })
  );
}

/**
 * Resume trading for a market by removing it from paused-markets SSM parameter
 */
async function resumeMarket(market: string) {
  // Get current paused markets
  const pausedMarkets = await getPausedMarkets();
  
  // Remove the market if it's paused
  const newPausedMarkets = pausedMarkets.filter(m => m !== market);
  
  if (newPausedMarkets.length !== pausedMarkets.length) {
    // Update the parameter
    await ssm.send(
      new PutParameterCommand({
        Name: PAUSED_MARKETS_PATH,
        Value: JSON.stringify(newPausedMarkets),
        Type: "String",
        Overwrite: true,
      })
    );
    
    console.log(`Market ${market} resumed successfully`);
  }
  
  // Update market status in database
  await ddb.send(
    new UpdateItemCommand({
      TableName: MARKETS,
      Key: marshall({ pk: `MARKET#${market}`, sk: "INFO" }),
      UpdateExpression: "SET marketStatus = :active",
      ExpressionAttributeValues: marshall({ ":active": "ACTIVE" }),
    })
  );
}

/**
 * Update the platform fee rate (in basis points)
 */
async function updatePlatformFee(feeRateBps: number) {
  if (feeRateBps < 0 || feeRateBps > 100) {
    throw new Error("Fee rate must be between 0 and 100 bps");
  }
  
  await ssm.send(
    new PutParameterCommand({
      Name: FEE_PARAM_PATH,
      Value: feeRateBps.toString(),
      Type: "String",
      Overwrite: true,
    })
  );
  
  console.log(`Platform fee updated to ${feeRateBps} bps`);
}

/**
 * Force settlement for a specific market or all markets
 */
async function forceSettlement(market?: string) {
  // This is a simple implementation - in production you'd want more safeguards
  // and possibly get unsettled trades from the database
  
  // For demonstration, we'll create a synthetic settlement message
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: SETTLEMENT_QUEUE,
      MessageBody: JSON.stringify([
        {
          market: market || "SYSTEM",
          type: "FORCE_SETTLE",
          ts: Date.now(),
        },
      ]),
    })
  );
  
  console.log(`Force settlement initiated for ${market || "all markets"}`);
}

/**
 * Helper to get the current list of paused markets
 */
async function getPausedMarkets(): Promise<string[]> {
  try {
    const paramResult = await ssm.send(
      new GetParameterCommand({
        Name: PAUSED_MARKETS_PATH,
      })
    );
    
    return JSON.parse(paramResult.Parameter?.Value || "[]");
  } catch (error: any) {
    if (error.name === "ParameterNotFound") {
      // Initialize the parameter if it doesn't exist
      await ssm.send(
        new PutParameterCommand({
          Name: PAUSED_MARKETS_PATH,
          Value: "[]",
          Type: "String",
        })
      );
      return [];
    }
    throw error;
  }
}