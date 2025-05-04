import {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});

export const handler = async (
  ev: APIGatewayProxyWebsocketEventV2
): Promise<APIGatewayProxyResultV2> => {
  const { connectionId } = ev.requestContext;
  const ttl = Math.floor(Date.now() / 1_000) + 24 * 60 * 60; // 24 h

  await ddb.send(
    new PutItemCommand({
      TableName: Resource.WSConnectionsTable.name,
      Item: marshall({
        pk: `WS#${connectionId}`,
        sk: "META",
        /** optional initial filters parsed from query‑string */
        expiresAt: ttl,
      }),
    })
  );

  return { statusCode: 200 };
};