/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/merkle/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resource } from "sst";
import { ethers } from "ethers";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { requireAdmin } from "@/lib/auth";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = Resource.MetadataTable.name;

export async function POST(req: NextRequest) {
  await requireAdmin();
  try {
    const { root, epoch, ipfsCid } = await req.json();
    if (!root || !epoch) {
      return NextResponse.json({ error: "missing root/epoch" }, { status: 400 });
    }
    const pk = Resource.MerkleUpdaterKey.value;
    const provider = new ethers.JsonRpcProvider(Resource.PeaqRpcUrl.value);
    const signer = new ethers.Wallet(pk, provider);

    const rdAddr = Resource.RewardDistributorAddress.value;
    const abi = ["function updateMerkleRoot(bytes32) external"];
    const rd = new ethers.Contract(rdAddr, abi, signer);
    const tx = await rd.updateMerkleRoot(root);
    await tx.wait();

    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          endpoint: "merkleRoot",
          dayTimestamp: epoch.toString(),
          root,
          ipfsCid,
          txHash: tx.hash,
        },
      })
    );

    return NextResponse.json({ success: true, tx: tx.hash });
  } catch (e: any) {
    console.error("merkle upload", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 