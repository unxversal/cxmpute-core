import React, { useState } from "react";

interface Props { onClose: () => void }

export const DepositTokensModal: React.FC<Props> = ({ onClose }) => {
  const [amount, setAmount] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    // NB: In real flow, wallet interaction would send CXPT to Vault.
    // Here we only mimic off-chain log entry.
    setLoading(true);
    setMsg(null);
    try {
      const fakeTx = "0x" + Math.random().toString(16).slice(2);
      const res = await fetch("/api/v1/pay/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "self", txHash: fakeTx, amount: amount.toString() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      setTxHash(fakeTx);
      setMsg("Deposit recorded");
    } catch (e: any) {
      setMsg(e.message);
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