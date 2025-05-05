/* app/api/orders/[orderId]/route.ts */
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { Order } from "@/lib/interfaces"; // Assuming TradingMode is defined
import { Resource } from "sst";

const ORDERS_TABLE = Resource.OrdersTable.name;
const ddb = new DynamoDBClient({});

// PK helper is not strictly needed here as we get the full PK from the GSI lookup

/* ————————————————————————————— GET /orders/:orderId —————————————————————— */
export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { Items } = await ddb.send(
      new QueryCommand({
        TableName: ORDERS_TABLE,
        IndexName: "ByOrderId", // Use the GSI to find the order by its unique ID
        KeyConditionExpression: "orderId = :id",
        ExpressionAttributeValues: marshall({ ":id": params.orderId }),
        Limit: 1,
      })
    );

    if (!Items || Items.length === 0) {
      return NextResponse.json({ error: "order not found" }, { status: 404 });
    }
    // The item contains the full original data including the mode-partitioned PK
    return NextResponse.json(unmarshall(Items[0]));
  } catch (err) {
    console.error("GET /orders/:id error", err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}

/* ————————————————————————— DELETE /orders/:orderId (cancel) ——————————————— */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const orderId = params.orderId;

  try {
    /* 1. Look up via the GSI to get the full PK/SK + status */
    const { Items } = await ddb.send(
      new QueryCommand({
        TableName: ORDERS_TABLE,
        IndexName: "ByOrderId",
        KeyConditionExpression: "orderId = :id",
        ExpressionAttributeValues: marshall({ ":id": orderId }),
        // ProjectionExpression: "pk, sk, #s", // Project only needed fields
        // ExpressionAttributeNames: { "#s": "status" },
        Limit: 1,
      })
    );

    if (!Items || Items.length === 0) {
      return NextResponse.json({ error: "order not found" }, { status: 404 });
    }

    // Unmarshall the full item to get pk, sk, and status
    const order = unmarshall(Items[0]) as Order & { pk: string }; // Need pk and sk from the item

    if (!order.pk || !order.sk) {
        console.error("Error fetching order details for cancellation: Missing pk or sk", order);
        return NextResponse.json({ error: "internal error fetching order details" }, { status: 500 });
    }


    // Check current status before attempting cancellation
    if (order.status !== "OPEN" && order.status !== "PARTIAL") {
      return NextResponse.json(
        { error: `cannot cancel order in status: ${order.status}` },
        { status: 400 } // Bad request - can't cancel completed/cancelled order
      );
    }

    /* 2. Atomic status flip using the retrieved PK and SK */
    await ddb.send(
      new UpdateItemCommand({
        TableName: ORDERS_TABLE,
        Key: marshall({ pk: order.pk, sk: order.sk }), // Use the exact PK/SK from the lookup
        ConditionExpression: "#s IN (:open, :partial)", // Ensure it's still cancellable
        UpdateExpression: "SET #s = :cancelled",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: marshall({
          ":open": "OPEN",
          ":partial": "PARTIAL",
          ":cancelled": "CANCELLED",
        }),
      })
    );

    return NextResponse.json({ ok: true, message: `Order ${orderId} cancelled.` });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") {
      // This means the status changed between the read (Query) and the write (Update)
      return NextResponse.json(
        { error: "order status changed during cancellation attempt (likely already filled/cancelled)" },
        { status: 409 } // Conflict
      );
    }
    console.error("DELETE /orders/:id error", err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}