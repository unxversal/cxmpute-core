// dex/lib/marketRegistry.ts
import {
  DynamoDBClient,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});
const cache = new Map<string, string>();

export async function getSynthAddr(market: string): Promise<string> {
  if (cache.has(market)) return cache.get(market)!;

  const { Item } = await ddb.send(
    new GetItemCommand({
      TableName: Resource.MarketsTable.name,
      Key: { pk: { S: `MARKET#${market}` }, sk: { S: "META" } },
      ProjectionExpression: "synth",
    })
  );

  if (!Item) throw new Error(`unknown market ${market}`);

  const { synth } = unmarshall(Item) as { synth: string };
  cache.set(market, synth);
  return synth;
}