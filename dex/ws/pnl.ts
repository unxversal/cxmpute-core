// dex/ws/pnl.ts
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

const POSITIONS_TABLE = Resource.PositionsTable.name;

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connId = event.requestContext.connectionId;
  
  // Parse user ID from query params or message body
  const userId = JSON.parse(event.body!)?.userId;
  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing userId" }),
    } as APIGatewayProxyResultV2;
  }
  
  try {
    // Query all positions for this user
    const positions = await ddb.send(
      new QueryCommand({
        TableName: POSITIONS_TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": { S: `USER#${userId}` },
        },
      })
    );
    
    const positionsList = (positions.Items || []).map(item => unmarshall(item));
    
    // Send positions data over WebSocket
    await mgmt.send(
      new PostToConnectionCommand({
        ConnectionId: connId,
        Data: Buffer.from(JSON.stringify({
          topic: `pnl:${userId}`,
          data: positionsList,
        })),
      })
    );
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    } as APIGatewayProxyResultV2;
  } catch (error) {
    console.error("Error fetching PnL data:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    } as APIGatewayProxyResultV2;
  }
};
