import React, { useState } from "react";

interface Props { onClose: () => void }

export const SubscriptionPurchaseModal: React.FC<Props> = ({ onClose }) => {
  const [planId, setPlanId] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function purchase() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/pay/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "self", wallet: "0xYourWallet", planId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      setMsg(`Success! Token ${json.tokenId}`);
    } catch (e: any) {
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
        <button onClick={onClose} style={{ marginTop: 16 }}>Close</button>
      </div>
    </div>
  );
};

export default SubscriptionPurchaseModal; 