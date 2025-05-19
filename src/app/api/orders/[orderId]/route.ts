/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/api/orders/[orderId]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, // Use DocumentClient
  QueryCommand,
  UpdateCommand,
  GetCommand, // For GET handler
} from "@aws-sdk/lib-dynamodb";
import type { Order, OrderStatus } from "@/lib/interfaces";
import { Resource } from "sst";
import { requireAuth, AuthenticatedUserSubject } from "@/lib/auth"; // Your auth helper

const ORDERS_TABLE_NAME = (Resource as any).OrdersTable.name; // Use type assertion for local dev
const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({})); // Use DocumentClient

// --- GET /api/orders/:orderId (Fetch specific order) ---
export async function GET(
  req: NextRequest, // _req is conventional for unused params, but req is fine
  { params }: { params: Promise<{ orderId: string }> }
) {
  let authenticatedUser: AuthenticatedUserSubject;
  // Await the params promise to get the orderId
  const aparams = await params;

  try {
    authenticatedUser = await requireAuth();
  } catch (authError: any) {
    if (authError instanceof NextResponse) return authError;
    console.error(`GET /api/orders/${aparams.orderId} - Auth Error:`, authError.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: ORDERS_TABLE_NAME,
        IndexName: "ByOrderId",
        KeyConditionExpression: "orderId = :idVal",
        ExpressionAttributeValues: { ":idVal": aparams.orderId },
        Limit: 1,
      })
    );

    if (!Items || Items.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    const order = Items[0] as Order;

    // Authorization: Ensure the authenticated user owns this order
    if (order.traderId !== authenticatedUser.properties.traderId) {
        console.warn(`Order GET AuthZ Error: User ${authenticatedUser.properties.traderId} attempted to access order ${aparams.orderId} belonging to ${order.traderId}`);
        return NextResponse.json({ error: "Forbidden: Cannot access another user's order." }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    
    // Do not return pk/sk to client if they are internal implementation details
    const { pk, sk, ...clientOrder } = order;

    return NextResponse.json(clientOrder, { headers: { 'Access-Control-Allow-Origin': '*' } });

  } catch (err: any) {
    console.error(`GET /api/orders/${aparams.orderId} error:`, err);
    return NextResponse.json({ error: "Internal server error fetching order." }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}


// --- DELETE /api/orders/:orderId (Cancel specific order) ---
export async function DELETE(
  req: NextRequest, // Changed _req to req as it might be used for logging body if needed
  { params }: { params: { orderId: string } }
) {
  let authenticatedUser: AuthenticatedUserSubject;
  try {
    authenticatedUser = await requireAuth(); // Use your existing auth helper
  } catch (authError: any) {
    if (authError instanceof NextResponse) return authError; // Auth error is already a NextResponse
    console.error(`DELETE /api/orders/${params.orderId} - Auth Error:`, authError.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const orderIdToCancel = params.orderId;

  try {
    // 1. Find the order using the GSI to get its full PK/SK and current state
    const queryResult = await ddbDocClient.send(
      new QueryCommand({
        TableName: ORDERS_TABLE_NAME,
        IndexName: "ByOrderId",
        KeyConditionExpression: "orderId = :idVal",
        ExpressionAttributeValues: { ":idVal": orderIdToCancel },
        // ProjectionExpression: "pk, sk, traderId, #s, mode", // Fetch necessary fields
        // ExpressionAttributeNames: { "#s": "status" },
        Limit: 1,
      })
    );

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const order = queryResult.Items[0] as Order & { pk: string; sk: string }; // Cast to include pk/sk

    // 2. Authorization Check: Ensure the authenticated user owns this order
    if (order.traderId !== authenticatedUser.properties.traderId) {
      console.warn(`Order Cancel AuthZ Error: User ${authenticatedUser.properties.traderId} attempted to cancel order ${orderIdToCancel} belonging to ${order.traderId}`);
      return NextResponse.json({ error: "Forbidden: You can only cancel your own orders." }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // 3. Check if the order is in a cancellable state
    if (order.status !== "OPEN" && order.status !== "PARTIAL") {
      return NextResponse.json(
        { error: `Cannot cancel order. Current status: ${order.status}` },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } } // Bad Request
      );
    }

    // 4. Atomically update the order status to CANCELLED
    // The collateral release will be handled by the backend CancellationProcessor via DynamoDB Streams.
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORDERS_TABLE_NAME,
        Key: { pk: order.pk, sk: order.sk }, // Use the actual PK and SK of the order
        UpdateExpression: "SET #statusAttr = :cancelledStatus, updatedAt = :timestamp",
        ConditionExpression: "#statusAttr IN (:openStatus, :partialStatus)", // Ensure it's still cancellable
        ExpressionAttributeNames: {
          "#statusAttr": "status",
        },
        ExpressionAttributeValues: {
          ":cancelledStatus": "CANCELLED" as OrderStatus,
          ":openStatus": "OPEN" as OrderStatus,
          ":partialStatus": "PARTIAL" as OrderStatus,
          ":timestamp": Date.now(),
        },
      })
    );

    console.log(`Order ${orderIdToCancel} marked as CANCELLED by API. Collateral release to be handled by stream processor.`);

    return NextResponse.json(
      { success: true, message: `Order ${orderIdToCancel} cancellation request accepted.`, orderId: orderIdToCancel, newStatus: "CANCELLED" },
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (err: any) {
    // Specific check for ConditionalCheckFailedException from DynamoDBDocumentClient
    if (err.name === 'ConditionalCheckFailedException' || (err.hasOwnProperty('$metadata') && err.$metadata.httpStatusCode === 400 && err.message.includes("conditional request failed"))) {
      console.warn(`Order ${orderIdToCancel} cancellation failed due to conditional check (already filled/cancelled/status changed).`);
      return NextResponse.json(
        { error: "Order status changed during cancellation attempt (e.g., already filled or cancelled)." },
        { status: 409, headers: { 'Access-Control-Allow-Origin': '*' } } // Conflict
      );
    }
    console.error(`DELETE /api/orders/${orderIdToCancel} error:`, err);
    return NextResponse.json({ error: "Internal server error processing cancellation request." }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}