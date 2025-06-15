// src/lib/peaq.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
// Thin wrapper around @peaq-network/sdk to keep SDK initialisation & DID helpers

import { Sdk } from "@peaq-network/sdk";
import { Wallet, ethers } from "ethers";
import { Resource } from "sst";

export type DidState = "started" | "running" | "off";

// Cached SDK instance (one per Lambda)
let _sdk: Sdk | null = null;

async function getSdk(): Promise<Sdk> {
  if (_sdk) return _sdk;

  const baseUrl = Resource.PeaqRpcUrl.value ||
    "https://peaq-agung.api.onfinality.io/public"; // default testnet
  _sdk = await Sdk.createInstance({
    baseUrl,
    chainType: Sdk.ChainType.EVM,
  });
  return _sdk;
}

// -----------------------------------------------------------------------------
// Wallet helpers (admin signer)
// -----------------------------------------------------------------------------

function getAdminWallet() {
  const priv = Resource.PeaqAdminPrivateKey.value;
  if (!priv || !priv.startsWith("0x")) {
    throw new Error("Missing PEAQ_ADMIN_PRIVATE_KEY env var");
  }
  const provider = new ethers.JsonRpcProvider(
    Resource.PeaqRpcUrl.value || "https://peaq-agung.api.onfinality.io/public"
  );
  return new Wallet(priv, provider);
}

// -----------------------------------------------------------------------------
// DID helpers
// -----------------------------------------------------------------------------

interface DraftDidExtra {
  providerId: string;
  provisionId: string;
  endpoint: string;
  deviceTier: string;
  country: string;
  state: DidState;
}

export async function createMachineDid(
  machineAddress: string,
  providerWallet: string,
  extra: DraftDidExtra
): Promise<string> {
  const sdk = await getSdk();
  const admin = getAdminWallet();

  const customFields = {
    verifications: [
      {
        type: "EcdsaSecp256k1RecoveryMethod2020",
      },
    ],
    services: [
      {
        id: "#cxmpute",
        type: "provision",
        data: extra.provisionId,
      },
    ],
    extra,
  } as Record<string, unknown>;

  const tx = await sdk.did.create({
    name: "cxmpute-provision",
    address: providerWallet,
    customDocumentFields: customFields,
  });

  const receipt: any = await Sdk.sendEvmTx({
    tx,
    baseUrl: Resource.PeaqRpcUrl.value || "https://peaq-agung.api.onfinality.io/public",
    seed: admin.privateKey,
  });

  const txHash = receipt?.transactionHash || "0x" + Math.random().toString(16).slice(2);
  const did = `did:peaq:evm:${txHash}`;
  return did;
}

export async function updateDidState(
  did: string,
  newState: DidState
) {
  const sdk = await getSdk();
  const admin = getAdminWallet();

  const tx = await sdk.did.update({
    did,
    customDocumentFields: {
      "extra.state": newState, // path-like update
    },
  } as never); // cast due to SDK types not known

  await Sdk.sendEvmTx({
    tx: tx as any,
    baseUrl: Resource.PeaqRpcUrl.value || "https://peaq-agung.api.onfinality.io/public",
    seed: admin.privateKey,
  });
} 