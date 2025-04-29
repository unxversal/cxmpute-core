// dex/depthBroadcast.ts
import { DynamoDBStreamHandler } from "aws-lambda";
import {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { OrderRow } from "./types";

type DepthChange = { market: string; price: number; side: string; qty: number };

const ddb = new DynamoDBClient({});
const mgmt = new ApiGatewayManagementApiClient({
  // cast Resource to any to access dynamic properties
  endpoint: Resource.DexWS.managementEndpoint,
});

// Name of the Dynamo table that holds active WS connection IDs
const CONNECTIONS_TABLE = Resource.ConnectionsTable.name;

/**
 * Triggered by the OrdersTable DynamoDB stream whenever an order is NEW/PARTIAL/FILLED.
 * It unpacks the NewImage, groups by market, and pushes depth updates over WS.
 */
export const handler: DynamoDBStreamHandler = async (event) => {
  // 1. Collect all depth changes
  const changes: DepthChange[] = [];
  for (const record of event.Records) {
    const img = record.dynamodb?.NewImage;
    if (!img) continue;
    const row = unmarshall(img) as OrderRow;
    // include only NEW/PARTIAL/FILLED updates
    if (
      row.status === "NEW" ||
      row.status === "PARTIAL" ||
      row.status === "FILLED"
    ) {
      changes.push({
        market: row.market,
        price: row.price,
        side: row.side,
        qty: row.qty - (row.filled ?? 0),
      });
    }
  }
  if (changes.length === 0) return;

  // 2. Group by market
  const byMarket = changes.reduce<Record<string, DepthChange[]>>(
    (acc, c) => {
      (acc[c.market] ??= []).push(c);
      return acc;
    },
    {}
  );

  // 3. Broadcast each group
  await Promise.all(
    Object.entries(byMarket).map(([market, payload]) =>
      broadcastDepth(market, payload)
    )
  );
};

/** Broadcast a single market’s depth payload to all active connections */
async function broadcastDepth(
  market: string,
  payload: DepthChange[]
) {
  const topic = `depth:${market}`;
  const data = JSON.stringify({ topic, data: payload });

  // 3.a Scan ConnectionsTable for all active connectionIds
  const scanRes = await ddb.send(
    new ScanCommand({
      TableName: CONNECTIONS_TABLE,
      ProjectionExpression: "connectionId",
    })
  );
  const connectionIds =
    scanRes.Items?.map((i) => unmarshall(i).connectionId as string) ?? [];

  // 3.b Post to each connection; clean up stale ones
  await Promise.all(
    connectionIds.map(async (connId) => {
      try {
        await mgmt.send(
          new PostToConnectionCommand({
            ConnectionId: connId,
            Data: Buffer.from(data),
          })
        );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        // remove stale connections (410 Gone)
        if (e.statusCode === 410 || e.code === "GoneException") {
          await ddb.send(
            new DeleteItemCommand({
              TableName: CONNECTIONS_TABLE,
              Key: marshall({ connectionId: connId }),
            })
          );
        } else {
          console.error("Error posting to connection", connId, e);
        }
      }
    })
  );
}