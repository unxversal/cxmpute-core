import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { ethers } from "ethers";
import { requireAdmin } from "@/lib/auth";
import { buildMerkle, LeafInput } from "@/lib/merkle";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function POST(_req: NextRequest) {
  await requireAdmin();

  // 1. gather point totals from Dynamo (placeholder table & fields)
  const table = "ProviderPointsTable"; // TODO: replace with actual table when defined
  const scan = await ddb.send(new ScanCommand({ TableName: table }));
  const items: any[] = scan.Items ?? [];
  if (items.length === 0) {
    return NextResponse.json({ error: "no points data" }, { status: 400 });
  }

  // 2. Convert to leaf inputs (dummy assume field totalPoints)
  const leaves: LeafInput[] = items.map((it) => ({ address: it.walletAddress, amount: BigInt(it.totalPoints) }));

  // 3. Build merkle
  const { root } = buildMerkle(leaves);

  // 4. Call the on-chain updater via existing admin/merkle endpoint logic directly here
  try {
    const provider = new ethers.JsonRpcProvider(Resource.PeaqRpcUrl.value);
    const signer = new ethers.Wallet(Resource.MerkleUpdaterKey.value, provider);
    const rd = new ethers.Contract(Resource.RewardDistributorAddress.value, ["function updateMerkleRoot(bytes32) external"], signer);
    const tx = await rd.updateMerkleRoot(root);
    await tx.wait();

    // store metadata
    await ddb.send(new ScanCommand({ TableName: Resource.MetadataTable.name })); // placeholder, could PutCommand

    return NextResponse.json({ success: true, tx: tx.hash, root });
  } catch (e: any) {
    console.error("rollover", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 