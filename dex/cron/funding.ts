import {
  DynamoDBClient,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { vault } from "../chain/vaultHelper";

const ddb = new DynamoDBClient({});
const now = Date.now();
const minuteBucket = Math.floor(now / 60_000) * 60_000;

/* helpers */
const pkMarket = (m: string) => `MARKET#${m}`;

/** clamp helper */
const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max);

/** fetch most‑recent oracle price */
async function getIndexPx(asset: string) {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: Resource.PricesTable.name,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": { S: `ASSET#${asset}` } },
      ScanIndexForward: false,      // newest first
      Limit: 1,
    })
  );
  if (!Items?.[0]) throw new Error("no oracle price");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (unmarshall(Items[0]) as any).price as number;
}

/** fetch most‑recent traded price for the perp */
async function getMarkPx(symbol: string) {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: Resource.TradesTable.name,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": { S: pkMarket(symbol) } },
      ScanIndexForward: false,
      Limit: 1,
    })
  );
  if (!Items?.[0]) throw new Error("no trades yet");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (unmarshall(Items[0]) as any).price as number;
}

export const handler = async () => {
  /* 1️⃣  load ACTIVE perp markets */
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: Resource.MarketsTable.name,
      IndexName: "ByStatus",
      KeyConditionExpression: "status = :a",
      ExpressionAttributeValues: { ":a": { S: "ACTIVE" } },
    })
  );
  if (!Items) return;

  for (const raw of Items) {
    const mkt = unmarshall(raw) as {
      symbol: string;
      type: string;
      synth: string;
      fundingIntervalSec?: number;
    };
    if (mkt.type !== "PERP") continue;

    const [asset] = mkt.symbol.split("-");
    let markPx: number, indexPx: number;
    try {
      [markPx, indexPx] = await Promise.all([
        getMarkPx(mkt.symbol),
        getIndexPx(asset),
      ]);
    } catch {
      continue;                          // skip market if we can't price it
    }

    /* 2️⃣  funding rate formula
       FR_hour = clamp( (mark-index)/index , -0.30% , +0.30% )
       Scaled for arbitrary interval = FR_hour * (intervalSec / 3600)
    */
    const premium = (markPx - indexPx) / indexPx;
    const hourlyRate = clamp(premium, -0.003, 0.003);
    const intervalSec = mkt.fundingIntervalSec ?? 3600;
    const fundingRate = +(hourlyRate * intervalSec / 3600).toFixed(6); // 6‑dp

    /* 3️⃣  iterate every open position in the market */
    const { Items: positions } = await ddb.send(
      new ScanCommand({
        TableName: Resource.PositionsTable.name,
        FilterExpression: "market = :m AND size <> :z",
        ExpressionAttributeValues: {
          ":m": { S: mkt.symbol },
          ":z": { N: "0" },
        },
      })
    );

    for (const pos of positions ?? []) {
      const p = unmarshall(pos) as {
        traderId: string;
        size: number;               // signed contracts
      };
      if (p.size === 0) continue;

      const payment = BigInt(
        Math.floor(p.size * markPx * fundingRate)         // USDC  (6‑dec assumed)
      );

      const zero   = BigInt(0);

      if (payment === zero) continue;

      /* 3a) balance table update (+/-) */
      await ddb.send(
        new UpdateItemCommand({
          TableName: Resource.BalancesTable.name,
          Key: marshall({ traderId: p.traderId, asset: "USDC" }),
          UpdateExpression: "ADD balance :d",
          ExpressionAttributeValues: { ":d": { N: payment.toString() } },
        })
      );

      /* 3b) on‑chain mint/burn to keep Vault shares balanced */
      if (payment > zero) {
        await vault.mintSynth(mkt.synth, p.traderId, payment);
      } else {
        await vault.burnSynth(mkt.synth, p.traderId, -payment);
      }
    }

    /* 4️⃣  book‑keeping: synthetic zero‑qty trade row (for candles) */
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
          price: markPx,
          side: "BUY",
          timestamp: now,
          makerFee: 0,
          takerFee: 0,
          meta: { fundingRate },
        }),
      })
    );

    /* 5️⃣  StatsIntraday bucket */
    await ddb.send(
      new UpdateItemCommand({
        TableName: Resource.StatsIntradayTable.name,
        Key: marshall({
          pk: pkMarket(mkt.symbol),
          sk: `TS#${minuteBucket}`,
        }),
        UpdateExpression: "SET fundingRate = :f",
        ExpressionAttributeValues: { ":f": { N: fundingRate.toString() } },
      })
    );
  }
};