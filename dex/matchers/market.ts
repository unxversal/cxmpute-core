import { SQSHandler, SQSEvent } from "aws-lambda";
import { matchOrder } from "./matchEngine";
import { OrderQueueMessage, Order } from "../../src/lib/interfaces";
import {
  SNSClient,
  PublishCommand,
} from "@aws-sdk/client-sns";
import { Resource } from "sst";

const sns = new SNSClient({});

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const rec of event.Records) {
    const msg = JSON.parse(rec.body) as OrderQueueMessage;
    const order = msg.order as Order;

    await matchOrder(order);

    // Fan‑out to WS
    await sns.send(
      new PublishCommand({
        TopicArn: Resource.MarketUpdatesTopic.arn,
        Message: JSON.stringify({
          type: "orderUpdate",
          market: order.market,
          orderId: order.orderId,
        }),
      })
    );
  }
};