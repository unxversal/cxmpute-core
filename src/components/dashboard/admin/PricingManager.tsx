/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from "react";

type PaygTier = { upto: number; price: number };
interface ConfigRow {
  endpoint: string;
  paygTiers: PaygTier[];
}

export const PricingManager: React.FC = () => {
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function fetchConfigs() {
    const res = await fetch("/api/admin/pricing?configId=all");
    setConfigs(await res.json());
  }

  useEffect(() => {
    fetchConfigs();
  }, []);

  function addTier(endpoint: string) {
    setConfigs((prev) =>
      prev.map((c) =>
        c.endpoint === endpoint ? { ...c, paygTiers: [...c.paygTiers, { upto: 0, price: 0 }] } : c
      )
    );
  }

  function updateTier(endpoint: string, idx: number, field: keyof PaygTier, value: number) {
    setConfigs((prev) =>
      prev.map((c) =>
        c.endpoint === endpoint
          ? {
              ...c,
              paygTiers: c.paygTiers.map((t, i) => (i === idx ? { ...t, [field]: value } : t)),
            }
          : c
      )
    );
  }

  async function save(endpoint: string) {
    setLoading(true);
    setMsg(null);
    const row = configs.find((c) => c.endpoint === endpoint)!;
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId: "current", endpoint, paygTiers: row.paygTiers }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      setMsg("Saved");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8, marginTop: 24 }}>
      <h3>Pricing Manager</h3>
      {configs.map((c) => (
        <div key={c.endpoint} style={{ marginBottom: 24 }}>
          <h4>{c.endpoint}</h4>
          {c.paygTiers.map((t, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              <input
                type="number"
                value={t.upto}
                onChange={(e) => updateTier(c.endpoint, idx, "upto", Number(e.target.value))}
                placeholder="Upto units"
              />
              <input
                type="number"
                value={t.price}
                step="0.0001"
                onChange={(e) => updateTier(c.endpoint, idx, "price", Number(e.target.value))}
                placeholder="CXPT price"
              />
            </div>
          ))}
          <button onClick={() => addTier(c.endpoint)}>Add Tier</button>
          <button disabled={loading} onClick={() => save(c.endpoint)} style={{ marginLeft: 8 }}>
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      ))}
      {msg && <p>{msg}</p>}
    </div>
  );
};

export default PricingManager; 