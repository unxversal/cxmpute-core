// dex/ws/fanOut.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SNSHandler, SNSEvent } from "aws-lambda";
import {
  DynamoDBClient,
  // ScanCommand, ScanCommandInput, // No longer needed for main query
  QueryCommand, QueryCommandInput,   // <<<< ADD QueryCommand
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb"; // Assuming raw client for marshall/unmarshall consistency with subscribe.ts
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import type { TradingMode } from "@/lib/interfaces";

const ddb = new DynamoDBClient({}); // Or DynamoDBDocumentClient if you change marshalling
const WS_TABLE = Resource.WSConnectionsTable.name; // Use type assertion

// If using DocumentClient, initialize it:
// import { DynamoDBDocumentClient, QueryCommand as DocQueryCommand, DeleteItemCommand as DocDeleteCommand } from "@aws-sdk/lib-dynamodb";
// const docClient = DynamoDBDocumentClient.from(ddb);


const apigwManagementApi = new ApiGatewayManagementApiClient({
    endpoint: Resource.DexWsApi.url.replace('wss://', 'https://').replace('ws://', 'http://'), // Construct Management API endpoint
});


interface GenericSnsPayload {
    type: string;
    mode: TradingMode;
    market?: string;
    traderId?: string;
    [key: string]: any;
}

export const handler: SNSHandler = async (ev: SNSEvent) => {
  for (const record of ev.Records) {
      let payload: GenericSnsPayload;
      try {
          payload = JSON.parse(record.Sns.Message) as GenericSnsPayload;
          // ... (your existing payload validation logic) ...
          if (!payload.type || !payload.mode || (payload.mode !== "REAL" && payload.mode !== "PAPER")) {
              console.error("FanOut Error: SNS message missing 'type', 'mode', or invalid 'mode'. Skipping.", record.Sns.Message);
              continue;
          }
          const isMarketChannelMessage = payload.market && ["depth", "trade", "markPrice", "fundingRateUpdate", "marketSummaryUpdate", "marketStateUpdate"].includes(payload.type);
          const isTraderChannelMessage = payload.traderId && ["orderUpdate", "positionUpdate", "balanceUpdate", "liquidationAlert"].includes(payload.type);
          if (!isMarketChannelMessage && !isTraderChannelMessage && !payload.market && !payload.traderId) { // Adjusted for cases where one might be present
                console.error("FanOut Error: Message has no market or traderId for relevant types. Skipping.", payload);
                continue;
          }

      } catch (error) {
          console.error("FanOut Error: Failed to parse SNS message JSON.", error, record.Sns.Message);
          continue;
      }

      const targetChannels: string[] = [];
      if (payload.market) targetChannels.push(`market.${payload.market}.${payload.mode}`);
      if (payload.traderId) targetChannels.push(`trader.${payload.traderId}.${payload.mode}`);
      // Add other global/admin channels if any

      if (targetChannels.length === 0) {
          console.warn("FanOut: No target channels determined for payload:", payload);
          continue;
      }

      const messageData = Buffer.from(JSON.stringify(payload));

      for (const targetChannel of targetChannels) {
          let connections: { pk: string }[] = []; // Stores items like { pk: "WS#connectionId" }
          let lastEvaluatedKeyQuery: Record<string, any> | undefined = undefined;

          console.log(`FanOut: Querying connections for channel: ${targetChannel} using GSI 'ByChannel'`);
          try {
              do {
                  const queryParams: QueryCommandInput = {
                      TableName: WS_TABLE,
                      IndexName: "ByChannel", // Name of your GSI
                      KeyConditionExpression: "#chan = :channelVal", // Query by GSI PK
                      ExpressionAttributeNames: { "#chan": "channel" },
                      ExpressionAttributeValues: marshall({ ":channelVal": targetChannel }),
                      // ProjectionExpression: "pk", // Only need connection ID (pk of WSConnectionsTable)
                                                  // If GSI projects only 'pk', otherwise it gets all attributes by default.
                      ExclusiveStartKey: lastEvaluatedKeyQuery,
                      // Limit: 100, // Optional: process in batches if a channel has massive connections
                  };
                  // If using DocumentClient:
                  // const { Items, LastEvaluatedKey } = await docClient.send(new DocQueryCommand(queryParamsWithoutMarshall));
                  const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand(queryParams));

                  if (Items) {
                      connections = connections.concat(
                          Items.map(item => unmarshall(item) as { pk: string })
                      );
                  }
                  lastEvaluatedKeyQuery = LastEvaluatedKey;
              } while (lastEvaluatedKeyQuery);

              if (connections.length > 0) {
                 console.log(`FanOut: Found ${connections.length} connections for ${targetChannel}.`);
              }
          } catch (error) {
              console.error(`FanOut Error: Failed to query WSConnectionsTable for channel ${targetChannel} using GSI:`, error);
              continue;
          }

          const broadcastPromises: Promise<any>[] = [];
          for (const conn of connections) {
              const connectionIdWithPrefix = conn.pk; // This is "WS#<connectionId>"
              if (!connectionIdWithPrefix || !connectionIdWithPrefix.startsWith("WS#")) {
                  console.warn("FanOut: Invalid connection pk format found:", connectionIdWithPrefix);
                  continue;
              }
              const connectionId = connectionIdWithPrefix.substring(3); // Extract ID

              const postPromise = apigwManagementApi.send( // Use apigwManagementApi
                  new PostToConnectionCommand({ ConnectionId: connectionId, Data: messageData })
              ).catch(async (error: any) => {
                  if (error instanceof GoneException || error.statusCode === 410 || error.name === "GoneException") {
                      console.log(`FanOut: Stale connection ${connectionId} for channel ${targetChannel}. Deleting.`);
                      try {
                          // If using DocumentClient:
                          // await docClient.send(new DocDeleteCommand({ TableName: WS_TABLE, Key: { pk: conn.pk, sk: "META" }}));
                          await ddb.send(new DeleteItemCommand({
                              TableName: WS_TABLE, Key: marshall({ pk: conn.pk, sk: "META" }), // Assuming SK is "META"
                          }));
                      } catch (deleteError) {
                          console.error(`FanOut Error: Failed to delete stale connection ${connectionId}:`, deleteError);
                      }
                  } else {
                      console.error(`FanOut Error: Failed to post to connection ${connectionId} (channel ${targetChannel}): ${error.name} - ${error.message}`);
                  }
              });
              broadcastPromises.push(postPromise);
          }
          await Promise.allSettled(broadcastPromises); // Wait for all posts for this channel
      }
  }
};