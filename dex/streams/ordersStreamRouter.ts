import { DynamoDBStreamEvent, DynamoDBStreamHandler } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { Order, OrderQueueMessage } from "../../src/lib/interfaces";
import { AttributeValue } from "@aws-sdk/client-dynamodb";

const sqs = new SQSClient({});

/** Map orderType → FIFO queue URL (injected by SST’s `link` helper) */
const QUEUE_URL_BY_TYPE: Record<Order["orderType"], string> = {
  MARKET:  process.env.MARKET_ORDERS_QUEUE_URL!,
  LIMIT:   process.env.MARKET_ORDERS_QUEUE_URL!,     // handled by same matcher
  PERP:    process.env.PERPS_ORDERS_QUEUE_URL!,
  FUTURE:  process.env.FUTURES_ORDERS_QUEUE_URL!,
  OPTION:  process.env.OPTIONS_ORDERS_QUEUE_URL!,
};

export const handler: DynamoDBStreamHandler = async (event: DynamoDBStreamEvent) => {
  const sendPromises = event.Records.flatMap((rec) => {
    if (rec.eventName !== "INSERT" || !rec.dynamodb?.NewImage) return [];

    /** Order row *exactly* as persisted in Orders table */
    const order = unmarshall(rec.dynamodb.NewImage as Record<string, AttributeValue>) as unknown as Order;
    const queueUrl = QUEUE_URL_BY_TYPE[order.orderType];

    if (!queueUrl) {
      console.error(`Unknown orderType '${order.orderType}' for order ${order.orderId}`);
      return [];
    }

    const payload: OrderQueueMessage = {
      orderId: order.orderId,
      market: order.market,
      order,
    };

    return sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(payload),
        /** group = market ensures price‑time priority inside a market */
        MessageGroupId: order.market,
        /** deduplicationId = orderId avoids duplicate enqueue */
        MessageDeduplicationId: order.orderId,
      }),
    );
  });

  await Promise.all(sendPromises);
};