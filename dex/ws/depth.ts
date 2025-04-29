// dex/ws/depth.ts
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
import { OrderSide } from "../types";

const ddb = new DynamoDBClient({});
const mgmt = new ApiGatewayManagementApiClient({
  endpoint: Resource.DexWS.managementEndpoint,
});

const ORDERS_TABLE = Resource.OrdersTable.name;

/**
 * WebSocket handler for depth:<market> subscriptions.
 * Sends the full L2 order book for the requested market.
 */
export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connId = event.requestContext.connectionId;

  try {
    // Parse the market from the message
    const payload = JSON.parse(event.body || "{}");
    const market = payload.market;

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

    // Build the order book
    const orderBook = await buildOrderBook(market);

    // Send the full orderbook snapshot
    await mgmt.send(
      new PostToConnectionCommand({
        ConnectionId: connId,
        Data: Buffer.from(
          JSON.stringify({
            topic: `depth:${market}`,
            data: orderBook,
            type: "snapshot", // indicate this is a full snapshot, not an update
          })
        ),
      })
    );

    return { statusCode: 200, body: "Success" } as APIGatewayProxyResultV2;
  } catch (error) {
    console.error("Error in depth handler:", error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    } as APIGatewayProxyResultV2;
  }
};

interface PriceLevel {
  price: number;
  qty: number;
}

interface OrderBook {
  bids: PriceLevel[];
  asks: PriceLevel[];
  timestamp: number;
}

/**
 * Builds an L2 order book for a given market
 */
async function buildOrderBook(market: string): Promise<OrderBook> {
  const pk = `MARKET#${market}`;
  const bids: Record<number, number> = {}; // price -> qty
  const asks: Record<number, number> = {};

  // Query all buy orders
  const buyOrders = await ddb.send(
    new QueryCommand({
      TableName: ORDERS_TABLE,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": { S: pk },
        ":prefix": { S: `SIDE#${OrderSide.BUY}` },
      },
      FilterExpression: "status = :new OR status = :partial",
      ExpressionAttributeValues: {
        ":pk": { S: pk },
        ":prefix": { S: `SIDE#${OrderSide.BUY}` },
        ":new": { S: "NEW" },
        ":partial": { S: "PARTIAL" },
      },
    })
  );

  // Query all sell orders
  const sellOrders = await ddb.send(
    new QueryCommand({
      TableName: ORDERS_TABLE,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": { S: pk },
        ":prefix": { S: `SIDE#${OrderSide.SELL}` },
      },
      FilterExpression: "status = :new OR status = :partial",
      ExpressionAttributeValues: {
        ":pk": { S: pk },
        ":prefix": { S: `SIDE#${OrderSide.SELL}` },
        ":new": { S: "NEW" },
        ":partial": { S: "PARTIAL" },
      },
    })
  );

  // Aggregate orders into price levels
  (buyOrders.Items || []).forEach((item) => {
    const order = unmarshall(item);
    const price = order.price;
    const remainingQty = order.qty - (order.filled || 0);
    bids[price] = (bids[price] || 0) + remainingQty;
  });

  (sellOrders.Items || []).forEach((item) => {
    const order = unmarshall(item);
    const price = order.price;
    const remainingQty = order.qty - (order.filled || 0);
    asks[price] = (asks[price] || 0) + remainingQty;
  });

  // Convert to arrays and sort
  const bidLevels = Object.entries(bids)
    .map(([price, qty]) => ({ price: parseFloat(price), qty }))
    .sort((a, b) => b.price - a.price); // Descending for bids

  const askLevels = Object.entries(asks)
    .map(([price, qty]) => ({ price: parseFloat(price), qty }))
    .sort((a, b) => a.price - b.price); // Ascending for asks

  return {
    bids: bidLevels,
    asks: askLevels,
    timestamp: Date.now(),
  };
}
