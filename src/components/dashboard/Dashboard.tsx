"use client";

import { useEffect, useState, useMemo } from "react";
import styles from "./dashboard.module.css";

import Button from "@/components/button/button";
import Link from "next/link";
import {
  Wallet,
  KeyRound,
  BarChart3,
  Server,
  Trash2,
  RefreshCcw,
  Copy,
} from "lucide-react";

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

const ROUTES = [
  "/chat/completions",
  "/embeddings",
  "/image",
  "/tts",
  "/video",
  "/scrape",
  "/m/caption",
  "/m/query",
  "/m/detect",
  "/m/point",
];

export default function Dashboard({ subject }: { subject: Subject }) {
  /* ——————————————————— view switcher ——————————————————— */
  const [mode, setMode] = useState<"user" | "provider" | "trader">("user");

  /* ——————————————————— user state ——————————————————— */
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [credits, setCredits] = useState<number>(0);
  const [rewards, setRewards] = useState<number>(0);

  /* ——————————————————— provider state ——————————————————— */
  const [earnings, setEarnings] = useState<EarningsPoint[]>([]);
  const totalEarnings = useMemo(
    () => earnings.reduce((s, e) => s + e.amount, 0),
    [earnings],
  );
  const [provisions, setProvisions] = useState<
    { provisionId: string; status: string }[]
  >([]);

  /* ——————————————————— modal confirm ——————————————————— */
  const [confirm, setConfirm] = useState<{
    msg: string;
    onYes: () => void;
  } | null>(null);

  /* ——————————————————— helpers ——————————————————— */
  const fetchUserData = async () => {
    const r = await fetch(`/api/user/${subject.id}/summary`);
    if (!r.ok) return;
    const j = await r.json();
    setApiKeys(j.apiKeys ?? []);
    setCredits(j.credits ?? 0);
    setRewards(j.rewards ?? 0);
  };

  const fetchProviderData = async () => {
    const r = await fetch(`/api/providers/${subject.providerId}/earnings`);
    if (r.ok) setEarnings((await r.json()).earnings ?? []);
    const p = await fetch(`/api/providers/${subject.providerId}/provisions`);
    if (p.ok) setProvisions(await p.json());
  };

  useEffect(() => {

    const fetchUserData = async () => {
        const r = await fetch(`/api/user/${subject.id}/summary`);
        if (!r.ok) return;
        const j = await r.json();
        setApiKeys(j.apiKeys ?? []);
        setCredits(j.credits ?? 0);
        setRewards(j.rewards ?? 0);
      };
    
      const fetchProviderData = async () => {
        const r = await fetch(`/api/providers/${subject.providerId}/earnings`);
        if (r.ok) setEarnings((await r.json()).earnings ?? []);
        const p = await fetch(`/api/providers/${subject.providerId}/provisions`);
        if (p.ok) setProvisions(await p.json());
      };

    if (mode === "user") fetchUserData();
    if (mode === "provider") fetchProviderData();
  }, [mode, subject.id, subject.providerId]);

  /* ——————————————————— key CRUD ——————————————————— */
  const createKey = async (form: FormData) => {
    const creditLimit = Number(form.get("credits") ?? 0);
    const permittedRoutes = form.getAll("route") as string[];
    await fetch(`/api/user/${subject.id}/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creditLimit, permittedRoutes }),
    });
    fetchUserData();
  };

  const deleteKey = (k: string) =>
    setConfirm({
      msg: "Delete this API key?",
      onYes: async () => {
        await fetch(`/api/user/${subject.id}/keys/${k}`, { method: "DELETE" });
        fetchUserData();
      },
    });

  const refreshAk = (type: "user" | "provider") =>
    setConfirm({
      msg: `Refresh ${type}Ak? Existing calls with the old key will stop working.`,
      onYes: async () => {
        const url =
          type === "user"
            ? `/api/user/${subject.id}/userAk/refresh`
            : `/api/providers/${subject.providerId}/providerAk/refresh`;
        await fetch(url, { method: "POST" });
        if (type === "user") fetchUserData();
        else fetchProviderData();
      },
    });

  /* ——————————————————— render helpers ——————————————————— */
  const mask = (k: string) => k.slice(0, 4) + " … " + k.slice(-4);

  const KeyRow = ({
    k,
    onDelete,
  }: {
    k: ApiKey;
    onDelete?: () => void;
  }) => (
    <div className={styles.keyRow}>
      <span className={styles.masked}>{mask(k.key)}</span>
      <button
        className={styles.iconBtn}
        onClick={() => navigator.clipboard.writeText(k.key)}
        title="Copy key"
      >
        <Copy size={16} />
      </button>
      {onDelete && (
        <button className={styles.iconBtn} onClick={onDelete} title="Delete">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );

  /* ——————————————————— UI blocks ——————————————————— */
  const SelectorCard = (
    <div className={styles.contentCard}>
      <h2>Dashboards</h2>
      <p>Select a view:</p>
      <div className={styles.switchButtons}>
        <button
          className={styles.switchBtn}
          onClick={() => setMode("user")}
          disabled={mode === "user"}
        >
          User dashboard
        </button>
        <button
          className={styles.switchBtn}
          onClick={() => setMode("provider")}
          disabled={mode === "provider"}
        >
          Provider dashboard
        </button>
        <Link href="/trade">
          <button className={styles.switchBtn}>Trader dashboard</button>
        </Link>
      </div>

      <div className={styles.keysBlock}>
        <h3>
          <KeyRound size={18} /> Primary keys
        </h3>

        <KeyRow
          k={{ key: subject.userAk, creditLimit: 0, creditsLeft: 0, permittedRoutes: [] }}
        />
        <button
          className={styles.iconBtn}
          onClick={() => refreshAk("user")}
          title="Refresh userAk"
        >
          <RefreshCcw size={16} />
        </button>

        <KeyRow
          k={{
            key: subject.providerAk,
            creditLimit: 0,
            creditsLeft: 0,
            permittedRoutes: [],
          }}
        />
        <button
          className={styles.iconBtn}
          onClick={() => refreshAk("provider")}
          title="Refresh providerAk"
        >
          <RefreshCcw size={16} />
        </button>
      </div>
    </div>
  );

  const UserCards = (
    <>
      {/* Rewards */}
      <div className={styles.contentCard}>
        <h2>
          <Wallet size={20} /> Rewards
        </h2>
        <p>{rewards.toLocaleString()} CXPT earned</p>
      </div>

      {/* Credits */}
      <div className={styles.contentCard}>
        <h2>
          <BarChart3 size={20} /> Credits
        </h2>
        <p>{credits.toLocaleString()} remaining</p>
      </div>

      {/* Keys */}
      <div className={styles.contentCard}>
        <h2>
          <KeyRound size={20} /> API keys
        </h2>

        {apiKeys.map((k) => (
          <KeyRow key={k.key} k={k} onDelete={() => deleteKey(k.key)} />
        ))}

        {/* create-key form */}
        <details className={styles.createBox}>
          <summary>+ Create key</summary>
          <form
            action={async (formData) => {
              await createKey(formData);
            }}
            className={styles.createForm}
          >
            <label>
              Credit limit&nbsp;
              <input
                type="number"
                name="credits"
                min={1}
                defaultValue={1000}
                required
              />
            </label>

            <label>
              Allowed routes
              <select name="route" multiple size={4}>
                {ROUTES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" className={styles.switchBtn}>
              Create
            </button>
          </form>
        </details>
      </div>
    </>
  );

  const ProviderCards = (
    <>
      {/* Earnings */}
      <div className={styles.contentCard}>
        <h2>
          <Wallet size={20} /> Total earnings
        </h2>
        <p>{totalEarnings.toLocaleString()} CXPT</p>

        <svg width="100%" height="60" viewBox="0 0 120 60">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            points={earnings
              .map((e, i) => {
                const x = (i / Math.max(earnings.length - 1, 1)) * 120;
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
          <Server size={20} /> Provisions
        </h2>

        {provisions.map((p) => (
          <div key={p.provisionId} className={styles.provisionRow}>
            <span>{p.provisionId}</span>
            <em>{p.status}</em>
            <button
              className={styles.iconBtn}
              onClick={() =>
                setConfirm({
                  msg: "Delete this provision?",
                  onYes: async () => {
                    await fetch(
                      `/api/providers/${subject.providerId}/provisions/${p.provisionId}`,
                      { method: "DELETE" },
                    );
                    fetchProviderData();
                  },
                })
              }
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {provisions.length === 0 && <p>No active provisions.</p>}
      </div>
    </>
  );

  /* ——————————————————— JSX ——————————————————— */
  return (
    <div className={styles.container}>
      {/* original header + docs link */}
      <div className={styles.header}>
        <h1>Welcome to Cxmpute.cloud!</h1>
        <p>Read more about getting started:</p>
        <Link href="/docs">
          <Button text="Documentation" backgroundColor="var(--cxmpute-purple)" />
        </Link>
      </div>

      {/* selector card (first, outside grid) */}
      {SelectorCard}

      {/* grid cards */}
      <div className={styles.grid}>
        {mode === "user" && UserCards}
        {mode === "provider" && ProviderCards}

        {/* original “promo” cards always stay */}
        <div className={styles.contentCard}>
          <h2>Large-Language / Vision-Language Models</h2>
          <p>Explore open-source LLMs & VLMs available for inference.</p>
          <Link href="/models">
            <Button text="Explore" backgroundColor="var(--cxmpute-green)" />
          </Link>
        </div>
        <div className={styles.contentCard}>
          <h2>Generate Embeddings</h2>
          <p>Open-source embedding models for vector search & RAG.</p>
          <Link href="/models">
            <Button text="Explore" backgroundColor="var(--cxmpute-green)" />
          </Link>
        </div>
        <div className={styles.contentCard}>
          <h2>SOTA Text-to-Speech</h2>
          <p>High-fidelity TTS via Kokoro 82 M.</p>
          <Link href="/models/kokoro-82m">
            <Button text="Explore" backgroundColor="var(--cxmpute-green)" />
          </Link>
        </div>
        <div className={styles.contentCard}>
          <h2>Generate Images & Video</h2>
          <p>Text-to-image / video inference endpoints.</p>
          <Link href="/models">
            <Button text="Explore" backgroundColor="var(--cxmpute-green)" />
          </Link>
        </div>
        <div className={styles.contentCard}>
          <h2>Computer Vision APIs</h2>
          <p>OCR, caption, point & detect objects.</p>
          <Link href="/docs/computer-vision">
            <Button text="Explore" backgroundColor="var(--cxmpute-green)" />
          </Link>
        </div>
        <div className={styles.contentCard}>
          <h2>Web Scraping</h2>
          <p>Bypass rate-limits with our global node network.</p>
          <Link href="/docs/scraping">
            <Button text="Explore" backgroundColor="var(--cxmpute-green)" />
          </Link>
        </div>
      </div>

      {/* trivial modal confirm */}
      {confirm && (
        <div className={styles.backdrop}>
          <div className={styles.modal}>
            <p>{confirm.msg}</p>
            <div className={styles.modalBtns}>
              <button
                onClick={() => {
                  confirm.onYes();
                  setConfirm(null);
                }}
              >
                Yes
              </button>
              <button onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}