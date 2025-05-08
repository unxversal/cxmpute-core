// src/app/api/v1/trade/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
  ConditionalCheckFailedException,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { v4 as uuidv4 } from "uuid";
import type {
  Order,
  OrderStatus,
  // OrderSide, // Removed as not directly used, covered by Order type
  TradingMode,
  TraderRecord,
  MarketOrder, // Import specific types for the switch
  LimitOrder,
  PerpOrder,
  FutureOrder,
  OptionOrder,
} from "@/lib/interfaces";
import { Resource } from "sst"; // Assuming SST Resources are globally available

// --- Constants ---
// Ignore TS errors for Resource properties as requested
const ORDERS_TABLE = Resource.OrdersTable.name;
const TRADERS_TABLE = Resource.TradersTable.name;
const FEE_BPS = 100; // 0.5%

// --- DynamoDB Client ---
const ddb = new DynamoDBClient({});

// --- Helper Functions ---
const pkMarketMode = (market: string, mode: TradingMode) => `MARKET#${market}#${mode.toUpperCase()}`;
// const pkTraderMode = (traderId: string, mode: TradingMode) => `TRADER#${traderId}#${mode.toUpperCase()}`; // Removed as unused in this file's logic

/**
 * Authenticates a trader using their Access Key (traderAk/userAk).
 * @param req - The NextRequest object.
 * @returns The authenticated trader's ID.
 * @throws Will throw an error representable as a NextResponse if authentication fails.
 */
