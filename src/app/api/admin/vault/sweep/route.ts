import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { Resource } from "sst";
import { requireAdmin } from "@/lib/auth";

// ABI for the helper we added to RewardDistributor
const abi = [
  "function sweepVault(address vault) external"
];

export async function POST(_req: NextRequest) {
  // Ensure the caller is an authenticated admin (session-level)
  await requireAdmin();

  try {
    const provider = new ethers.JsonRpcProvider(Resource.PeaqRpcUrl.value);
    const signer = new ethers.Wallet(Resource.MerkleUpdaterKey.value, provider);

    const rd = new ethers.Contract(Resource.RewardDistributorAddress.value, abi, signer);
    const tx = await rd.sweepVault(Resource.CxptVaultAddress.value);
    await tx.wait();

    return NextResponse.json({ success: true, tx: tx.hash });
  } catch (err: any) {
    console.error("vault sweep", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
} 