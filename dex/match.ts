import { SQSHandler } from "aws-lambda";
import {
  DynamoDBClient,
  QueryCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import { Resource } from "sst";

import {
  IncomingOrder,
  OrderRow,
  OrderSide,
  OrderStatus,
  SettlementFill,
  TakerState,
} from "./types";
import { pkMarket, skOrder, skTrade } from "./utils/keys";

const ddb = new DynamoDBClient({});
const sqs = new SQSClient({});

/** ── cast Resource to any so TS stops complaining about generated props ── */
const ORDERS  : string = Resource.OrdersTable.name;
const TRADES  : string = Resource.TradesTable.name;
const SETTLE_Q: string = Resource.SettlementQueue.url;

export const handler: SQSHandler = async (event) => {
  for (const rec of event.Records) {
    const order = JSON.parse(rec.body) as IncomingOrder;
    await processOrder(order);
  }
};

async function processOrder(ord: IncomingOrder) {
  /** create a mutable copy we can enrich */
  const taker: TakerState = {
    ...ord,
    pk: pkMarket(ord.market),
    sk: skOrder(ord.side, ord.price, ord.ts, ord.clientOrderId),
    status: OrderStatus.NEW,
    filled: 0,
  };

  const fills: SettlementFill[] = [];
  let remaining = taker.qty;

  while (remaining > 0) {
    /* 1️⃣ fetch best price on opposite side */
    const best = await ddb.send(
      new QueryCommand({
        TableName: ORDERS,
        KeyConditionExpression: "pk = :pk and begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": { S: pkMarket(taker.market) },
          ":prefix": {
            S: taker.side === OrderSide.BUY ? "SIDE#SELL" : "SIDE#BUY",
          },
        },
        Limit: 1,
        ScanIndexForward: taker.side === OrderSide.BUY,
      })
    );
    if (!best.Items?.length) break;

    const maker = unmarshall(best.Items[0]) as OrderRow;

    /* 2️⃣ crossing check */
    const crossable =
      taker.type === "MARKET" ||
      (taker.side === OrderSide.BUY
        ? taker.price >= maker.price
        : taker.price <= maker.price);
    if (!crossable) break;

    /* 3️⃣ execute */
    const execQty = Math.min(remaining, maker.qty - maker.filled);
    remaining -= execQty;
    taker.filled += execQty;

    const tradeId = randomUUID();
    fills.push({
      market: taker.market,
      price: maker.price,
      qty: execQty,
      buyer: taker.side === OrderSide.BUY ? taker.userId : maker.userId,
      seller: taker.side === OrderSide.SELL ? taker.userId : maker.userId,
      product: taker.product,
      ts: Date.now(),
      tradeId,
    });

    /* 4️⃣ Dynamodb transact */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx: any[] = [];

    // update maker
    tx.push({
      Update: {
        TableName: ORDERS,
        Key: marshall({ pk: maker.pk, sk: maker.sk }),
        UpdateExpression:
          "SET filled = filled + :q, #st = if_not_exists(#st, :d)",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":q": execQty,
          ":d": OrderStatus.PARTIAL,
        }),
        ConditionExpression: "attribute_exists(pk)",
      },
    });

    // put/update taker if still open
    taker.status =
      remaining === 0 ? OrderStatus.FILLED : OrderStatus.PARTIAL;

    if (taker.filled === execQty) {
      // first loop → Put
      tx.push({
        Put: { TableName: ORDERS, Item: marshall(taker) },
      });
    } else {
      // subsequent loops → Update
      tx.push({
        Update: {
          TableName: ORDERS,
          Key: marshall({ pk: taker.pk, sk: taker.sk }),
          UpdateExpression: "SET filled = :f, #st = :s",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":f": taker.filled,
            ":s": taker.status,
          }),
        },
      });
    }

    // trade row
    tx.push({
      Put: {
        TableName: TRADES,
        Item: marshall({
          pk: pkMarket(taker.market),
          sk: skTrade(Date.now(), tradeId),
          price: maker.price,
          qty: execQty,
          buyOid: taker.side === OrderSide.BUY ? taker.clientOrderId : maker.clientOrderId,
          sellOid: taker.side === OrderSide.SELL ? taker.clientOrderId : maker.clientOrderId,
        }),
      },
    });

    await ddb.send(new TransactWriteItemsCommand({ TransactItems: tx }));
  }

  /* 5️⃣ push fills to SettlementQueue */
  if (fills.length) {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: SETTLE_Q,
        MessageBody: JSON.stringify(fills),
      })
    );
  }
}