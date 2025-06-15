/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/vester/status/route.ts
import { NextResponse } from "next/server";
import { Resource } from "sst";
import { ethers } from "ethers";

const abi = [
  "function dailyEmission() view returns (uint256)",
  "function lastPoke() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

export async function GET() {
  const provider = new ethers.JsonRpcProvider(Resource.PeaqRpcUrl.value);
  const vesterAddr = Resource.CommunityVesterAddress.value;
  const tokenAddr = Resource.CxptAddress.value;

  const vester = new ethers.Contract(vesterAddr, abi, provider);
  const tokenAbi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
  const token = new ethers.Contract(tokenAddr, tokenAbi, provider);

  const [daily, last, balRaw, decimals] = await Promise.all([
    vester.dailyEmission(),
    vester.lastPoke(),
    token.balanceOf(vesterAddr),
    token.decimals(),
  ]);

  const divisor = BigInt(10) ** BigInt(decimals);
  const fmt = (v: bigint) => Number(v) / Number(divisor);

  const secondsSince = Math.max(0, Date.now() / 1000 - Number(last));
  const secondsUntil = 86400 - (secondsSince % 86400);

  return NextResponse.json({
    dailyEmission: fmt(daily),
    vesterBalance: fmt(balRaw),
    lastPoke: Number(last),
    secondsUntilNext: secondsUntil,
  });
} 