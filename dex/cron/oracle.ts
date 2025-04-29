// dex/cron/oracle.ts
import { Handler } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import axios from "axios";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});
const MARKETS = Resource.MarketsTable.name;

/**
 * Fetch off-chain price feeds and update MarketsTable.INFO row.
 */
export const handler: Handler = async () => {
  // Example: fetch BTC/USD perp using some API
  const resp = await axios.get("https://api.example.com/perp-markets");
  for (const m of resp.data.markets) {
    const pk = `MARKET#${m.symbol}`;      // e.g. "MARKET#BTC-PERP"
    const now = Date.now();
    await ddb.send(
      new PutItemCommand({
        TableName: MARKETS,
        Item: marshall({
          pk,
          sk: "INFO",
          indexPrice: m.price,
          expiryTs: m.expiry,           // for futures
          lastUpdated: now,
        }),
      })
    );
  }
};