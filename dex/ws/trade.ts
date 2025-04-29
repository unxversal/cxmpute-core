// dex/ws/trade.ts
import {
  APIGatewayProxyWebsocketHandlerV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});
const mgmt = new ApiGatewayManagementApiClient({
  endpoint: Resource.DexWS.managementEndpoint,
});

const TRADES_TABLE = Resource.TradesTable.name;

/**
 * WebSocket handler for trade:<market> subscriptions.
 * Sends recent trade history for the requested market.
 */
export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connId = event.requestContext.connectionId;

  try {
    // Parse the market from the message
    const payload = JSON.parse(event.body || "{}");
    const market = payload.market;
    const limit = payload.limit || 50; // Default to last 50 trades

    if (!market) {
      await mgmt.send(
        new PostToConnectionCommand({
          ConnectionId: connId,
          Data: Buffer.from(
            JSON.stringify({ error: "Missing market parameter" })
          ),
        })
      );
      return { statusCode: 400, body: "Bad Request" } as APIGatewayProxyResultV2;
    }

    // Query recent trades
    const tradeHistory = await getRecentTrades(market, limit);

    // Send the trade history
    await mgmt.send(
      new PostToConnectionCommand({
        ConnectionId: connId,
        Data: Buffer.from(
          JSON.stringify({
            topic: `trade:${market}`,
            data: tradeHistory,
            type: "history",
          })
        ),
      })
    );

    return { statusCode: 200, body: "Success" } as APIGatewayProxyResultV2;
  } catch (error) {
    console.error("Error in trade handler:", error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    } as APIGatewayProxyResultV2;
  }
};

interface Trade {
  price: number;
  qty: number;
  timestamp: number;
  id: string;
  side: "buy" | "sell"; // Trade direction from taker's perspective
}

/**
 * Retrieves recent trades for a given market
 */
async function getRecentTrades(market: string, limit: number): Promise<Trade[]> {
  const pk = `MARKET#${market}`;
  const result = await ddb.send(
    new QueryCommand({
      TableName: TRADES_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": { S: pk },
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    })
  );

  return (result.Items || []).map((item) => {
    const trade = unmarshall(item);
    const tsParts = trade.sk.split("#");
    const timestamp = parseInt(tsParts[1], 10);
    const id = tsParts[2];

    return {
      price: trade.price,
      qty: trade.qty,
      timestamp,
      id,
      // You may need to determine the taker side from additional data
      side: "buy", // Default, enhance with actual determination logic if available
    };
  });
}