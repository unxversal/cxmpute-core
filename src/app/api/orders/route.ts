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
  TradingMode, // Assuming "REAL" | "PAPER" type added to interfaces.ts
} from "@/lib/interfaces"; // Make sure TradingMode is defined
import { Resource } from "sst";

/* --- constants ---------------------------------------------------- */
const ORDERS_TABLE = Resource.OrdersTable.name;
const FEE_BPS = 50; // 0.5 %

const ddb = new DynamoDBClient({});

/**
 * Helper: derive PK for Orders/Trades/Markets/Stats tables
 * NEW: Incorporates trading mode.
 */
const pkMarketMode = (market: string, mode: TradingMode) =>
  `MARKET#${market}#${mode.toUpperCase()}`;

/* ————————————————————————————————— POST /orders (create) ———————————————— */
export async function POST(req: NextRequest) {
  try {
    const now = Date.now();
    const body = (await req.json()) as Partial<Order> & { mode: TradingMode }; // Expect mode in request
    const orderId = body.orderId ?? uuidv4().replace(/-/g, "");
    const sk = `TS#${orderId}`; // Keep SK based on unique ID

    // --- Paper Trading Validation ---
    if (!body.mode || (body.mode !== "REAL" && body.mode !== "PAPER")) {
      return NextResponse.json(
        { error: "invalid or missing 'mode' (REAL or PAPER)" },
        { status: 400 }
      );
    }
    const mode = body.mode;
    // --- End Paper Trading Validation ---

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
        { error: "price required for non-market orders" },
        { status: 400 }
      );
    }

    const order: Order = {
      ...(body as Order), // Cast after validation
      orderId,
      // pk will be constructed with mode below
      sk,
      filledQty: 0,
      createdAt: now,
      status: "OPEN" satisfies OrderStatus,
      feeBps: FEE_BPS,
      // Add mode explicitly if you want it as an attribute, though it's in the PK
      // mode: mode
    };

    // Construct the primary key including the mode
    const pk = pkMarketMode(order.market, mode);

    await ddb.send(
      new PutItemCommand({
        TableName: ORDERS_TABLE,
        Item: marshall(
          {
            pk: pk, // Use the mode-partitioned PK
            ...order,
          },
          { removeUndefinedValues: true } // Important for optional fields like price
        ),
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)", // Ensure uniqueness of PK+SK combo
      })
    );

    // Return the order object, potentially including the constructed pk if needed by frontend
    return NextResponse.json({ ...order, pk }, { status: 201 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") {
      // This might now indicate a PK+SK collision rather than just orderId duplication
      return NextResponse.json(
        { error: "order creation conflict (possible duplicate)" },
        { status: 409 }
      );
    }
    console.error("POST /orders error", err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}

/* ————————————————————————————————— GET /orders (list) ————————————————— */
export async function GET(req: NextRequest) {
  const traderId = req.nextUrl.searchParams.get("traderId") ?? undefined;
  const market = req.nextUrl.searchParams.get("market") ?? undefined;
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const modeParam = req.nextUrl.searchParams.get("mode") ?? undefined; // NEW: Get mode from query

  // --- Paper Trading Validation ---
  if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) {
    return NextResponse.json(
      { error: "query parameter 'mode' (REAL or PAPER) is required" },
      { status: 400 }
    );
  }
  const mode = modeParam as TradingMode;
  // --- End Paper Trading Validation ---

  try {
    // --- Query by trader (using new ByTraderMode GSI) ---
    if (traderId) {
      // Construct the expected start of the PK (which is the GSI's range key)
      // If market is provided, we can filter more specifically
      const pkPrefix = market ? pkMarketMode(market, mode) : `MARKET#`; // Filter by market and mode if market is given

      const resp = await ddb.send(
        new QueryCommand({
          TableName: ORDERS_TABLE,
          IndexName: "ByTraderMode", // Use the new GSI
          KeyConditionExpression: "traderId = :t AND begins_with(pk, :pkPrefix)", // Query GSI PK and filter SK (original PK)
          FilterExpression: status ? "#s = :st" : undefined, // Optional status filter
          ExpressionAttributeNames: status ? { "#s": "status" } : undefined,
          ExpressionAttributeValues: marshall({
            ":t": traderId,
            ":pkPrefix": pkPrefix, // Use begins_with on the range key
            ...(status ? { ":st": status } : {}),
          }),
        })
      );
      const items = (resp.Items ?? []).map((it) => unmarshall(it));
      return NextResponse.json(items);
    }

    // --- Query by market (using primary index) ---
    if (!market) {
      // If not querying by traderId, market becomes required
      return NextResponse.json(
        { error: "query parameter 'market' is required when not filtering by 'traderId'" },
        { status: 400 }
      );
    }

    // Construct the full primary key for the market and mode
    const pk = pkMarketMode(market, mode);

    const resp = await ddb.send(
      new QueryCommand({
        TableName: ORDERS_TABLE,
        KeyConditionExpression: "pk = :pk", // Query by the exact market-mode PK
        FilterExpression: status ? "#s = :st" : undefined, // Optional status filter
        ExpressionAttributeNames: status ? { "#s": "status" } : undefined,
        ExpressionAttributeValues: marshall({
          ":pk": pk,
          ...(status ? { ":st": status } : {}),
        }),
      })
    );
    const items = (resp.Items ?? []).map((it) => unmarshall(it));
    return NextResponse.json(items);

  } catch (err) {
    console.error("GET /orders error", err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}