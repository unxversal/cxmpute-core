import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import fetch from "node-fetch";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});
const pk  = (asset: string) => `ASSET#${asset}`;

export const handler = async () => {
  /* example fetch – replace with real Pyth/Chainlink calls */
  // TODO: Full implementation
  const prices = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd").then(r => r.json());

  const nowIso = new Date().toISOString();

  const puts = Object.entries(prices).map(([asset, obj]) =>
    ddb.send(
      new PutItemCommand({
        TableName: Resource.PricesTable.name,
        Item: marshall({
          pk: pk(asset.toUpperCase()),          // ASSET#BTC
          sk: `TS#${nowIso}`,                   // TS#2025‑05‑04T23:01:00Z
          price: obj.usd,
          expireAt: Math.floor(Date.now() / 1_000) + 7 * 24 * 60 * 60,
        }),
      }),
    ),
  );

  await Promise.all(puts);
};