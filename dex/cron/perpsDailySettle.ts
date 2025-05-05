import {
  DynamoDBClient,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});

export const handler = async () => {
  /* iterate all open perp positions, realise unrealised PnL daily */
  const { Items } = await ddb.send(
    new ScanCommand({
      TableName: Resource.PositionsTable.name,
      FilterExpression: "size <> :z",
      ExpressionAttributeValues: { ":z": { N: "0" } },
    })
  );
  if (!Items?.length) return;

  for (const it of Items) {
    const p = unmarshall(it) as {
      traderId: string;
      market: string;
      size: number;
      avgEntryPrice: number;
      unrealizedPnl: number;
    };
    if (p.unrealizedPnl === 0) continue;

    await ddb.send(
      new UpdateItemCommand({
        TableName: Resource.BalancesTable.name,
        Key: marshall({ traderId: p.traderId, asset: "USDC" }),
        UpdateExpression: "ADD balance :p",
        ExpressionAttributeValues: { ":p": { N: String(p.unrealizedPnl) } },
      })
    );
    /* reset unrealized → realised */
    await ddb.send(
      new UpdateItemCommand({
        TableName: Resource.PositionsTable.name,
        Key: marshall({
          pk: `TRADER#${p.traderId}`,
          sk: p.market,
        }),
        UpdateExpression:
          "SET unrealizedPnl = :z, realizedPnl = realizedPnl + :p",
        ExpressionAttributeValues: {
          ":z": { N: "0" },
          ":p": { N: String(p.unrealizedPnl) },
        },
      })
    );
  }
};