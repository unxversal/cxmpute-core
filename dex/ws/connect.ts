import {
  APIGatewayProxyWebsocketHandlerV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});
const CONNECTIONS_TABLE = Resource.ConnectionsTable.name;

/**
 * $connect handler for WebSocket API
 */
export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  // Now TS knows `connectionId` exists here
  const connId = event.requestContext.connectionId;

  await ddb.send(
    new PutItemCommand({
      TableName: CONNECTIONS_TABLE,
      Item: marshall({ connectionId: connId }),
    })
  );

  return {
    statusCode: 200,
    body: "connected",
  } as APIGatewayProxyResultV2;
};
