// dex/streams/tradesStreamRouter.ts
import { DynamoDBStreamHandler, DynamoDBStreamEvent } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import type { Trade } from "@/lib/interfaces"; // Your Trade interface

const sqs = new SQSClient({});
const KLINE_AGGREGATION_QUEUE_URL = Resource.KlineAggregationQueue.url;

export const handler: DynamoDBStreamHandler = async (event: DynamoDBStreamEvent) => {
  for (const record of event.Records) {
    if (record.eventSource !== "aws:dynamodb") continue;

    // --- Logic for Forwarding to Kline Aggregation Queue ---
    if (record.eventName === "INSERT" && record.dynamodb?.NewImage) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const trade = unmarshall(record.dynamodb.NewImage as any) as Trade;

        // Enrich or ensure necessary fields for kline aggregator
        // The `Trade` interface should already have market, mode, price, qty, timestamp.
        // If `mode` isn't on the Trade record directly, parse from `trade.pk`
        if (!trade.mode && trade.pk) {
            const pkParts = trade.pk.split('#');
            if (pkParts.length === 3) {
                trade.mode = pkParts[2] as Trade['mode'];
            }
        }
        if (!trade.market && trade.pk) {
            const pkParts = trade.pk.split('#');
            if (pkParts.length >= 2) {
                 trade.market = pkParts[1]; // Assuming PK is MARKET#SYMBOL#MODE
            }
        }


        if (trade.market && trade.mode && trade.price !== undefined && trade.qty !== undefined && trade.timestamp) {
          await sqs.send(
            new SendMessageCommand({
              QueueUrl: KLINE_AGGREGATION_QUEUE_URL,
              MessageBody: JSON.stringify(trade),
              // MessageGroupId: `${trade.market}-${trade.mode}`, // If KlineAggregationQueue is FIFO
              // MessageDeduplicationId: trade.tradeId, // If KlineAggregationQueue is FIFO
            })
          );
          // console.log(`Trade ${trade.tradeId} sent to KlineAggregationQueue.`);
        } else {
            console.warn("Trade record missing necessary fields for kline aggregation, skipping:", trade);
        }
      } catch (error) {
        console.error("Error processing Trade stream record for kline aggregation:", error, record.dynamodb.NewImage);
      }
    }

    // --- Existing Logic (if this router also handles other things like order stream routing) ---
    // Example: if (record.eventSourceTableName === Resource.OrdersTable.name) { ... }
    // This part depends on whether this is a dedicated trades router or a combined one.
    // For clarity, I'm assuming this router is primarily for trades now.
    // If it's the same as `ordersStreamRouter.ts`, merge this logic in.
    // Based on your SST config `tradesTable.subscribe("TradesStreamRouterForAggregators", ...)`
    // this seems to be a router specifically for the tradesTable stream.
  }
};