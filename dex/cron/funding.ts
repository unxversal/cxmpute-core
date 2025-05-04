import {
  DynamoDBClient,
  UpdateItemCommand,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});
const now = Date.now();

/* helper builders */
const pkMarket = (m: string) => `MARKET#${m}`;
const minuteBucket = Math.floor(now / 60_000) * 60_000;

export const handler = async () => {
  /* 1️⃣ load all ACTIVE perp markets */
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: Resource.MarketsTable.name,
      IndexName: "ByStatus",
      KeyConditionExpression: "status = :active",
      ExpressionAttributeValues: { ":active": { S: "ACTIVE" } },
    }),
  );

  if (!Items) return;

  /* 2️⃣ for each market compute mark‑index diff & write synthetic Trade */
  await Promise.all(
    Items.filter((it) => unmarshall(it).type === "PERP").map(async (it) => {
      const mkt = unmarshall(it) as { symbol: string };

      const fundingRate = 0.0001; /* TODO: replace with calc */

      /* write synthetic Trade row */
      const tradeId = crypto.randomUUID().replace(/-/g, "");
      await ddb.send(
        new PutItemCommand({
          TableName: Resource.TradesTable.name,
          Item: marshall({
            pk: pkMarket(mkt.symbol),
            sk: `TS#${tradeId}`,
            tradeId,
            market: mkt.symbol,
            qty: 0,
            price: 0,
            side: "BUY",
            timestamp: now,
            makerFee: 0,
            takerFee: 0,
            meta: { fundingRate },
          }),
        }),
      );

      /* update intraday stats */
      await ddb.send(
        new UpdateItemCommand({
          TableName: Resource.StatsIntradayTable.name,
          Key: marshall({ pk: pkMarket(mkt.symbol), sk: `TS#${minuteBucket}` }),
          UpdateExpression: "SET fundingRate = :f",
          ExpressionAttributeValues: { ":f": { N: String(fundingRate) } },
        }),
      );
    }),
  );
};