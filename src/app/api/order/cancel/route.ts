// app/api/order/cancel/route.ts
import { NextRequest, NextResponse } from "next/server";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Resource } from "sst";
import { CancelOrderPayload, verifyCancelOrderSignature } from "../../../../../dex/utils/signature"; // Adjust path as needed
// import { getAuthTokenPayload } from "../../../utils/auth"; // Assuming you have auth util

const sqs = new SQSClient({});
const ORDERS_QUEUE_URL = Resource.OrdersQueue.url; // Make sure Resource is available here

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication / Authorization (Example using a hypothetical JWT)
    const authPayload = await getAuthTokenPayload(request); // Implement this based on your auth setup
    if (!authPayload) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const requestUserId = authPayload.sub; // Or wallet address from session

    // 2. Parse request body
    const body: CancelOrderPayload = await request.json();

    // 3. Basic Validation
    if (!body.clientOrderId || !body.market || !body.sig || !body.userId) {
      return NextResponse.json(
        { error: "Missing required fields: clientOrderId, market, userId, sig" },
        { status: 400 }
      );
    }

    // Ensure the userId in the payload matches the authenticated user
    if (body.userId.toLowerCase() !== requestUserId.toLowerCase()) {
        return NextResponse.json({ error: "Payload userId does not match authenticated user" }, { status: 403 });
    }

    // 4. Verify EIP-712 Signature
    try {
      verifyCancelOrderSignature(body); // Throws on failure
    } catch (e) {
      return NextResponse.json({ error: `Invalid signature: ${e.message}` }, { status: 400 });
    }

    // 5. Enqueue cancellation request
    const messageBody = JSON.stringify({
        action: "CANCEL", // Distinguish from new orders
        ...body // Include userId, market, clientOrderId, sig
    });

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: ORDERS_QUEUE_URL,
        MessageBody: messageBody,
        // FIFO Queue Specifics:
        MessageGroupId: body.market, // Group by market like orders
        MessageDeduplicationId: `cancel-${body.clientOrderId}-${Date.now()}` // Ensure unique within dedupe window
      })
    );

    console.log(`Cancellation request enqueued for order ${body.clientOrderId} in market ${body.market}`);

    return NextResponse.json({ success: true, clientOrderId: body.clientOrderId });

  } catch (error) {
    console.error("Error processing cancel order request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper placeholder - replace with your actual auth logic
async function getAuthTokenPayload(request: NextRequest): Promise<{ sub: string } | null> {
    // Example: Read JWT from Authorization header, verify it, return payload
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // Replace with your actual JWT verification logic
        try {
            // const decoded = jwt.verify(token, YOUR_JWT_SECRET);
            // return decoded as { sub: string };
            // Dummy implementation:
            if (token === "valid-dummy-token") return { sub: "0x123..." }; // Replace with actual sub
        } catch(err) {
             console.error("JWT Verification failed:", err);
             return null;
        }
    }
    return null; // No valid token found
}