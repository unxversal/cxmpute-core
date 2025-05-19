// dex/ws/connect.ts
import {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});
const TABLE   = Resource.TradersTable.name;
const WS_TBL  = Resource.WSConnectionsTable.name;

export const handler = async (
  ev: APIGatewayProxyWebsocketEventV2
): Promise<APIGatewayProxyResultV2> => {
  /* ── 1️⃣  pull ?traderAk=xxxxx from query‑string */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traderAk = (ev as any).queryStringParameters?.traderAk;
  if (!traderAk) {
    return { statusCode: 401, body: "missing traderAk" };
  }

  /* ── 2️⃣ look up trader in GSI `ByAk` */
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: "ByAk",
      KeyConditionExpression: "traderAk = :ak",
      ExpressionAttributeValues: { ":ak": { S: traderAk } },
      ProjectionExpression: "traderId, #st",
      ExpressionAttributeNames: { "#st": "status" },
      Limit: 1,
      ConsistentRead: false,
    })
  );

  const item = res.Items?.[0];
  if (!item) {
    return { statusCode: 401, body: "invalid traderAk" };
  }

  const { traderId, status } = unmarshall(item) as {
    traderId: string;
    status?: "ACTIVE" | "SUSPENDED";
  };

  /* ── 3️⃣ optionally enforce status */
  if (status && status !== "ACTIVE") {
    return { statusCode: 403, body: "trader suspended" };
  }

  /* ── 4️⃣ record the connection (24 h TTL) */
  const ttl = Math.floor(Date.now() / 1_000) + 24 * 60 * 60;

  await ddb.send(
    new PutItemCommand({
      TableName: WS_TBL,
      Item: marshall({
        pk: `WS#${ev.requestContext.connectionId}`,
        sk: "META",
        traderId,
        traderAk,
        channel: null,
        expiresAt: ttl,
      }),
    })
  );

  return { statusCode: 200 };
};