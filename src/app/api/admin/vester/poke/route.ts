/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/vester/poke/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resource } from "sst";
import { ethers } from "ethers";
import { requireAdmin } from "@/lib/auth";

const abi = ["function poke() external"];

export async function POST(_req: NextRequest) {
  await requireAdmin();
  try {
    const provider = new ethers.JsonRpcProvider(Resource.PeaqRpcUrl.value);
    const signer = new ethers.Wallet(Resource.MerkleUpdaterKey.value, provider);
    const vester = new ethers.Contract(Resource.CommunityVesterAddress.value, abi, signer);
    const tx = await vester.poke();
    await tx.wait();
    return NextResponse.json({ success: true, tx: tx.hash });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 