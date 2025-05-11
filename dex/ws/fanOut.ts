// dex/ws/fanOut.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SNSHandler, SNSEvent } from "aws-lambda";
import {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
  ScanCommandInput
} from "@aws-sdk/client-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import type { TradingMode } from "@/lib/interfaces";

const ddb = new DynamoDBClient({});
const WS_TABLE = Resource.WSConnectionsTable.name;

const apigw = new ApiGatewayManagementApiClient({});

// Combined interface for expected SNS message payloads from various sources
interface GenericSnsPayload {
    type: string; // e.g., "orderUpdate", "trade", "fundingRateUpdate", "marketSummaryUpdate", "positionUpdate", "balanceUpdate"
    mode: TradingMode;
    market?: string;   // For market-specific channels
    traderId?: string; // For trader-specific channels
    [key: string]: any;
}


export const handler: SNSHandler = async (ev: SNSEvent) => {
  for (const record of ev.Records) {
      let payload: GenericSnsPayload;
      try {
          payload = JSON.parse(record.Sns.Message) as GenericSnsPayload;

          if (!payload.type || !payload.mode || (payload.mode !== "REAL" && payload.mode !== "PAPER")) {
              console.error("FanOut Error: SNS message missing 'type', 'mode', or invalid 'mode'. Skipping.", record.Sns.Message);
              continue;
          }
          // Market/TraderId check is more nuanced now:
          // - market channels need market
          // - trader channels need traderId
          // - Some messages might be global (less common for this DEX structure)
          const isMarketChannelMessage = payload.market && ["depth", "trade", "markPrice", "fundingRateUpdate", "marketSummaryUpdate", "marketStateUpdate"].includes(payload.type);
          const isTraderChannelMessage = payload.traderId && ["orderUpdate", "positionUpdate", "balanceUpdate", "liquidationAlert"].includes(payload.type);

          if (!isMarketChannelMessage && !isTraderChannelMessage) {
               console.warn(`FanOut: SNS message type '${payload.type}' doesn't clearly map to market or trader channel or missing identifier. Payload:`, payload);
               // Decide if to continue or skip. For now, let's allow it if it has at least one identifier.
               if (!payload.market && !payload.traderId) {
                    console.error("FanOut Error: Message has no market or traderId. Skipping.", payload);
                    continue;
               }
          }

      } catch (error) {
          console.error("FanOut Error: Failed to parse SNS message JSON.", error, record.Sns.Message);
          continue;
      }

      // Determine target channel(s) based on payload content
      const targetChannels: string[] = [];
      if (payload.market) { // Messages for market-specific channels
          targetChannels.push(`market.${payload.market}.${payload.mode}`);
      }
      if (payload.traderId) { // Messages for trader-specific channels
          targetChannels.push(`trader.${payload.traderId}.${payload.mode}`);
      }
      // Could also have global admin channels, e.g., admin.GLOBAL.REAL etc.

      if (targetChannels.length === 0) {
          console.warn("FanOut: No target channels determined for payload type:", payload.type, "Payload:", payload);
          continue;
      }

      const messageData = Buffer.from(JSON.stringify(payload)); // Send the parsed & validated payload

      for (const targetChannel of targetChannels) {
          let connections: { pk: string }[] = [];
          let lastEvaluatedKeyScan: Record<string, any> | undefined = undefined;

          try {
              // console.log(`FanOut: Searching connections for channel: ${targetChannel}`);
              // GSI on `channel` and `channelMode` could be `channelModeChannel` (PK=channelMode, SK=channel)
              // Or a single GSI on `channel` (PK=channel, SK=pk)
              // Current scan uses FilterExpression on `channel`
              do {
                  const scanParams: ScanCommandInput = {
                      TableName: WS_TABLE,
                      FilterExpression: "#chan = :channelVal", // Filter by exact channel string
                      ExpressionAttributeNames: { "#chan": "channel" },
                      ExpressionAttributeValues: marshall({ ":channelVal": targetChannel }),
                      ProjectionExpression: "pk", // Only need connection ID
                      ExclusiveStartKey: lastEvaluatedKeyScan,
                  };
                  const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(scanParams));

                  if (Items) {
                      connections = connections.concat(
                          Items.map(item => unmarshall(item) as { pk: string })
                      );
                  }
                  lastEvaluatedKeyScan = LastEvaluatedKey;
              } while (lastEvaluatedKeyScan);

              // if (connections.length > 0) {
              //    console.log(`FanOut: Found ${connections.length} connections for ${targetChannel}.`);
              // }
          } catch (error) {
              console.error(`FanOut Error: Failed to scan WSConnectionsTable for channel ${targetChannel}:`, error);
              continue; // Skip to next targetChannel or SNS record
          }

          const broadcastPromises: Promise<any>[] = [];
          for (const conn of connections) {
              const connectionId = conn.pk.slice(3); // Extract ID from "WS#<connectionId>"
              if (!connectionId) continue;

              const postPromise = apigw.send(
                  new PostToConnectionCommand({
                      ConnectionId: connectionId,
                      Data: messageData,
                  })
              ).catch(async (error: any) => {
                  if (error instanceof GoneException || error.statusCode === 410 || error.name === "GoneException") {
                      // console.log(`FanOut: Stale connection ${connectionId} for channel ${targetChannel}. Deleting.`);
                      try {
                          await ddb.send(new DeleteItemCommand({
                              TableName: WS_TABLE,
                              Key: marshall({ pk: conn.pk, sk: "META" }),
                          }));
                      } catch (deleteError) {
                          console.error(`FanOut Error: Failed to delete stale connection ${connectionId}:`, deleteError);
                      }
                  } else {
                      console.error(`FanOut Error: Failed to post to connection ${connectionId} for channel ${targetChannel}:`, error.name, error.message, error.stack);
                  }
              });
              broadcastPromises.push(postPromise);
          }
          await Promise.allSettled(broadcastPromises);
      } // End targetChannel loop
  } // End SNS record loop
};