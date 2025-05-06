// dex/streams/ordersStreamRouter.ts
import { DynamoDBStreamHandler, DynamoDBStreamEvent } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import type { Order, OrderQueueMessage, TradingMode } from "../../src/lib/interfaces"; // Import TradingMode

const sqs = new SQSClient({});

// Map order types to their respective queue URLs (fetched from SST Resources)
const queueUrls = {
  MARKET: Resource.MarketOrdersQueue.url,
  LIMIT: Resource.MarketOrdersQueue.url, // Market and Limit use the same queue/matcher
  OPTION: Resource.OptionsOrdersQueue.url,
  PERP: Resource.PerpsOrdersQueue.url,
  FUTURE: Resource.FuturesOrdersQueue.url,
};

/**
 * Parses the mode ("REAL" or "PAPER") from the DynamoDB PK.
 * PK format: MARKET#<symbol>#<mode>
 */
const parseModeFromPk = (pk: string): TradingMode | null => {
  const parts = pk.split("#");
  if (parts.length === 3 && parts[0] === "MARKET") {
    const mode = parts[2].toUpperCase();
    if (mode === "REAL" || mode === "PAPER") {
      return mode as TradingMode;
    }
  }
  console.error(`Could not parse mode from PK: ${pk}`);
  return null;
};


export const handler: DynamoDBStreamHandler = async (
  event: DynamoDBStreamEvent
) => {
  for (const record of event.Records) {
    // Only process new order insertions
    if (record.eventName !== "INSERT" || !record.dynamodb?.NewImage) {
      continue;
    }

    try {
      // Unmarshall the full order item from the stream
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newImage = unmarshall(record.dynamodb.NewImage as any) as Order & { pk: string; sk: string};

      // --- Paper Trading: Parse Mode ---
      const mode = parseModeFromPk(newImage.pk);
      if (!mode) {
          console.error(`Skipping record - failed to parse mode for orderId: ${newImage.orderId}, pk: ${newImage.pk}`);
          continue; // Skip processing if mode cannot be determined
      }
      // --- End Paper Trading ---

      const orderType = newImage.orderType;

      // Determine the target queue based on order type

      const targetQueueUrl = queueUrls[orderType];

      if (!targetQueueUrl) {
        console.warn(`No queue configured for order type: ${orderType}`);
        continue; // Skip if no queue is mapped
      }

      // Prepare the message for the SQS queue
      const messagePayload: OrderQueueMessage = {
        orderId: newImage.orderId,
        market: newImage.market,
        order: newImage, // Pass the full unmarshalled order item
        mode: mode,      // Include the parsed mode
      };

      // Send the message to the specific SQS queue
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: targetQueueUrl,
          MessageBody: JSON.stringify(messagePayload),
          // FIFO specific properties: MessageGroupId determines the partition (matching engine)
          // Use the market symbol and mode to ensure orders for the same market/mode are processed sequentially.
          MessageGroupId: `${newImage.market}-${mode}`,
          // MessageDeduplicationId can be based on orderId for idempotency
          MessageDeduplicationId: newImage.orderId,
        })
      );

      // console.log(`Order ${newImage.orderId} (${mode}) routed to queue for ${orderType}`);

    } catch (error) {
      console.error("Error processing DynamoDB stream record:", error);
      console.error("Failed record:", JSON.stringify(record, null, 2));
      // Consider sending failed records to a Dead Letter Queue (DLQ) configured on the Lambda
    }
  }
};