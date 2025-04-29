import {
  APIGatewayProxyWebsocketHandlerV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});
const CONNECTIONS_TABLE = Resource.ConnectionsTable.name;

/**
 * $disconnect handler for WebSocket API
 */
export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connId = event.requestContext.connectionId;

  await ddb.send(
    new DeleteItemCommand({
      TableName: CONNECTIONS_TABLE,
      Key: marshall({ connectionId: connId }),
    })
  );

  return {
    statusCode: 200,
    body: "disconnected",
  } as APIGatewayProxyResultV2;
};
