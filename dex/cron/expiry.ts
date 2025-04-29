/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/cron/expiry.ts
import { Handler } from "aws-lambda";
import {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import { Resource } from "sst";
import { Product, SettlementFill } from "../types";

const ddb = new DynamoDBClient({});
const sqs = new SQSClient({});

/** Table names */
const MARKETS    = (Resource as any).MarketsTable.name;
const POSITIONS  = (Resource as any).PositionsTable.name;
const SETTLE_Q   = (Resource as any).SettlementQueue.url;

/**
 * Daily expiry: for all markets whose expiryTs ≤ now,
 *  - settle open positions as final PnL
 *  - delete position records
 */
export const handler: Handler = async () => {
  const now = Date.now();

  // 1. find expired markets
  const mktRes = await ddb.send(
    new ScanCommand({
      TableName: MARKETS,
      ProjectionExpression: "pk, sk, indexPrice, expiryTs",
      FilterExpression: "expiryTs <= :now and sk = :info",
      ExpressionAttributeValues: {
        ":now":  { N: now.toString() },
        ":info": { S: "INFO" },
      },
    })
  );
  const expired = (mktRes.Items ?? []).map((i) =>
    unmarshall(i)
  ) as { pk: string; indexPrice: number; expiryTs: number }[];

  for (const { pk, indexPrice } of expired) {
    const marketCode = pk.split("#")[1];

    // 2. fetch positions
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

    // 3. build final PnL fills
    const fills: SettlementFill[] = users.map((u) => {
      const size = u.size as number;
      const entry = u.avgEntry as number;
      const pnl = (indexPrice - entry) * size;
      return {
        market: marketCode,
        price: indexPrice,
        qty: Math.abs(pnl),
        buyer: pnl >= 0 ? u.pk.split("#")[1] : "SYSTEM",
        seller: pnl >= 0 ? "SYSTEM" : u.pk.split("#")[1],
        product: Product.FUTURE,
        ts: now,
        tradeId: randomUUID(),
      };
    });

    // 4. enqueue fills
    if (fills.length) {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: SETTLE_Q,
          MessageBody: JSON.stringify(fills),
        })
      );
    }

    // 5. delete all expired positions
    await Promise.all(
      users.map((u) =>
        ddb.send(
          new DeleteItemCommand({
            TableName: POSITIONS,
            Key: marshall({ pk: u.pk, sk: u.sk }),
          })
        )
      )
    );
  }
};