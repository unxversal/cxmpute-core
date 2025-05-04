import { SQSHandler } from "aws-lambda";
import { matchOrder } from "./matchEngine";
import { OrderQueueMessage, FutureOrder } from "../../src/lib/interfaces";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { Resource } from "sst";

const sns = new SNSClient({});

export const handler: SQSHandler = async (ev) => {
  for (const r of ev.Records) {
    const { order } = JSON.parse(r.body) as OrderQueueMessage;
    await matchOrder(order as FutureOrder);

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