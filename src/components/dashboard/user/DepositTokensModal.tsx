"use client";
import React, { useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import toast from "react-hot-toast";
import { Resource } from "sst";

import { type Abi } from "viem";

const ERC20_ABI: Abi = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

interface Props { onClose: () => void }

export const DepositTokensModal: React.FC<Props> = ({ onClose }) => {
  const [amount, setAmount] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  async function submit() {
    if (!address) return toast.error("Connect wallet");
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        abi: ERC20_ABI,
        address: process.env.NEXT_PUBLIC_CXPT_ADDRESS as `0x${string}`,
        functionName: "transfer",
        args: [process.env.NEXT_PUBLIC_VAULT_ADDRESS as `0x${string}`, parseUnits(amount.toString(), 18)],
      });
      toast.success("Tx sent " + hash.slice(0, 10) + "…");

      await fetch("/api/v1/pay/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "self", txHash: hash, amount: amount.toString() }),
      });
      setTxHash(hash);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", padding: 24, borderRadius: 8, width: 400 }}>
        <h3>Deposit CXPT</h3>
        {txHash ? (
          <p>Done! Tx {txHash.slice(0, 10)}...</p>
        ) : (
          <>
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <button disabled={loading} onClick={submit} style={{ marginLeft: 8 }}>
              {loading ? "Submitting..." : "Record Deposit"}
            </button>
          </>
        )}
        {msg && <p>{msg}</p>}
        <button onClick={onClose} style={{ marginTop: 16 }}>Close</button>
      </div>
    </div>
  );
};

export default DepositTokensModal; 