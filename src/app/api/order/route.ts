import { NextRequest, NextResponse } from "next/server";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { verifyOrderSignature } from "../../../../dex/utils/signature";
import { Resource } from "sst";

const sqs = new SQSClient({});

export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body
    const order = await request.json();
    
    // 2. Validate order structure
    if (!order.clientOrderId || !order.userId || !order.market || !order.side || !order.sig) {
      return NextResponse.json({ error: "Invalid order format" }, { status: 400 });
    }
    
    // 3. Verify EIP-712 signature
    try {
      const signer = verifyOrderSignature(order);
      if (signer.toLowerCase() !== order.userId.toLowerCase()) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    } catch (e) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 403 });
    }
    
    // 4. Enqueue to SQS FIFO with proper grouping and deduplication
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: Resource.OrdersQueue.url,
        MessageBody: JSON.stringify(order),
        MessageGroupId: order.market,            // Group by market
        MessageDeduplicationId: order.clientOrderId, // Prevent duplicates
      })
    );
    
    return NextResponse.json({ success: true, orderId: order.clientOrderId });
  } catch (error) {
    console.error("Order API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}