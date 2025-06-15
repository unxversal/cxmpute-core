"use client";
import React, { useEffect, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { encodeWithdraw, MULTISIG_ABI } from "@/lib/chain";
import toast from "react-hot-toast";

interface Proposal {
  proposalId: string;
  target: string;
  value: string;
  data: string;
  executed: string;
  createdAt: string;
}

export const TreasuryControls: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<{ target: string; value: string; data: string }>({ target: "", value: "0", data: "0x" });
  const [msg, setMsg] = useState<string | null>(null);

  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  async function fetchList() {
    const res = await fetch("/api/admin/multisig/proposals?executed=false");
    setProposals(await res.json());
  }

  useEffect(() => {
    fetchList();
  }, []);

  async function createProposal() {
    if (!address) {
      toast.error("Connect wallet first");
      return;
    }
    setLoading(true);
    try {
      // write on-chain first (propose)
      const txHash = await writeContractAsync({
        abi: MULTISIG_ABI,
        address: process.env.NEXT_PUBLIC_MULTISIG_ADDRESS as `0x${string}`,
        functionName: "propose",
        args: [form.target as `0x${string}`, BigInt(form.value || "0"), form.data as `0x${string}`],
      });
      toast.success("Tx sent " + txHash.slice(0, 10) + "…");

      // store off-chain record
      const proposalId = Date.now().toString();
      await fetch("/api/admin/multisig/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, ...form }),
      });
      setMsg("Proposal submitted");
      setForm({ target: "", value: "0", data: "0x" });
      await fetchList();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: string) {
    if (!address) return toast.error("Connect wallet");
    try {
      await writeContractAsync({
        abi: MULTISIG_ABI,
        address: process.env.NEXT_PUBLIC_MULTISIG_ADDRESS as `0x${string}`,
        functionName: "approve",
        args: [BigInt(id)],
      });
      toast.success("Approval tx sent");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8, marginTop: 24 }}>
      <h3>Treasury Controls (Multisig)</h3>
      <fieldset style={{ marginBottom: 12 }}>
        <legend>Create Proposal</legend>
        <input
          style={{ width: "100%", marginBottom: 8 }}
          placeholder="Target address"
          value={form.target}
          onChange={(e) => setForm({ ...form, target: e.target.value })}
        />
        <input
          style={{ width: "100%", marginBottom: 8 }}
          placeholder="Value (wei)"
          value={form.value}
          onChange={(e) => setForm({ ...form, value: e.target.value })}
        />
        <input
          style={{ width: "100%", marginBottom: 8 }}
          placeholder="Calldata (0x)"
          value={form.data}
          onChange={(e) => setForm({ ...form, data: e.target.value })}
        />
        <button disabled={loading} onClick={createProposal}>
          {loading ? "Submitting..." : "Submit Proposal"}
        </button>
      </fieldset>
      {msg && <p>{msg}</p>}

      <h4>Pending Proposals</h4>
      <ul>
        {proposals.map((p) => (
          <li key={p.proposalId}>
            #{p.proposalId.slice(-6)} – {p.target.slice(0, 6)}… executed: {p.executed}
            {p.executed !== "true" && (
              <button style={{ marginLeft: 8 }} onClick={() => approve(p.proposalId)}>
                Approve
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TreasuryControls; 