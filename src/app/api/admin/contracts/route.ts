// src/app/api/admin/contracts/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Resource } from "sst";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { requireAdmin } from "@/lib/auth";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = Resource.PricingConfigTable.name; // reuse table

/**
 * Return contract addresses for the current stage (testnet/mainnet).
 * Falls back to build-time Resource values if no override stored.
 */
export async function GET() {
  const stageItem = await ddb.send(new GetCommand({ TableName: TABLE, Key: { configId: "stage" } }));
  const stage = stageItem.Item?.value ?? "testnet";

  const addrKey = `contracts-${stage}`;
  const resp = await ddb.send(new GetCommand({ TableName: TABLE, Key: { configId: addrKey } }));
  const overrides = resp.Item ?? {};

  return NextResponse.json({
    stage,
    cxpt: overrides.cxpt ?? Resource.CxptAddress.value,
    vault: overrides.vault ?? Resource.CxptVaultAddress.value,
    rewardDistributor: overrides.rewardDistributor ?? Resource.RewardDistributorAddress.value,
    communityVester: overrides.communityVester ?? Resource.CommunityVesterAddress.value,
    lastUpdated: overrides.lastUpdated ?? null,
  });
}

/**
 * Update contract addresses for a given stage (defaults to the active stage).
 * Body: { stage?: "testnet"|"mainnet", cxpt, vault, rewardDistributor, communityVester }
 */
export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = await req.json();
  const {
    stage: inputStage,
    cxpt,
    vault,
    rewardDistributor,
    communityVester,
  } = body || {};

  // basic validation of addresses if provided
  const isAddr = (v: string | undefined) => !v || /^0x[a-fA-F0-9]{40}$/.test(v);
  if (!isAddr(cxpt) || !isAddr(vault) || !isAddr(rewardDistributor) || !isAddr(communityVester)) {
    return NextResponse.json({ error: "invalid address format" }, { status: 400 });
  }

  // Determine stage to store under
  let stage = inputStage;
  if (!stage) {
    const stItem = await ddb.send(
      new GetCommand({ TableName: TABLE, Key: { configId: "stage" } })
    );
    stage = stItem.Item?.value ?? "testnet";
  }
  if (!["testnet", "mainnet"].includes(stage)) {
    return NextResponse.json({ error: "stage must be testnet or mainnet" }, { status: 400 });
  }

  const configId = `contracts-${stage}`;
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        configId,
        cxpt,
        vault,
        rewardDistributor,
        communityVester,
        lastUpdated: Date.now(),
      },
    })
  );

  return NextResponse.json({ success: true, stage });
} 