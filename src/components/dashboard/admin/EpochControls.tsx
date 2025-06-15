"use client";

import React, { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import toast from "react-hot-toast";

interface Props {}

// Simple admin utility panel for epoch-related actions.
// 1. Build & publish Merkle root (calls /api/admin/rewards/rollover)
// 2. Sweep vault (calls /api/admin/vault/sweep)
export const EpochControls: React.FC<Props> = () => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingTx, setPendingTx] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const publicClient = usePublicClient();

  async function trigger(url: string, action: string) {
    setLoadingAction(action);
    setMessage(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "unknown");

      if (json.tx) {
        setPendingTx(json.tx as string);
        setMessage(`${action} tx sent ${json.tx.slice(0, 10)}…`);
        toast.success("Tx sent " + json.tx.slice(0, 10) + "…");
      } else {
        setMessage(`${action} done (no tx)`);
      }
    } catch (e: any) {
      setMessage(`${action} failed: ${e.message}`);
      toast.error(e.message);
    } finally {
      setLoadingAction(null);
    }
  }

  // Poll for confirmation when we have a pending hash
  useEffect(() => {
    if (!pendingTx || confirmed) return;
    let cancelled = false;
    (async () => {
      try {
        if (!publicClient) return;
        await publicClient.waitForTransactionReceipt({ hash: pendingTx as `0x${string}` });
        if (cancelled) return;
        setConfirmed(true);
        toast.success("Tx confirmed");
        // optional auto-refresh
        window.location.reload();
      } catch (e) {
        console.error("wait receipt", e);
      }
    })();
    return () => { cancelled = true; };
  }, [pendingTx, confirmed, publicClient]);

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
      {pendingTx && (
        <p style={{ marginTop: 4 }}>
          <a href={`https://explorer.agung.peaq.network/tx/${pendingTx}`} target="_blank" rel="noopener noreferrer">
            View on Agung Explorer
          </a>
          {confirmed && <span style={{ color: "green", marginLeft: 6 }}>✓</span>}
        </p>
      )}
    </div>
  );
};

export default EpochControls; 