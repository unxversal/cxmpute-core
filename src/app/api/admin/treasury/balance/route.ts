/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/treasury/balance/route.ts

import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { Resource } from "sst";

// Minimal ERC20 interface
const erc20Abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];

export async function GET() {
  const rpc = Resource.PeaqRpcUrl.value;
  const provider = new ethers.JsonRpcProvider(rpc);

  const token = new ethers.Contract(Resource.CxptAddress.value, erc20Abi, provider);
  const vaultAddr = Resource.CxptVaultAddress.value;
  const treasuryAddr = process.env.TREASURY_SAFE_ADDRESS ?? "0x000000000000000000000000000000000000dead";

  const [vaultBalRaw, treasuryBalRaw, decimals] = await Promise.all([
    token.balanceOf(vaultAddr),
    token.balanceOf(treasuryAddr),
    token.decimals(),
  ]);

  const divisor = BigInt(10) ** BigInt(decimals);
  const toNum = (v: bigint) => Number(v) / Number(divisor);

  return NextResponse.json({
    vault: toNum(vaultBalRaw),
    treasury: toNum(treasuryBalRaw),
    tokenDecimals: decimals,
  });
} 