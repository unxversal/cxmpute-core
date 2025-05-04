import { SNSHandler, SNSEvent } from "aws-lambda";
import {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand
} from "@aws-sdk/client-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});
const apigw = new ApiGatewayManagementApiClient({
  endpoint: process.env.WS_API_URL, //  injected by `wsApi.link()`
});

export const handler: SNSHandler = async (ev: SNSEvent) => {
  const payload = JSON.parse(ev.Records[0].Sns.Message);

  /** example payload:
   *  {
   *    type: "orderUpdate",
   *    market: "BTC-PERP",
   *    orderId: "..."
   *  }
   *  Build channel key identical to “subscribe.channel”.
   */
  const channel =
    payload.market ? `market.${payload.market}` : `trader.${payload.trader}`;

  /* naive scan ( < few‑thousand conns); switch to GSI for prod */
  const res = await ddb.send(
    new ScanCommand({
      TableName: Resource.WSConnectionsTable.name,
      FilterExpression: "#c = :channel",
      ExpressionAttributeNames: { "#c": "channel" },
      ExpressionAttributeValues: { ":channel": { S: channel } },
      ProjectionExpression: "pk",
    })
  );

  await Promise.all(
    (res.Items ?? []).map(async (it) => {
      const { pk } = unmarshall(it); // "WS#<id>"
      const connectionId = pk.slice(3);

      try {
        await apigw.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: Buffer.from(JSON.stringify(payload)),
          })
        );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (err.statusCode === 410) {
          /* stale → purge */
          await ddb.send(
            new DeleteItemCommand({
              TableName: Resource.WSConnectionsTable.name,
              Key: {
                pk: { S: `WS#${connectionId}` },
                sk: { S: "META" },
              },
            })
          );
        }
      }
    })
  );
};