async function authenticateTrader(req: NextRequest): Promise<string> {
  const traderAk = req.headers.get("X-Trader-Ak");

  if (!traderAk) {
    console.warn("Trade API Authentication Error: Missing X-Trader-Ak header");
    throw NextResponse.json({ error: "Missing X-Trader-Ak header" }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const resp = await ddb.send(
      new QueryCommand({
        TableName: TRADERS_TABLE,
        IndexName: "ByAk", // GSI PK=userAk (ensure this matches your setup)
        KeyConditionExpression: "userAk = :ak", // Adjust attribute name if needed
        ExpressionAttributeValues: marshall({ ":ak": traderAk }),
        Limit: 1,
        // ProjectionExpression: "traderId, #st", // Only fetch needed fields
        // ExpressionAttributeNames: { "#st": "status" },
      })
    );

    if (!resp.Items || resp.Items.length === 0) {
      console.warn(`Trade API Authentication Error: Trader AK not found: ${traderAk.substring(0, 8)}...`);
      throw NextResponse.json({ error: "Invalid Trader Access Key" }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const trader = unmarshall(resp.Items[0]) as TraderRecord;

    // Optional: Check trader status
    if (trader.status && trader.status !== "ACTIVE") {
       console.warn(`Trade API Authentication Error: Trader ${trader.traderId} is not active (status: ${trader.status})`);
       throw NextResponse.json({ error: "Trader account is not active" }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // Return the core traderId (UUID part)
    if (!trader.traderId) {
        console.error(`Trade API Authentication Error: Found record for AK but missing traderId: ${traderAk.substring(0, 8)}...`, trader);
        throw NextResponse.json({ error: "Internal authentication error" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    return trader.traderId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    // Handle potential DynamoDB errors during lookup
    if (!(error instanceof NextResponse)) { // Don't re-wrap our specific errors
        console.error(`Trade API Authentication Error: DDB lookup failed for AK ${traderAk.substring(0, 8)}...:`, error);
        throw NextResponse.json({ error: "Authentication service error" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    throw error; // Re-throw NextResponse errors
  }
}

// --- CORS Preflight Handler ---
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // Allow any origin
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Trader-Ak", // Allow necessary headers
    },
  });
}

// --- POST /api/v1/trade (Create Order) ---
export async function POST(req: NextRequest) {
  let authenticatedTraderId: string;
  try {
    authenticatedTraderId = await authenticateTrader(req);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: "Authentication failed" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const now = Date.now();
    // Use `any` for initial parsing, then validate and cast within the switch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await req.json();
    const orderId = uuidv4().replace(/-/g, "");
    const sk = `TS#${orderId}`;

    // Validate mode
    if (!body.mode || (body.mode !== "REAL" && body.mode !== "PAPER")) {
      return NextResponse.json({ error: "invalid or missing 'mode' (REAL or PAPER)" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    const mode: TradingMode = body.mode;

    // Validate common required fields
    if (!body.orderType || !body.market || !body.side || !body.qty || typeof body.qty !== 'number' || body.qty <= 0) {
      return NextResponse.json({ error: "invalid payload: missing or invalid required fields (orderType, market, side, qty)" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
     if (!["BUY", "SELL"].includes(body.side)) {
        return NextResponse.json({ error: "invalid payload: 'side' must be BUY or SELL" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    let order: Order;

    // Use switch statement for type safety and validation
    switch (body.orderType) {
      case "MARKET":
        order = {
          // No ...body spread here, explicitly assign fields
          orderId,
          sk,
          traderId: authenticatedTraderId,
          orderType: "MARKET",
          market: body.market,
          side: body.side,
          qty: body.qty,
          filledQty: 0,
          createdAt: now,
          status: "OPEN",
          feeBps: FEE_BPS,
        } satisfies MarketOrder; // Use 'satisfies' for type checking without casting
        break;

      case "LIMIT":
      case "PERP": // Assuming PERP has same fields as LIMIT for now
        if (body.price === undefined || typeof body.price !== 'number' || body.price <= 0) {
          return NextResponse.json({ error: `price required and must be positive for ${body.orderType} orders` }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        order = {
          orderId,
          sk,
          traderId: authenticatedTraderId,
          orderType: body.orderType, // Can be LIMIT or PERP
          market: body.market,
          side: body.side,
          qty: body.qty,
          price: body.price,
          filledQty: 0,
          createdAt: now,
          status: "OPEN",
          feeBps: FEE_BPS,
        } satisfies LimitOrder | PerpOrder; // Allow either type
        break;

      case "FUTURE":
         if (body.price === undefined || typeof body.price !== 'number' || body.price <= 0) {
            return NextResponse.json({ error: "price required and must be positive for FUTURE orders" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
         }
         if (body.expiryTs === undefined || typeof body.expiryTs !== 'number' || body.expiryTs <= now) {
            return NextResponse.json({ error: "expiryTs required and must be in the future for FUTURE orders" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        order = {
          orderId,
          sk,
          traderId: authenticatedTraderId,
          orderType: "FUTURE",
          market: body.market,
          side: body.side,
          qty: body.qty,
          price: body.price,
          expiryTs: body.expiryTs,
          filledQty: 0,
          createdAt: now,
          status: "OPEN",
          feeBps: FEE_BPS,
        } satisfies FutureOrder;
        break;

      case "OPTION":
         if (body.price === undefined || typeof body.price !== 'number' || body.price <= 0) { // Premium
            return NextResponse.json({ error: "price (premium) required and must be positive for OPTION orders" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
         }
          if (body.expiryTs === undefined || typeof body.expiryTs !== 'number' || body.expiryTs <= now) {
            return NextResponse.json({ error: "expiryTs required and must be in the future for OPTION orders" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (body.strike === undefined || typeof body.strike !== 'number' || body.strike <= 0) {
            return NextResponse.json({ error: "strike price required and must be positive for OPTION orders" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (!body.optionType || !["CALL", "PUT"].includes(body.optionType)) {
            return NextResponse.json({ error: "optionType ('CALL' or 'PUT') required for OPTION orders" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        order = {
          orderId,
          sk,
          traderId: authenticatedTraderId,
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
          feeBps: FEE_BPS,
        } satisfies OptionOrder;
        break;

      default:
        return NextResponse.json({ error: `Unsupported orderType: ${body.orderType}` }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const pk = pkMarketMode(order.market, mode);

    // Save the order
    await ddb.send(
      new PutItemCommand({
        TableName: ORDERS_TABLE,
        Item: marshall({ pk, ...order, mode }, { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      })
    );

    // Return the created order details
    return new NextResponse(JSON.stringify({ ...order, pk, mode }), {
      status: 201, // Created
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Add CORS header
      },
    });

  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return NextResponse.json(
        { error: "Order creation conflict (possible duplicate)" },
        { status: 409, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }
    console.error("POST /api/v1/trade error:", err);
    return NextResponse.json({ error: "Internal server error creating order" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}

// --- DELETE /api/v1/trade (Cancel Order) ---
export async function DELETE(req: NextRequest) {
  let authenticatedTraderId: string;
  try {
    authenticatedTraderId = await authenticateTrader(req);
  } catch (error) {
     if (error instanceof NextResponse) return error;
     return NextResponse.json({ error: "Authentication failed" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await req.json();
    const orderId = body?.orderId;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: "Missing or invalid 'orderId' in request body" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // 1. Find the order using the GSI
    const queryResp = await ddb.send(
      new QueryCommand({
        TableName: ORDERS_TABLE,
        IndexName: "ByOrderId",
        KeyConditionExpression: "orderId = :id",
        ExpressionAttributeValues: marshall({ ":id": orderId }),
        Limit: 1,
        // Project necessary fields including pk, sk, traderId, status
        ProjectionExpression: "pk, sk, traderId, #s",
        ExpressionAttributeNames: { "#s": "status" },
      })
    );

    if (!queryResp.Items || queryResp.Items.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const order = unmarshall(queryResp.Items[0]) as { pk: string; sk: string; traderId: string; status: OrderStatus };

    // 2. Authorization Check
    if (order.traderId !== authenticatedTraderId) {
      console.warn(`Cancel Order Auth Error: Trader ${authenticatedTraderId} attempted to cancel order ${orderId} belonging to ${order.traderId}`);
      return NextResponse.json({ error: "Forbidden: You can only cancel your own orders" }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // 3. Check if cancellable
    if (order.status !== "OPEN" && order.status !== "PARTIAL") {
      return NextResponse.json(
        { error: `Cannot cancel order in status: ${order.status}` },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // 4. Attempt to cancel using atomic update
    await ddb.send(
      new UpdateItemCommand({
        TableName: ORDERS_TABLE,
        Key: marshall({ pk: order.pk, sk: order.sk }),
        ConditionExpression: "#s IN (:open, :partial)", // Atomicity check
        UpdateExpression: "SET #s = :cancelled, updatedAt = :ts", // Add updatedAt timestamp
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: marshall({
          ":open": "OPEN",
          ":partial": "PARTIAL",
          ":cancelled": "CANCELLED",
          ":ts": Date.now(),
        }),
      })
    );

    return new NextResponse(JSON.stringify({ ok: true, message: `Order ${orderId} cancelled.` }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*", // Add CORS header
        },
    });

  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return NextResponse.json(
        { error: "Order status changed during cancellation (likely already filled/cancelled)" },
        { status: 409, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }
    let orderId = 'unknown';
    try { orderId = (await req.clone().json()).orderId ?? 'unknown'; } catch {} // Safely try to get orderId for logging
    console.error(`DELETE /api/v1/trade (orderId: ${orderId}) error:`, err);
    return NextResponse.json({ error: "Internal server error cancelling order" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}

// --- GET /api/v1/trade (Get Orders) ---
export async function GET(req: NextRequest) {
  let authenticatedTraderId: string;
  try {
    authenticatedTraderId = await authenticateTrader(req);
  } catch (error) {
     if (error instanceof NextResponse) return error;
     return NextResponse.json({ error: "Authentication failed" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const market = req.nextUrl.searchParams.get("market") ?? undefined;
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const modeParam = req.nextUrl.searchParams.get("mode");

    if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) {
        return NextResponse.json({ error: "query parameter 'mode' (REAL or PAPER) is required" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    const mode = modeParam as TradingMode;

    // Prepare query using ByTraderMode GSI
    const pkPrefix = market ? pkMarketMode(market, mode) : `MARKET#`; // Adjust prefix based on market filter

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryParams: any = {
        TableName: ORDERS_TABLE,
        IndexName: "ByTraderMode", // GSI: PK=traderId, SK=pk
        KeyConditionExpression: "traderId = :t AND begins_with(pk, :pkPrefix)",
        ExpressionAttributeValues: {
            ":t": authenticatedTraderId,
            ":pkPrefix": pkPrefix,
        },
        ScanIndexForward: false, // Get most recent first
    };

    // Add optional status filter using FilterExpression
    if (status) {
        const validStatuses = ["OPEN", "PARTIAL", "FILLED", "CANCELLED", "EXPIRED"];
        const upperStatus = status.toUpperCase();
        if (!validStatuses.includes(upperStatus)) {
             return NextResponse.json({ error: `Invalid status filter value. Must be one of: ${validStatuses.join(', ')}` }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        queryParams.FilterExpression = "#s = :st";
        queryParams.ExpressionAttributeNames = { "#s": "status" };
        queryParams.ExpressionAttributeValues[":st"] = upperStatus;
    }

    // Marshall ExpressionAttributeValues before sending
    queryParams.ExpressionAttributeValues = marshall(queryParams.ExpressionAttributeValues);

    const resp = await ddb.send(new QueryCommand(queryParams));
    const orders = (resp.Items ?? []).map((item) => unmarshall(item));

     return new NextResponse(JSON.stringify(orders), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*", // Add CORS header
        },
    });

  } catch (err) {
    console.error("GET /api/v1/trade error:", err);
     return NextResponse.json({ error: "Internal server error fetching orders" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}