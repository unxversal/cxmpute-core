import { NextResponse } from "next/server";
import { Resource } from "sst";

export async function GET() {
  return NextResponse.json({
    subscriptionManager: Resource.SubscriptionManagerAddress.value,
    multisig: Resource.MultisigAddress?.value ?? "",
    cxpt: Resource.CxptAddress.value,
    vault: Resource.CxptVaultAddress.value,
  });
} 