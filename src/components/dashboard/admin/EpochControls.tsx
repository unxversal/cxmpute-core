/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import toast from "react-hot-toast";

// No props for component
export const EpochControls: React.FC = () => {
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
      <p style={{ marginTop: 0, marginBottom: 16, fontSize: 14, color: '#666' }}>
        Manage the end-of-epoch processes for reward distribution.
      </p>
      
      <div style={{ marginBottom: 16 }}>
        <button
          disabled={!!loadingAction}
          onClick={() => trigger("/api/admin/rewards/rollover", "Rollover")}
          style={{ marginRight: 8 }}
        >
          {loadingAction === "Rollover" ? "Publishing..." : "Build & Publish Root"}
        </button>
        <p style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
          Calculates provider rewards for the epoch, builds a Merkle tree, and publishes the root on-chain.
        </p>
      </div>

      <div>
        <button
          disabled={!!loadingAction}
          onClick={() => trigger("/api/admin/vault/sweep", "Sweep")}
        >
          {loadingAction === "Sweep" ? "Sweeping..." : "Sweep Vault"}
        </button>
        <p style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
          Transfers the total rewards from the main vault to the distribution contract for user claims.
        </p>
      </div>

      {message && <p style={{ marginTop: 16 }}>{message}</p>}
      {pendingTx && (
        <p style={{ marginTop: 4 }}>
          <a href={`https://explorer.agung.peaq.network/tx/${pendingTx}`} target="_blank" rel="noopener noreferrer">
            View on Agung Explorer
          </a>
          {confirmed && <span style={{ color: "green", marginLeft: 6 }}>✓</span>}
        </p>
      )}

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #eee' }}>
        <h4>What does this all mean?</h4>
        <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>
          <p><strong>Epoch:</strong> An &quot;epoch&quot; is a specific period of time in your system. For example, an epoch could be a day or a week. At the end of each epoch, certain automated processes are run, like calculating rewards for users.</p>
          <p><strong>Merkle Root:</strong> A Merkle root is a cryptographic way to securely and efficiently verify large amounts of data. In your case, it&apos;s likely that at the end of an epoch, you calculate rewards for all eligible users. A Merkle tree is built from this reward data, and the &quot;Merkle root&quot; is a single, unique hash that represents the entire set of rewards. This root is then stored on a smart contract.</p>
          <p><strong>Build &amp; Publish Root:</strong> This is the process of taking the epoch&apos;s data (like user rewards), building the Merkle tree, and publishing its root to the blockchain. Once the root is published, it serves as a commitment to the data. Users can then prove they are entitled to a reward using a &quot;Merkle proof&quot; without needing to store all the reward data on-chain, which saves a lot of gas fees.</p>
          <p><strong>Sweep Vault:</strong> A &quot;vault&quot; is typically a smart contract that holds funds. &quot;Sweeping the vault&quot; is the action of transferring those funds. In this context, it likely means transferring the total rewards for an epoch from a treasury vault to a distribution contract, from which users can claim their individual rewards using their Merkle proofs.</p>
          <p><strong>Epoch Mgmt / Epoch Controls:</strong> This is the section of your admin dashboard that provides the interface for an administrator to trigger and manage these epoch-related processes, like building the Merkle root and sweeping the vault.</p>
        </div>
      </div>
    </div>
  );
};

export default EpochControls; 