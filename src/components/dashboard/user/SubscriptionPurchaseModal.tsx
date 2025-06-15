"use client";

import React, { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import toast from "react-hot-toast";
import { type Abi } from "viem";

interface Props { onClose: () => void }

// Minimal ABI for SubscriptionManager
const SUBSCRIPTION_MANAGER_ABI: Abi = [
  {
    type: "function",
    name: "activatePlan",
    inputs: [
      { name: "user", type: "address", internalType: "address" },
      { name: "planId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export const SubscriptionPurchaseModal: React.FC<Props> = ({ onClose }) => {
  const [planId, setPlanId] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  async function purchase() {
    if (!address) return toast.error("Connect wallet first");

    setLoading(true);
    setMsg(null);
    try {
      if (!publicClient) throw new Error("Public client not ready");

      // 1. Trigger on-chain call from the connected wallet
      const hash = await writeContractAsync({
        abi: SUBSCRIPTION_MANAGER_ABI,
        // @ts-ignore – public env var injected at build-time
        address: process.env.NEXT_PUBLIC_SUB_MANAGER_ADDRESS as `0x${string}`,
        functionName: "activatePlan",
        args: [address as `0x${string}`, BigInt(planId)],
      });

      toast.success("Tx sent " + hash.slice(0, 10) + "…");

      // 2. Wait for the tx to be mined before calling the backend so we are sure
      await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });

      // 3. Persist off-chain record
      await fetch("/api/v1/pay/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "self", wallet: address, planId }),
      });

      setTxHash(hash);
      setMsg("Subscription activated!");
    } catch (e: any) {
      toast.error(e.message || "Failed");
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", padding: 24, borderRadius: 8, width: 400 }}>
        <h3>Purchase Subscription</h3>
        <label>
          Plan ID:
          <input type="number" value={planId} onChange={(e) => setPlanId(Number(e.target.value))} />
        </label>
        <button disabled={loading} onClick={purchase} style={{ marginLeft: 8 }}>
          {loading ? "Purchasing..." : "Purchase"}
        </button>
        {msg && <p>{msg}</p>}
        {txHash ? (
          <p>
            Success! <a href={`https://explorer.agung.peaq.network/tx/${txHash}`} target="_blank" rel="noopener noreferrer">View on Agung Explorer</a>
          </p>
        ) : (
          <button onClick={onClose} style={{ marginTop: 16 }}>Close</button>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPurchaseModal; 