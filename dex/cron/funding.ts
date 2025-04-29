/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/cron/funding.ts
import { Handler } from "aws-lambda";
import {
  DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import { Resource } from "sst";
import { Product, SettlementFill } from "../types";

const ddb = new DynamoDBClient({});
const sqs = new SQSClient({});

/** Table names */
const MARKETS    = Resource.MarketsTable.name;
const POSITIONS  = Resource.PositionsTable.name;
const SETTLE_Q   = Resource.SettlementQueue.url;

/**
 * Hourly funding: for each perpetual market,
 *  - read indexPrice
 *  - for each open position, compute fundingPnl = (indexPrice - avgEntry) * size
 *  - enqueue a synthetic fill for that PnL
 */
export const handler: Handler = async () => {
  // 1. load all perpetual markets
  const mktRes = await ddb.send(
    new ScanCommand({
      TableName: MARKETS,
      // INFO rows hold current indexPrice and expiryTs
      ProjectionExpression: "pk, indexPrice",
      FilterExpression: "begins_with(sk, :info)",
      ExpressionAttributeValues: { ":info": { S: "INFO" } },
    })
  );
  const perps = (mktRes.Items ?? [])
    .map((i) => unmarshall(i))
    .filter((m: any) => m.pk.endsWith("-PERP")) as { pk: string; indexPrice: number }[];

  for (const { pk, indexPrice } of perps) {
    // derive market code e.g. "BTC-PERP"
    const marketCode = pk.split("#")[1];

    // 2. fetch all positions in this market
    const posRes = await ddb.send(
      new ScanCommand({
        TableName: POSITIONS,
        ProjectionExpression: "pk, sk, size, avgEntry",
        FilterExpression: "sk = :msk",
        ExpressionAttributeValues: {
          ":msk": { S: pk },
        },
      })
    );
    const users = (posRes.Items ?? []).map((i) => unmarshall(i)) as any[];

    // 3. build fills
    const fills: SettlementFill[] = users.map((u) => {
      const size = u.size as number;
      const entry = u.avgEntry as number;
      const pnl = (indexPrice - entry) * size;
      // positive pnl -> user as buyer, negative -> user as seller
      return {
        market: marketCode,
        price: indexPrice,
        qty: Math.abs(pnl),
        buyer: pnl >= 0 ? u.pk.split("#")[1] : "SYSTEM",
        seller: pnl >= 0 ? "SYSTEM" : u.pk.split("#")[1],
        product: Product.PERP,
        ts: Date.now(),
        tradeId: randomUUID(),
      };
    });

    // 4. enqueue
    if (fills.length) {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: SETTLE_Q,
          MessageBody: JSON.stringify(fills),
        })
      );
    }
  }
};