import {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});

export const handler = async (
  ev: APIGatewayProxyWebsocketEventV2
): Promise<APIGatewayProxyResultV2> => {
  const { connectionId } = ev.requestContext;

  await ddb.send(
    new DeleteItemCommand({
      TableName: Resource.WSConnectionsTable.name,
      Key: marshall({ pk: `WS#${connectionId}`, sk: "META" }),
    })
  );

  return { statusCode: 200 };
};