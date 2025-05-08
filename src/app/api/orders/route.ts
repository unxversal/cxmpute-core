/* app/api/orders/route.ts */
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand, // Import UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { v4 as uuidv4 } from "uuid";
import type {
  LimitOrder,
  MarketOrder,
  OptionOrder,
  Order,
  OrderStatus,
  TradingMode,
} from "@/lib/interfaces";
import { Resource } from "sst";

/* --- constants ---------------------------------------------------- */
const ORDERS_TABLE = Resource.OrdersTable.name;
const TRADERS_TABLE = Resource.TradersTable.name; // Added Traders table name
const FEE_BPS = 50; // 0.5 %

const ddb = new DynamoDBClient({});

/**
 * Helper: derive PK for Orders/Trades/Markets/Stats tables
 * NEW: Incorporates trading mode.
 */
const pkMarketMode = (market: string, mode: TradingMode) =>
  `MARKET#${market}#${mode.toUpperCase()}`;

/**
 * Helper: derive PK for Traders/Balances table based on mode
 */
const pkTraderMode = (traderId: string, mode: TradingMode) =>
  `TRADER#${traderId}#${mode.toUpperCase()}`;


/* ————————————————————————————————— POST /orders (create) ———————————————— */
export async function POST(req: NextRequest) {
  try {
    const now = Date.now();
    // Explicitly type the body to include mode
    const body = (await req.json()) as Partial<Order> & { mode?: TradingMode };
    const orderId = body.orderId ?? uuidv4().replace(/-/g, "");
    const sk = `TS#${orderId}`;

    // --- Paper Trading Validation ---
    if (!body.mode || (body.mode !== "REAL" && body.mode !== "PAPER")) {
      return NextResponse.json(
        { error: "invalid or missing 'mode' (REAL or PAPER)" },
        { status: 400 }
      );
    }
    const mode = body.mode; // Validated mode
    // --- End Paper Trading Validation ---

    // Rudimentary validation
    if (
      !body.traderId ||
      !body.orderType ||
      !body.market ||
      !body.side ||
      !body.qty ||
      body.qty <= 0
    ) {
      return NextResponse.json(
        { error: "invalid payload: missing required fields" },
        { status: 400 }
      );
    }

    // Price validation
    if (
      body.orderType !== "MARKET" &&
      (body.price === undefined || body.price <= 0)
    ) {
      return NextResponse.json(
        { error: "price required for non-market orders" },
        { status: 400 }
      );
    }

    // Prepare the base order object
    let order: Order;

    switch (body.orderType) {
      case "MARKET":
        order = {
          ...body,
          orderId,
          sk,
          traderId: body.traderId,
          orderType: "MARKET",
          market: body.market,
          side: body.side,
          qty: body.qty,
          filledQty: 0,
          createdAt: now,
          status: "OPEN",
          feeBps: 50,
        } as MarketOrder;
        break;
      case "LIMIT":
        order = {
          ...body,
          orderId,
          sk,
          traderId: body.traderId,
          orderType: "LIMIT",
          market: body.market,
          side: body.side,
          qty: body.qty,
          price: body.price,
          filledQty: 0,
          createdAt: now,
          status: "OPEN",
          feeBps: 50,
        } as LimitOrder;
        break;
      case "OPTION":
        order = {
          ...body,
          orderId,
          sk,
          traderId: body.traderId,
          orderType: "OPTION",
          market: body.market,
          side: body.side,
          qty: body.qty,
          price: body.price,
          strike: body.strike,
          expiryTs: body.expiryTs,
          optionType: body.optionType,
          filledQty: 0,
          createdAt: now,
          status: "OPEN",
          feeBps: 50,
        } as OptionOrder;
        break;
      // Add cases for other order types
      default:
        throw new Error(`Invalid order type: ${body.orderType}`);
    }

    // Construct the primary key including the mode
    const pk = pkMarketMode(order.market, mode);

    // --- Save the Order to DynamoDB ---
    await ddb.send(
      new PutItemCommand({
        TableName: ORDERS_TABLE,
        Item: marshall(
          {
            pk: pk, // Use the mode-partitioned PK
            ...order,
            // Explicitly add mode if you want it as a top-level attribute
            mode: mode,
          },
          { removeUndefinedValues: true }
        ),
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      })
    );

    // --- Award Paper Points for Placing a Limit Order ---
    if (mode === "PAPER" && order.orderType === "LIMIT") {
      try {
        const pointsToAwardStr = Resource.PaperPointsLimitOrder.value ?? "1"; // Get value from secret, default to "1"
        const pointsToAward = parseInt(pointsToAwardStr, 10);

        if (!isNaN(pointsToAward) && pointsToAward > 0) {
            const traderPk = pkTraderMode(order.traderId, "PAPER"); // Target the PAPER record for the trader
            const traderSk = "META"; // Assuming sort key for trader main data is META

            console.log(`Awarding ${pointsToAward} paper points to ${traderPk} for placing limit order ${orderId}`);

            await ddb.send(
              new UpdateItemCommand({
                TableName: TRADERS_TABLE,
                Key: marshall({ pk: traderPk, sk: traderSk }),
                // Update expression:
                // - Sets paperPoints.epoch to 1 if paperPoints OR paperPoints.epoch doesn't exist.
                // - Adds pointsToAward to paperPoints.totalPoints. ADD handles non-existent number by starting from 0.
                UpdateExpression: `
                        SET paperPoints.epoch = if_not_exists(paperPoints.epoch, :initEpoch)
                        ADD paperPoints.totalPoints :points
                    `,
                ExpressionAttributeValues: marshall({
                  ":points": pointsToAward,
                  ":initEpoch": 1, // Initial epoch number
                }),
              })
            );
        } else {
             console.warn(`Invalid point value configured for PaperPointsLimitOrder: ${pointsToAwardStr}. Skipping point award for order ${orderId}.`);
        }
      } catch (pointError) {
        // Log error but don't fail the order placement itself
        console.error(`Failed to award paper points for limit order ${orderId}:`, pointError);
      }
    }
    // --- End Points Award Logic ---

    // Return the created order object
    return NextResponse.json({ ...order, pk }, { status: 201 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") {
      return NextResponse.json(
        { error: "order creation conflict (possible duplicate)" },
        { status: 409 }
      );
    }
    console.error("POST /orders error:", err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}


/* ————————————————————————————————— GET /orders (list) ————————————————— */
export async function GET(req: NextRequest) {
  const traderId = req.nextUrl.searchParams.get("traderId") ?? undefined;
  const market = req.nextUrl.searchParams.get("market") ?? undefined;
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const modeParam = req.nextUrl.searchParams.get("mode") ?? undefined; // Get mode from query

  // --- Mode Validation ---
  if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) {
    return NextResponse.json(
      { error: "query parameter 'mode' (REAL or PAPER) is required" },
      { status: 400 }
    );
  }
  const mode = modeParam as TradingMode;
  // --- End Validation ---

  try {
    // --- Query by trader (using ByTraderMode GSI) ---
    if (traderId) {
        // Construct the GSI range key prefix (which is the original PK)
        // If market is provided, filter more specifically.
        const pkPrefix = market ? pkMarketMode(market, mode) : `MARKET#`; // Filter by market-mode prefix

        const resp = await ddb.send(
          new QueryCommand({
            TableName: ORDERS_TABLE,
            IndexName: "ByTraderMode", // GSI: PK=traderId, SK=pk (original PK)
            KeyConditionExpression: "traderId = :t AND begins_with(pk, :pkPrefix)", // Query GSI PK, Filter GSI SK
            FilterExpression: status ? "#s = :st" : undefined, // Optional status filter
            ExpressionAttributeNames: status ? { "#s": "status" } : undefined,
            ExpressionAttributeValues: marshall({
              ":t": traderId,
              ":pkPrefix": pkPrefix, // Filter SK based on market/mode
              ...(status ? { ":st": status } : {}),
            }),
            // Consider adding ScanIndexForward: false for most recent orders first
          })
        );
        const items = (resp.Items ?? []).map((it) => unmarshall(it));
        return NextResponse.json(items);
    }

    // --- Query by market (using primary index) ---
    if (!market) {
      // If not querying by traderId, market becomes required for primary index query
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
         // Consider adding ScanIndexForward: false for most recent orders first
      })
    );
    const items = (resp.Items ?? []).map((it) => unmarshall(it));
    return NextResponse.json(items);

  } catch (err) {
    console.error("GET /orders error:", err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}