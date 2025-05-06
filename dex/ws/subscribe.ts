/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/ws/subscribe.ts
import {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import {
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import type { TradingMode } from "../../src/lib/interfaces"; // Import TradingMode

const ddb = new DynamoDBClient({});
const WS_TABLE = Resource.WSConnectionsTable.name;

// Interface for the expected message body from the client
interface ClientSubscribeMsg {
  action: "subscribe"; // Ensure action is subscribe
  /** Expected format: <type>.<identifier>.<mode>
   * e.g., "market.BTC-PERP.REAL"
   * e.g., "trader.uuid123abc.PAPER"
   */
  channel: string;
}

/**
 * Parses the channel string to extract type, identifier, and mode.
 * Returns null if the format is invalid.
 */
function parseChannelString(channel: string): { type: string; identifier: string; mode: TradingMode } | null {
    const parts = channel.split('.');
    if (parts.length !== 3) return null;

    const [type, identifier, modeStr] = parts;
    const mode = modeStr.toUpperCase();

    if ((type !== 'market' && type !== 'trader') || !identifier || (mode !== 'REAL' && mode !== 'PAPER')) {
        return null; // Invalid type, missing identifier, or invalid mode
    }

    return { type, identifier, mode: mode as TradingMode };
}


export const handler = async (
  ev: APIGatewayProxyWebsocketEventV2
): Promise<APIGatewayProxyResultV2> => {
  const { connectionId } = ev.requestContext;

  try {
    const body = JSON.parse(ev.body ?? "{}") as Partial<ClientSubscribeMsg>;

    // Validate input message
    if (!body || body.action !== "subscribe" || !body.channel) {
      console.warn(`Invalid subscribe message received from ${connectionId}:`, ev.body);
      // Optionally send error back to client via PostToConnectionCommand
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid message format. Expects {action: 'subscribe', channel: '<type>.<id>.<mode>'}" }) };
    }

    const { channel } = body;

    // --- Parse Channel and Mode ---
    const parsedChannel = parseChannelString(channel);

    if (!parsedChannel) {
         console.warn(`Invalid channel format from ${connectionId}: ${channel}`);
         return { statusCode: 400, body: JSON.stringify({ error: "Invalid channel format. Use <type>.<id>.<mode> (e.g., market.BTC-PERP.REAL)" }) };
    }
    const { mode } = parsedChannel;
    // --- End Parsing ---


    // Update the connection record in DynamoDB
    await ddb.send(
      new UpdateItemCommand({
        TableName: WS_TABLE,
        Key: marshall({
            pk: `WS#${connectionId}`,
            sk: "META" // Assuming SK is always 'META'
        }),
        // Set the full channel string and the extracted mode
        UpdateExpression: "SET #chan = :channel, #cMode = :mode, #updAt = :ts",
        ExpressionAttributeNames: {
            "#chan": "channel",     // Attribute name for the full channel string
            "#cMode": "channelMode", // Attribute name for the extracted mode
            "#updAt": "updatedAt",  // Track last update time
        },
        ExpressionAttributeValues: marshall({
            ":channel": channel, // Store the full string like "market.BTC-PERP.REAL"
            ":mode": mode,       // Store the extracted mode "REAL" or "PAPER"
            ":ts": Date.now()
        }),
        // ConditionExpression: "attribute_exists(pk)" // Ensure the connection record exists
      })
    );

    console.log(`Connection ${connectionId} subscribed to channel: ${channel} (Mode: ${mode})`);
    return { statusCode: 200, body: JSON.stringify({ success: true, subscribedTo: channel }) };

  } catch (error: any) {
      console.error(`Error processing subscribe request for ${connectionId}:`, error);
       // Check for specific DynamoDB errors if needed
       // if (error.name === 'ResourceNotFoundException') { ... }
       // if (error.name === 'ConditionalCheckFailedException') { ... } // If ConditionExpression is used
       return { statusCode: 500, body: JSON.stringify({ error: "Internal server error during subscription." }) };
  }
};