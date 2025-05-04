import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  Order,
  OrderSide,
  Trade,
  UUID,
} from "../../src/lib/interfaces";
import { Resource } from "sst";

const ddb = new DynamoDBClient({});

const now = Date.now();

/** epoch‑ms rounded down to the start of this minute */
const minuteBucketMs = Math.floor(now / 60_000) * 60_000;

/** 48 h TTL in **epoch‑seconds** (Dynamo expects seconds) */
const ttl = Math.floor((now + 48 * 3_600_000) / 1_000);

/** Helper to build PK / SK for tables */
export const pk = {
  market: (m: string) => `MARKET#${m}`,
  trader: (id: UUID) => `TRADER#${id}`,
  asset:  (a: string) => `ASSET#${a}`,
};

/** Fee = 0.5 % maker + taker, split equally here (adjust if needed) */
const FEE_BPS = 50;

/** Query opposite‑side OPEN orders, ordered price‑/time‑priority */
export async function loadOpenOrders(
  market: string,
  side: OrderSide
): Promise<Order[]> {
  const resp = await ddb.send(
    new QueryCommand({
      TableName: Resource.OrdersTable.name,
      KeyConditionExpression: "pk = :pk",
      FilterExpression: "#s = :open AND #side = :side",
      ExpressionAttributeNames: {
        "#s": "status",
        "#side": "side",
      },
      ExpressionAttributeValues: {
        ":pk": { S: pk.market(market) },
        ":open": { S: "OPEN" },
        ":side": { S: side },
      },
      // Sort ascending by SK (timestamp) -> FIFO inside same price
      ScanIndexForward: side === "BUY", // BUY takes best (highest) ask first
      IndexName: undefined,
    })
  );
  return (resp.Items ?? []).map((it) => unmarshall(it) as Order);
}

/** Match loop – generic across order types */
export async function matchOrder(taker: Order) {
  const opposite: OrderSide = taker.side === "BUY" ? "SELL" : "BUY";
  const book = await loadOpenOrders(taker.market, opposite);

  let remaining = taker.qty - taker.filledQty;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writes: any[] = [];
  const now = Date.now();

  for (const maker of book) {
    if (remaining <= 0) break;

    if (maker.price === undefined) continue;

    // Price check (market order passes through)
    const priceOK =
      taker.orderType === "MARKET"
        ? true
        : taker.side === "BUY"
          ? taker.price >= maker.price
          : taker.price <= maker.price;
    if (!priceOK) break;

    const fillQty = Math.min(remaining, maker.qty - maker.filledQty);
    const fillPx = maker.price; // price‑time priority → maker’s limit

    // Fees
    const takerFee = (fillQty * fillPx * FEE_BPS) / 10_000;
    const makerFee = (fillQty * fillPx * FEE_BPS) / 10_000;

    const trade: Trade = {
      tradeId: crypto.randomUUID().replace(/-/g, ""),
      takerOrderId: taker.orderId,
      makerOrderId: maker.orderId,
      market: taker.market,
      price: fillPx,
      qty: fillQty,
      timestamp: now,
      side: taker.side,
      takerFee,
      makerFee,
    };

    // ===== TransactWrite preparation ===================================
    writes.push(
      // 1️⃣  update maker order
      {
        Update: {
          TableName: Resource.OrdersTable.name,
          Key: marshall({ pk: pk.market(maker.market), sk: maker.sk }),
          UpdateExpression:
            "SET filledQty = filledQty + :f, #s = if_not_exists(#s,:open)",
          ConditionExpression: "attribute_exists(pk)",
          ExpressionAttributeValues: {
            ":f": { N: String(fillQty) },
            ":open": { S: "OPEN" },
          },
          ExpressionAttributeNames: { "#s": "status" },
        },
      },
      // 2️⃣  update taker order
      {
        Update: {
          TableName: Resource.OrdersTable.name,
          Key: marshall({ pk: pk.market(taker.market), sk: taker.sk }),
          UpdateExpression:
            "SET filledQty = filledQty + :f, #s = :status, updatedAt = :now",
          ExpressionAttributeValues: {
            ":f": { N: String(fillQty) },
            ":status": {
              S:
                remaining - fillQty === 0
                  ? "FILLED"
                  : "PARTIAL",
            },
            ":now": { N: String(now) },
          },
          ExpressionAttributeNames: { "#s": "status" },
        },
      },
      // 3️⃣  put Trade row
      {
        Put: {
          TableName: Resource.TradesTable.name,
          Item: marshall({
            pk: pk.market(trade.market),
            sk: `TS#${trade.tradeId}`,
            ...trade,
            traderId: undefined, // can optionally copy for GSI
          }),
        },
      },
      // 4️⃣ positions, intraday stats etc. – add here
      {
        Update: {
          TableName: Resource.StatsIntradayTable.name,               // ⚡️ SST‑safe
          Key: marshall({
            pk: pk.market(trade.market),            // eg. "MARKET#BTC-PERP"
            sk: `TS#${minuteBucketMs}`,             // eg. "TS#1725430860000"
          }),
          UpdateExpression: "ADD volume :v, fees :f SET expireAt = :ttl",
          ExpressionAttributeValues: {
            ":v":  { N: String(trade.qty * trade.price) },
            ":f":  { N: String(trade.takerFee + trade.makerFee) },
            ":ttl":{ N: String(ttl) },
          },
        },
      },
    
      /* ── 5️⃣ StatsLifetimeTable (single global row) ─────────────────────── */
      {
        Update: {
          TableName: Resource.StatsLifetimeTable.name,
          Key: marshall({ pk: "KEY#GLOBAL", sk: "META" }),
          UpdateExpression: "ADD volume :v, fees :f",
          ExpressionAttributeValues: {
            ":v": { N: String(trade.qty * trade.price) },
            ":f": { N: String(trade.takerFee + trade.makerFee) },
          },
        },
      }
    );

    remaining -= fillQty;
  }

  // Nothing matched → leave order OPEN
  if (writes.length === 0) return;

  await ddb.send(
    new TransactWriteItemsCommand({
      TransactItems: writes.slice(0, 25), // AWS limit 25
    })
  );
}