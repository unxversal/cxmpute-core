/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/streams/ordersStreamRouter.ts
import { DynamoDBStreamHandler, DynamoDBStreamEvent } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import type { Order, OrderQueueMessage, TradingMode } from "../../src/lib/interfaces";

const sqs = new SQSClient({});

// Matcher Queues (existing)
const marketOrdersQueueUrl = (Resource as any).MarketOrdersQueue.url;
const optionsOrdersQueueUrl = (Resource as any).OptionsOrdersQueue.url;
const perpsOrdersQueueUrl = (Resource as any).PerpsOrdersQueue.url;
const futuresOrdersQueueUrl = (Resource as any).FuturesOrdersQueue.url;

// New Cancellation Queue
const CANCELLED_ORDERS_QUEUE_URL = (Resource as any).CancelledOrdersQueue.url;

const queueUrls = {
  MARKET: marketOrdersQueueUrl,
  LIMIT: marketOrdersQueueUrl,
  OPTION: optionsOrdersQueueUrl,
  PERP: perpsOrdersQueueUrl,
  FUTURE: futuresOrdersQueueUrl,
};

const parseModeFromPk = (pk: string): TradingMode | null => {
  const parts = pk.split("#");
  if (parts.length === 3 && parts[0] === "MARKET") {
    const mode = parts[2].toUpperCase();
    if (mode === "REAL" || mode === "PAPER") return mode as TradingMode;
  }
  return null;
};

export const handler: DynamoDBStreamHandler = async (event: DynamoDBStreamEvent) => {
  for (const record of event.Records) {
    if (record.eventSource !== "aws:dynamodb") continue;

    // --- Handle New Order Insertions (Existing Logic) ---
    if (record.eventName === "INSERT" && record.dynamodb?.NewImage) {
      try {
        const newImage = unmarshall(record.dynamodb.NewImage as any) as Order & { pk: string; sk: string };
        const mode = newImage.mode || parseModeFromPk(newImage.pk); // Ensure mode is on the Order interface
        if (!mode) {
          console.error(`OrdersStreamRouter: Missing mode for new order ${newImage.orderId}, pk: ${newImage.pk}`);
          continue;
        }
        const orderType = newImage.orderType;
        const targetQueueUrl = (queueUrls as any)[orderType];
        if (!targetQueueUrl) {
          console.warn(`OrdersStreamRouter: No queue for order type: ${orderType}`);
          continue;
        }
        const messagePayload: OrderQueueMessage = {
          orderId: newImage.orderId, market: newImage.market, order: newImage, mode: mode,
        };
        await sqs.send(new SendMessageCommand({
          QueueUrl: targetQueueUrl, MessageBody: JSON.stringify(messagePayload),
          MessageGroupId: `${newImage.market}-${mode}`, MessageDeduplicationId: newImage.orderId,
        }));
      } catch (error) {
        console.error("OrdersStreamRouter: Error processing INSERT record for matching:", error, record.dynamodb?.NewImage);
      }
    }
    // --- Handle Order Cancellations (New Logic) ---
    else if (record.eventName === "MODIFY" && record.dynamodb?.OldImage && record.dynamodb?.NewImage) {
      try {
        const oldImage = unmarshall(record.dynamodb.OldImage as any) as Partial<Order>; // Partial, as some fields might not change
        const newImage = unmarshall(record.dynamodb.NewImage as any) as Order; // Full new state of the order

        if ((oldImage.status === "OPEN" || oldImage.status === "PARTIAL") && newImage.status === "CANCELLED") {
          console.log(`OrdersStreamRouter: Order ${newImage.orderId} cancelled. Routing for collateral release.`);
          
          // Ensure 'mode' is present on the newImage (it's part of the Order interface)
          const modeForCancellation = newImage.mode;
          if (!modeForCancellation) {
              console.error(`OrdersStreamRouter: Mode is undefined for cancelled order ${newImage.orderId}. Cannot route for collateral release.`);
              continue;
          }

          const cancellationMessage = {
            type: "ORDER_CANCELLED_FOR_COLLATERAL_RELEASE", // Specific type for this queue
            order: newImage, // Send the full CANCELLED order object
            // mode: modeForCancellation, // mode is already on the order object
          };

          await sqs.send(new SendMessageCommand({
            QueueUrl: CANCELLED_ORDERS_QUEUE_URL,
            MessageBody: JSON.stringify(cancellationMessage),
            MessageGroupId: `${newImage.market}-${newImage.mode}-cancel`, // FIFO Grouping
            MessageDeduplicationId: `${newImage.orderId}-cancel-collateral-release-${Date.now()}`, // Unique ID for deduplication
          }));
        }
      } catch (error) {
        console.error("OrdersStreamRouter: Error processing MODIFY record for cancellation:", error, record.dynamodb);
      }
    }
  }
};