import React, { useEffect, useState } from "react";

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

  async function fetchList() {
    const res = await fetch("/api/admin/multisig/proposals?executed=false");
    setProposals(await res.json());
  }

  useEffect(() => {
    fetchList();
  }, []);

  async function createProposal() {
    setLoading(true);
    setMsg(null);
    try {
      const proposalId = Date.now().toString();
      const res = await fetch("/api/admin/multisig/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, ...form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      setMsg("Proposal created");
      setForm({ target: "", value: "0", data: "0x" });
      await fetchList();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
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
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TreasuryControls; 