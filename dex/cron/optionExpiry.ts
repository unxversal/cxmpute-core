import { DynamoDBClient, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { Resource } from "sst";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const ddb = new DynamoDBClient({});
const now = Date.now();

export const handler = async () => {
  /* sweep OPEN option orders whose expiryTs < now and settle */
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: Resource.OrdersTable.name,
      FilterExpression: "orderType = :opt AND expiryTs < :now AND #s = :open",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":opt": { S: "OPTION" },
        ":now": { N: String(now) },
        ":open": { S: "OPEN" },
      },
    }),
  );

  if (!Items) return;

  await Promise.all(
    Items.map(async (it) => {
      const order = unmarshall(it);
      /* mark as EXPIRED */
      await ddb.send(
        new UpdateItemCommand({
          TableName: Resource.OrdersTable.name,
          Key: marshall({ pk: order.pk, sk: order.sk }),
          UpdateExpression: "SET #s = :exp",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":exp": { S: "EXPIRED" } },
        }),
      );
      /* TODO: cash‑settlement logic */
    }),
  );
};