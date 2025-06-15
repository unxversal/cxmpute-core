import React, { useState } from "react";

interface Props {}

// Simple admin utility panel for epoch-related actions.
// 1. Build & publish Merkle root (calls /api/admin/rewards/rollover)
// 2. Sweep vault (calls /api/admin/vault/sweep)
export const EpochControls: React.FC<Props> = () => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function trigger(url: string, action: string) {
    setLoadingAction(action);
    setMessage(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "unknown");
      setMessage(`${action} success: tx ${json.tx ?? "-"}`);
    } catch (e: any) {
      setMessage(`${action} failed: ${e.message}`);
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8 }}>
      <h3>Epoch Controls</h3>
      <button
        disabled={!!loadingAction}
        onClick={() => trigger("/api/admin/rewards/rollover", "Rollover")}
        style={{ marginRight: 8 }}
      >
        {loadingAction === "Rollover" ? "Publishing..." : "Build & Publish Root"}
      </button>
      <button
        disabled={!!loadingAction}
        onClick={() => trigger("/api/admin/vault/sweep", "Sweep")}
      >
        {loadingAction === "Sweep" ? "Sweeping..." : "Sweep Vault"}
      </button>
      {message && <p style={{ marginTop: 8 }}>{message}</p>}
    </div>
  );
};

export default EpochControls; 