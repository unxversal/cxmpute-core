// dex/matchers/market.ts (Example - Apply similar changes to options.ts, perps.ts, futures.ts)
import { SQSHandler, SQSEvent } from "aws-lambda";
import { matchOrder } from "./matchEngine"; // Assuming matchOrder is updated
import {
    OrderQueueMessage,
    TradingMode, // Import TradingMode
    MarketOrder, // Specific types if needed for casting
    LimitOrder
} from "../../src/lib/interfaces";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { Resource } from "sst";

const sns = new SNSClient({});

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const rec of event.Records) {
    try {
        const msg = JSON.parse(rec.body) as OrderQueueMessage; // Parse the full message

        // Extract order details and the mode
        const order = msg.order as (MarketOrder | LimitOrder); // Cast to appropriate types for this matcher
        const mode: TradingMode = msg.mode;
        const market: string = msg.market; // Or msg.order.market
        const orderId: string = msg.orderId; // Or msg.order.orderId

        if (!mode) {
             console.error(`Matcher Error: Missing mode in SQS message for orderId ${orderId}. Skipping.`);
             continue;
        }

        // Call the updated matchOrder function, passing the mode
        await matchOrder(order, mode); // Pass mode to the matching engine

        // Fan-out WebSocket update via SNS (include mode in the SNS message)
        await sns.send(
          new PublishCommand({
            TopicArn: Resource.MarketUpdatesTopic.arn,
            Message: JSON.stringify({
              type: "orderUpdate", // Keep message type consistent
              market: market,
              orderId: orderId,
              mode: mode, // Include mode in the WS payload
              // Add other relevant order details if needed by WS clients
              status: order.status // Example: Current status might be useful
            }),
            // Optional: Use MessageAttributes for filtering on the SNS subscriber side if needed
            // MessageAttributes: {
            //     'mode': { DataType: 'String', StringValue: mode },
            //     'market': { DataType: 'String', StringValue: market }
            // }
          })
        );
    } catch (error) {
        console.error(`Error processing SQS message for order: ${rec.messageId}`, error);
        console.error("Failed message body:", rec.body);
        // Implement retry or DLQ logic as needed
        // Re-throwing the error might cause SQS to retry the message automatically (depending on Lambda config)
        // throw error;
    }
  }
};