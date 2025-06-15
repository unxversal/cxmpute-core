import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * POST /api/v1/pay/deposit
 * Body: { userId: string, txHash: string, amount: string }
 *
 * This endpoint is invoked from the frontend AFTER the user sends an on-chain
 * deposit transaction into the Vault contract. The backend simply keeps an
 * off-chain audit trail so we can quickly show balances in the dashboard.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, txHash, amount } = await req.json();
    if (!userId || !txHash || !amount) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    // @ts-ignore – SubscriptionsTable typing may be stale
    await ddb.send(new PutCommand({
      TableName: Resource.MetadataTable.name, // lightweight audit -> reuse metadata table
      Item: {
        endpoint: "deposit",
        dayTimestamp: Date.now().toString(),
        userId,
        txHash,
        amount,
      },
    }));

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("deposit", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 