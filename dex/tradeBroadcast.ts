// dex/tradeBroadcast.ts
import { DynamoDBStreamHandler } from "aws-lambda";
import {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
  AttributeValue,
} from "@aws-sdk/client-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { TradeRow } from "./types";

type TradeChange = {
  market: string;
  price: number;
  qty: number;
  buyOid: string;
  sellOid: string;
  ts: number;
};

const ddb = new DynamoDBClient({});
const mgmt = new ApiGatewayManagementApiClient({
  endpoint: Resource.DexWS.managementEndpoint,
});
const CONNECTIONS_TABLE = Resource.ConnectionsTable.name;

/**
 * Triggered by TradesTable DynamoDB Stream on every new trade.
 */
export const handler: DynamoDBStreamHandler = async (event) => {
  const changes: TradeChange[] = [];

  for (const record of event.Records) {
    const img = record.dynamodb?.NewImage;
    if (!img) continue;
    const row = unmarshall(img as Record<string, AttributeValue>) as TradeRow;
    // extract market from PK: "MARKET#BTC-USDC"
    const market = row.pk.split("#")[1];
    const tsPart = row.sk.split("#")[1];
    changes.push({
      market,
      price: row.price,
      qty: row.qty,
      buyOid: row.buyOid,
      sellOid: row.sellOid,
      ts: parseInt(tsPart, 10),
    });
  }
  if (changes.length === 0) return;

  // broadcast each trade
  await Promise.all(
    changes.map((c) => broadcastTrade(c.market, c))
  );
};

async function broadcastTrade(market: string, data: TradeChange) {
  const topic = `trade:${market}`;
  const payload = JSON.stringify({ topic, data });

  // 1) scan all connections
  const scanRes = await ddb.send(
    new ScanCommand({
      TableName: CONNECTIONS_TABLE,
      ProjectionExpression: "connectionId",
    })
  );
  const connectionIds =
    scanRes.Items?.map((i) => unmarshall(i as Record<string, AttributeValue>).connectionId as string) ??
    [];

  // 2) post to each, cleaning up stale
  await Promise.all(
    connectionIds.map(async (connId) => {
      try {
        await mgmt.send(
          new PostToConnectionCommand({
            ConnectionId: connId,
            Data: Buffer.from(payload),
          })
        );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (e.statusCode === 410 || e.code === "GoneException") {
          await ddb.send(
            new DeleteItemCommand({
              TableName: CONNECTIONS_TABLE,
              Key: { connectionId: { S: connId } },
            })
          );
        } else {
          console.error("Error broadcasting trade", connId, e);
        }
      }
    })
  );
}