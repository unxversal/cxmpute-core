/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/ws/fanOut.ts
import { SNSHandler, SNSEvent } from "aws-lambda";
import {
  DynamoDBClient,
  ScanCommand, // Note: Scan is inefficient. GSI recommended for production.
  DeleteItemCommand,
  ScanCommandInput
} from "@aws-sdk/client-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException, // Import specific exception
} from "@aws-sdk/client-apigatewaymanagementapi";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import type { TradingMode } from "../../src/lib/interfaces"; // Import TradingMode

const ddb = new DynamoDBClient({});
const WS_TABLE = Resource.WSConnectionsTable.name;

// API Gateway Management API Client - endpoint injected by SST link
const apigw = new ApiGatewayManagementApiClient({
  endpoint: process.env.WS_API_URL, // Provided by wsApi.link() in sst.config.ts
});

// Interface for the expected structure of the SNS message payload
interface SnsPayload {
    type: string; // e.g., "orderUpdate", "fundingRateUpdate"
    mode: TradingMode; // Crucial: Mode must be included by the publisher (matcher/CRON)
    market?: string; // e.g., "BTC-PERP" - for market channels
    traderId?: string; // e.g., "uuid123abc" - for trader channels
    // ... other payload data (orderId, status, fundingRate, etc.)
    [key: string]: any; // Allow other properties
}


export const handler: SNSHandler = async (ev: SNSEvent) => {
  // Process each message received from SNS (usually just one unless batching is enabled)
  for (const record of ev.Records) {
      let payload: SnsPayload;
      try {
          payload = JSON.parse(record.Sns.Message) as SnsPayload;

          // --- Validate Payload ---
          if (!payload.mode || (payload.mode !== "REAL" && payload.mode !== "PAPER")) {
              console.error("FanOut Error: SNS message missing or invalid 'mode'. Skipping.", record.Sns.Message);
              continue; // Skip this message
          }
          if (!payload.type || (!payload.market && !payload.traderId)) {
               console.error("FanOut Error: SNS message missing type or identifier (market/traderId). Skipping.", record.Sns.Message);
               continue;
          }
          // --- End Validation ---

      } catch (error) {
          console.error("FanOut Error: Failed to parse SNS message JSON.", error, record.Sns.Message);
          continue; // Skip malformed messages
      }

      // --- Construct Target Channel String ---
      let targetChannel: string;
      if (payload.market) {
          targetChannel = `market.${payload.market}.${payload.mode}`; // e.g., market.BTC-PERP.PAPER
      } else if (payload.traderId) {
          targetChannel = `trader.${payload.traderId}.${payload.mode}`; // e.g., trader.uuid123.REAL
      } else {
          // Should not happen due to validation above, but good practice
          console.error("FanOut Logic Error: No market or traderId found in validated payload.", payload);
          continue;
      }
      // --- End Channel Construction ---


      // --- Find Subscribed Connections ---
      // PERFORMANCE NOTE: Scan is inefficient for many connections (> few thousand).
      // Create a GSI on the `channel` attribute for efficient lookups in production.
      // GSI Example: PK=channel, SK=pk (connectionId)
      let connections: { pk: string }[] = [];
      let lastEvaluatedKey: Record<string, any> | undefined = undefined;

      try {
          console.log(`FanOut: Searching connections for channel: ${targetChannel}`);
          do {
              const scanParams: ScanCommandInput = {
                  TableName: WS_TABLE,
                  // Filter based on the *exact* channel string (which includes mode)
                  FilterExpression: "#chan = :channelVal",
                  ExpressionAttributeNames: { "#chan": "channel" },
                  ExpressionAttributeValues: marshall({ ":channelVal": targetChannel }),
                  ProjectionExpression: "pk", // Only need the connection ID (pk)
                  ExclusiveStartKey: lastEvaluatedKey,
              };
              const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(scanParams));

              if (Items) {
                  connections = connections.concat(
                      Items.map(item => unmarshall(item) as { pk: string })
                  );
              }
              lastEvaluatedKey = LastEvaluatedKey;
          } while (lastEvaluatedKey);

          console.log(`FanOut: Found ${connections.length} connections for ${targetChannel}.`);

      } catch (error) {
          console.error(`FanOut Error: Failed to scan WSConnectionsTable for channel ${targetChannel}:`, error);
          continue; // Skip processing this message if connections can't be fetched
      }
      // --- End Finding Connections ---


      // --- Broadcast Message ---
      const broadcastPromises: Promise<any>[] = [];
      const messageData = Buffer.from(record.Sns.Message); // Send the original payload

      for (const conn of connections) {
          const connectionId = conn.pk.slice(3); // Extract ID from "WS#<connectionId>"

          const postPromise = apigw.send(
              new PostToConnectionCommand({
                  ConnectionId: connectionId,
                  Data: messageData,
              })
          ).catch(async (error: any) => {
              // Handle stale connections (client disconnected)
              if (error instanceof GoneException || error.statusCode === 410) {
                  console.log(`FanOut: Stale connection ${connectionId}. Deleting.`);
                  // Attempt to delete the stale connection record
                  try {
                      await ddb.send(new DeleteItemCommand({
                          TableName: WS_TABLE,
                          Key: marshall({ pk: conn.pk, sk: "META" }), // Use full key
                      }));
                  } catch (deleteError) {
                      console.error(`FanOut Error: Failed to delete stale connection ${connectionId}:`, deleteError);
                  }
              } else {
                  // Log other errors during broadcasting
                  console.error(`FanOut Error: Failed to post to connection ${connectionId}:`, error);
              }
          });
          broadcastPromises.push(postPromise);
      } // End broadcast loop

      // Wait for all broadcasts for this message to attempt completion
      await Promise.allSettled(broadcastPromises);

  } // End SNS record loop
};