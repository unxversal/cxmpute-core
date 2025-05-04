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

const ddb = new DynamoDBClient({});

interface ClientMsg {
  /**  "market.BTC-PERP" | "trader.<uuid>"  */
  channel: string;
}

export const handler = async (
  ev: APIGatewayProxyWebsocketEventV2
): Promise<APIGatewayProxyResultV2> => {
  const { connectionId } = ev.requestContext;
  const msg = JSON.parse(ev.body ?? "{}") as ClientMsg;

  await ddb.send(
    new UpdateItemCommand({
      TableName: Resource.WSConnectionsTable.name,
      Key: marshall({ pk: `WS#${connectionId}`, sk: "META" }),
      UpdateExpression: "SET #c = :channel",
      ExpressionAttributeNames: { "#c": "channel" }, // eg. "market.BTC-PERP"
      ExpressionAttributeValues: { ":channel": { S: msg.channel } },
    })
  );

  return { statusCode: 200 };
};