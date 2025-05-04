/* app/api/orders/[orderId]/route.ts */
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { OrderStatus } from "@/lib/interfaces";
import { Resource } from "sst";

/*  Next.js‑on‑Lambda settings  */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE_NAME = Resource.OrdersTable.name;
const ddb        = new DynamoDBClient({});

/* helper to rebuild PK for UpdateItem */
const pk = (market: string) => `MARKET#${market}`;

/* ─────────────────────────────── GET /orders/:orderId ─────────────── */
export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { Items } = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "ByOrderId",                    // GSI we just added
        KeyConditionExpression: "orderId = :id",
        ExpressionAttributeValues: { ":id": { S: params.orderId } },
        Limit: 1,
      })
    );

    if (!Items || Items.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(unmarshall(Items[0]));
  } catch (err) {
    console.error("GET /orders/:id error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

/* ───────────────────────── DELETE /orders/:orderId (cancel) ───────── */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const orderId = params.orderId;

  try {
    /* Look up via the same GSI to get PK/SK + status */
    const { Items } = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "ByOrderId",
        KeyConditionExpression: "orderId = :id",
        ExpressionAttributeValues: { ":id": { S: orderId } },
        Limit: 1,
      })
    );

    if (!Items || Items.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const order = unmarshall(Items[0]) as {
      market: string;
      sk: string;
      status: OrderStatus;
    };

    if (order.status !== "OPEN" && order.status !== "PARTIAL") {
      return NextResponse.json(
        { error: "cannot cancel — already filled or cancelled" },
        { status: 400 }
      );
    }

    /* atomic status flip */
    await ddb.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ pk: pk(order.market), sk: order.sk }),
        ConditionExpression: "#s IN (:open,:partial)",
        UpdateExpression: "SET #s = :cancelled",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":open":      { S: "OPEN" },
          ":partial":   { S: "PARTIAL" },
          ":cancelled": { S: "CANCELLED" },
        },
      })
    );

    return NextResponse.json({ ok: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") {
      return NextResponse.json(
        { error: "already closed" },
        { status: 409 }
      );
    }
    console.error("DELETE /orders/:id error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}