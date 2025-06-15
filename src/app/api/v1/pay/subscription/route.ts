/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { ethers } from "ethers";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * POST /api/v1/pay/subscription
 * Body: { userId: string, wallet: string, planId: number }
 *
 * Flow:
 * 1. The client pays on-chain (if required) and submits this request.
 * 2. The backend (using PeaqAdminPrivateKey) mints an NFT to the user via
 *    SubscriptionManager.activatePlan(userAddress, planId).
 * 3. We store a record in SubscriptionsTable for dashboard fast lookup.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, wallet, planId } = await req.json();
    if (!userId || !wallet || planId === undefined) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    // 1. Mint NFT subscription pass
    const provider = new ethers.JsonRpcProvider(Resource.PeaqRpcUrl.value);
    const signer = new ethers.Wallet(Resource.PeaqAdminPrivateKey.value, provider);
    // @ts-ignore – SubscriptionManagerAddress binding
    const subManager = new ethers.Contract(
      // @ts-ignore
      Resource.SubscriptionManagerAddress.value,
      ["function activatePlan(address,uint256) external returns (uint256)"],
      signer
    );

    const tx = await subManager.activatePlan(wallet, planId);
    const receipt = await tx.wait();
    const tokenId = receipt?.logs[0]?.topics?.[3] ?? "0"; // crude extract

    // 2. Persist off-chain record
    // @ts-ignore – SubscriptionsTable binding
    await ddb.send(new PutCommand({
      // @ts-ignore
      TableName: Resource.SubscriptionsTable.name,
      Item: {
        userId,
        planId: planId.toString(),
        tokenId,
        activatedAt: Date.now().toString(),
      },
    }));

    return NextResponse.json({ ok: true, tx: tx.hash, tokenId });
  } catch (e: any) {
    console.error("subscription", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 