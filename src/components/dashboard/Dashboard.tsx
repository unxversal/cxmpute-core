"use client";

import { useEffect, useState, useMemo } from "react";
import styles from "@/app/dashboard/dashboard.module.css";

import Button from "@/components/button/button";
import Link from "next/link";
import {
  Wallet,
  KeyRound,
  BarChart3,
  Server,
  Trash2,
  RefreshCcw,
} from "lucide-react";

/* ——— types coming from your OpenAuth subject ——— */
type Subject = {
  id: string;
  providerId: string;
  providerAk: string;
  userAk: string;
  userAks: string[];
  admin?: boolean;
};

type ApiKey = {
  key: string;
  creditLimit: number;
  creditsLeft: number;
  permittedRoutes: string[];
};

type EarningsPoint = { day: string; amount: number };

export default function Dashboard({ subject }: { subject: Subject }) {
  /* ——— view switcher ——— */
  const [mode, setMode] = useState<"user" | "provider" | "trader">("user");

  /* ——— user data ——— */
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [credits, setCredits] = useState<number>(0);
  const [rewards, setRewards] = useState<number>(0);

  /* ——— provider data ——— */
  const [earnings, setEarnings] = useState<EarningsPoint[]>([]);
  const totalEarnings = useMemo(
    () => earnings.reduce((sum, e) => sum + e.amount, 0),
    [earnings],
  );

  const [provisions, setProvisions] = useState<
    { provisionId: string; status: string }[]
  >([]);

  /*—————————————————————————————————————————*/
  /* Fetch helpers                                                               */
  /*—————————————————————————————————————————*/
  async function fetchUserData() {
    const res = await fetch(`/api/user/${subject.id}/summary`);
        if (res.ok) {
            const json = await res.json();
            setApiKeys(json.apiKeys ?? []);
            setCredits(json.credits ?? 0);
            setRewards(json.rewards ?? 0);
        }
    }

    async function fetchProviderData() {
        const res = await fetch(`/api/providers/${subject.providerId}/earnings`);
        if (res.ok) {
            const json = await res.json();
            setEarnings(json.earnings ?? []);
        }
        const p = await fetch(`/api/providers/${subject.providerId}/provisions`);
        if (p.ok) setProvisions(await p.json());
    }
  
  useEffect(() => {

    async function fetchUserData() {
        const res = await fetch(`/api/user/${subject.id}/summary`);
        if (res.ok) {
            const json = await res.json();
            setApiKeys(json.apiKeys ?? []);
            setCredits(json.credits ?? 0);
            setRewards(json.rewards ?? 0);
        }
    }

    async function fetchProviderData() {
        const res = await fetch(`/api/providers/${subject.providerId}/earnings`);
        if (res.ok) {
            const json = await res.json();
            setEarnings(json.earnings ?? []);
        }
        const p = await fetch(`/api/providers/${subject.providerId}/provisions`);
        if (p.ok) setProvisions(await p.json());
    }

    if (mode === "user") fetchUserData();
    if (mode === "provider") fetchProviderData();
  }, [mode, subject.id, subject.providerId]);

  /*—————————————————————————————————————————*/
  /* API-key CRUD                                                                 */
  /*—————————————————————————————————————————*/

  async function createKey() {
    const body: Partial<ApiKey> = {
      creditLimit: 10_000,
      permittedRoutes: ["/chat/completions"],
    };
    const res = await fetch(`/api/user/${subject.id}/keys`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) fetchUserData();
  }

  async function deleteKey(k: string) {
    await fetch(`/api/user/${subject.id}/keys/${k}`, { method: "DELETE" });
    fetchUserData();
  }

  async function refreshUserAk() {
    const res = await fetch(`/api/user/${subject.id}/userAk/refresh`, {
      method: "POST",
    });
    if (res.ok) fetchUserData();
  }

  async function refreshProviderAk() {
    await fetch(
      `/api/providers/${subject.providerId}/providerAk/refresh`,
      { method: "POST" },
    );
    fetchProviderData();
  }

  /*—————————————————————————————————————————*/
  /* Render helpers                                                              */
  /*—————————————————————————————————————————*/

  const EmptyCard = () => (
    <div className={styles.contentCard}>
      <h2>Dashboards</h2>
      <p>Select a view:</p>
      <div className={styles.switchButtons}>
        <button
          className={styles.switchBtn}
          onClick={() => setMode("user")}
          disabled={mode === "user"}
        >
          User&nbsp;dashboard
        </button>
        <button
          className={styles.switchBtn}
          onClick={() => setMode("provider")}
          disabled={mode === "provider"}
        >
          Provider&nbsp;dashboard
        </button>
        <Link href="/trade">
          <button className={styles.switchBtn}>Trader&nbsp;dashboard</button>
        </Link>
      </div>

      <div className={styles.keysBlock}>
        <h3>
          <KeyRound size={18} /> Primary keys
        </h3>

        <div className={styles.keyRow}>
          <code>{subject.userAk}</code>
          <button onClick={refreshUserAk} title="Refresh userAk">
            <RefreshCcw size={16} />
          </button>
        </div>

        <div className={styles.keyRow}>
          <code>{subject.providerAk}</code>
          <button onClick={refreshProviderAk} title="Refresh providerAk">
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  const UserCards = () => (
    <>
      {/* Rewards */}
      <div className={styles.contentCard}>
        <h2>
          <Wallet size={20} /> Rewards
        </h2>
        <p>{rewards.toLocaleString()} CXPT earned</p>
      </div>

      {/* Credits */}
      <div className={styles.contentCard}>
        <h2>
          <BarChart3 size={20} /> Credits
        </h2>
        <p>{credits.toLocaleString()} remaining</p>
      </div>

      {/* Keys CRUD */}
      <div className={styles.contentCard}>
        <h2>
          <KeyRound size={20} /> API Keys
        </h2>

        {apiKeys.length === 0 && <p>No extra keys.</p>}

        {apiKeys.map((k) => (
          <div key={k.key} className={styles.keyRow}>
            <code onClick={() => navigator.clipboard.writeText(k.key)}>
              {k.key}
            </code>
            <button
              title="Delete key"
              onClick={() => deleteKey(k.key)}
              className={styles.trashBtn}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        <button onClick={createKey} className={styles.addKeyBtn}>
          + Create key
        </button>
      </div>
    </>
  );

  const ProviderCards = () => (
    <>
      {/* Earnings */}
      <div className={styles.contentCard}>
        <h2>
          <Wallet size={20} /> Total earnings
        </h2>
        <p>{totalEarnings.toLocaleString()} CXPT</p>
        {/* simple sparkline */}
        <svg width="100%" height="60" viewBox="0 0 120 60">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            points={earnings
              .map((e, i) => {
                const x = (i / (earnings.length - 1)) * 120;
                const max = Math.max(...earnings.map((d) => d.amount), 1);
                const y = 60 - (e.amount / max) * 50 - 5;
                return `${x},${y}`;
              })
              .join(" ")}
          />
        </svg>
      </div>

      {/* Provisions */}
      <div className={styles.contentCard}>
        <h2>
          <Server size={20} /> Provisions
        </h2>

        {provisions.length === 0 && <p>No active provisions</p>}

        {provisions.map((p) => (
          <div key={p.provisionId} className={styles.provisionRow}>
            <span>{p.provisionId}</span>
            <em>{p.status}</em>
            <button
              onClick={async () => {
                await fetch(
                  `/api/providers/${subject.providerId}/provisions/${p.provisionId}`,
                  { method: "DELETE" },
                );
                fetchProviderData();
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );

  /*—————————————————————————————————————————*/
  /* JSX                                                                         */
  /*—————————————————————————————————————————*/
  return (
    <div className={styles.dashContainer}>
      <div className={styles.grid}>
        {/* first card always */}
        <EmptyCard />

        {mode === "user" && <UserCards />}
        {mode === "provider" && <ProviderCards />}
      </div>
    </div>
  );
}