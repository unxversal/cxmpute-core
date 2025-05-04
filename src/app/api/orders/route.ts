/* app/api/orders/route.ts */
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { v4 as uuidv4 } from "uuid";
import type {
  Order,
  OrderStatus,
} from "@/lib/interfaces";
import { Resource } from "sst";

/* --- constants ---------------------------------------------------- */
const TABLE_NAME      = Resource.OrdersTable.name;
const FEE_BPS = 50;                // 0.5 %

const ddb = new DynamoDBClient({});

/* helper: derive PK/SK the same way everywhere */
const pk = (market: string) => `MARKET#${market}`;

/* ————————————————————————————————————————————— POST /orders (create) —— */
export async function POST(req: NextRequest) {
  try {
    const now      = Date.now();
    const body     = (await req.json()) as Partial<Order>;
    const orderId  = body.orderId ?? uuidv4().replace(/-/g, "");
    const sk       = `TS#${orderId}`;

    // rudimentary validation
    if (
      !body.traderId ||
      !body.orderType ||
      !body.market ||
      !body.side ||
      !body.qty ||
      body.qty <= 0
    ) {
      return NextResponse.json(
        { error: "invalid payload" },
        { status: 400 }
      );
    }

    // price is required except for pure MARKET orders
    if (
      body.orderType !== "MARKET" &&
      (body.price === undefined || body.price <= 0)
    ) {
      return NextResponse.json(
        { error: "price required for non‑market orders" },
        { status: 400 }
      );
    }

    const order: Order = {
      ...(body as Order),
      orderId,
      sk,
      filledQty: 0,
      createdAt: now,
      status: "OPEN" satisfies OrderStatus,
      feeBps: FEE_BPS,
    };

    await ddb.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall({
          pk: pk(order.market),
          ...order,
        }),
        ConditionExpression: "attribute_not_exists(pk)", // idempotent
      })
    );

    return NextResponse.json(order, { status: 201 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") {
      return NextResponse.json(
        { error: "duplicate orderId" },
        { status: 409 }
      );
    }
    console.error("POST /orders error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

/* ————————————————————————————————————————————— GET /orders (list) —— */
export async function GET(req: NextRequest) {
  const traderId = req.nextUrl.searchParams.get("traderId") ?? undefined;
  const market   = req.nextUrl.searchParams.get("market")   ?? undefined;
  const status   = req.nextUrl.searchParams.get("status")   ?? undefined;

  try {
    // list by trader GSI if traderId provided
    if (traderId) {
      const resp = await ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "ByTrader",
          KeyConditionExpression: "traderId = :t",
          ExpressionAttributeValues: { ":t": { S: traderId } },
        })
      );
      const items = (resp.Items ?? []).map((it) => unmarshall(it));
      return NextResponse.json(items);
    }

    // else list by market (PK) w/ optional status filter
    if (!market) {
      return NextResponse.json(
        { error: "traderId or market required" },
        { status: 400 }
      );
    }

    const resp = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "pk = :pk",
        FilterExpression: status ? "#s = :st" : undefined,
        ExpressionAttributeNames: status ? { "#s": "status" } : undefined,
        ExpressionAttributeValues: {
            ":pk": { S: pk(market) },
            ...(status ? { ":st": { S: status } } : {}),
          },
      })
    );
    const items = (resp.Items ?? []).map((it) => unmarshall(it));
    return NextResponse.json(items);
  } catch (err) {
    console.error("GET /orders error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}