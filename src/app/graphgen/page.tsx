/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Chart as ChartJS, ArcElement, BarElement, PointElement, LineElement, CategoryScale, LinearScale, Tooltip, Legend, Title } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { set, del, keys, get } from 'idb-keyval';

import Button from '@/components/button/button';
import styles from './graphgen.module.css';

ChartJS.register(ArcElement, BarElement, PointElement, LineElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

/* voice & brand colors from the other pages */
const cxmputeGreen  = '#20a191';
const cxmputePurple = '#91a8eb';

type SavedGraph = { id: string; name: string; config: any };

export default function GraphGenPage() {
  /* ----- state ----- */
  const [prompt, setPrompt]           = useState('');
  const [chartConfig, setChartConfig] = useState<any | null>(null);
  const [loading, setLoading]         = useState(false);

  /** all saved graphs (IndexedDB) */
  const [graphs, setGraphs]           = useState<SavedGraph[]>([]);
  const [keepHistory, setKeepHistory] = useState(true);
  const [history, setHistory]         = useState<string[]>([]);

  const searchParams                   = useSearchParams();
  const router                         = useRouter();
  const urlGraphId                     = searchParams.get('g');   /* may be null */

  /* ---------- IndexedDB helpers ---------- */
  const refreshGraphs = useCallback(async () => {
    const allKeys   = await keys();
    const graphKeys = allKeys.filter((k) => typeof k === 'string' && (k as string).startsWith('graph:')) as string[];
    const result: SavedGraph[] = [];
    for (const k of graphKeys) {
      const g = await get(k);
      if (g) result.push(g as SavedGraph);
    }
    setGraphs(result);
  }, []);

  /* load graph listed in query-param */
  useEffect(() => {
    (async () => {
      if (!urlGraphId) return;
      const localKey  = `graph:${urlGraphId}`;
      const localCopy = await get(localKey);
      if (localCopy) {
        setChartConfig(localCopy.config);
        return;
      }
      /* fetch from backend -> saves in IndexedDB too */
      try {
        const res = await fetch(`/api/graphgen?key=${urlGraphId}`);
        if (!res.ok) throw new Error('failed to fetch graph');
        const { config } = await res.json();
        setChartConfig(config);
        const saved: SavedGraph = {
          id: urlGraphId,
          name: config?.options?.plugins?.title?.text ?? urlGraphId,
          config
        };
        await set(localKey, saved);
        refreshGraphs();
      } catch {
        /* ignore */
      }
    })();
  }, [urlGraphId, refreshGraphs]);

  /* first mount -> read IndexedDB */
  useEffect(() => {
    refreshGraphs();
  }, [refreshGraphs]);

  /* ---------- generate handler ---------- */
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const body: any = { prompt };
      if (keepHistory && history.length) body.history = history;

      const res = await fetch('/api/graphgen', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());

      const { id, config } = await res.json();

      /* update browser url */
      const next = new URL(window.location.href);
      next.searchParams.set('g', id);
      router.push(next.toString());

      setChartConfig(config);
      /* update IndexedDB */
      const saved: SavedGraph = {
        id,
        name: config?.options?.plugins?.title?.text ?? id,
        config
      };
      await set(`graph:${id}`, saved);
      refreshGraphs();

      /* update history */
      if (keepHistory) setHistory((h) => [...h, prompt]);
      else setHistory([prompt]);
      setPrompt('');
    } catch (err: any) {
      alert(err.message ?? 'Error generating graph');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- delete/clear helpers ---------- */
  const deleteGraph = async (id: string) => {
    await del(`graph:${id}`);
    refreshGraphs();
    if (id === urlGraphId) {
      router.push('/graphgen');       /* clear query param */
      setChartConfig(null);
    }
  };

  const clearAll = async () => {
    for (const g of graphs) await del(`graph:${g.id}`);
    setGraphs([]);
    router.push('/graphgen');
    setChartConfig(null);
  };

  /* ---------- memo for chart ---------- */
  const chartEl = useMemo(() => {
    if (!chartConfig) return null;
    return <Chart type={chartConfig.type || 'bar'} data={chartConfig.data} options={chartConfig.options || { responsive: true }} />;
  }, [chartConfig]);

  /* ---------- JSX ---------- */
  return (
    <div className={styles.container}>
      {/* ===== Header (reuse look) ===== */}
      <header className={styles.mainheader}>
        <div className={styles.logo} onClick={() => (window.location.href = '/')}>
          <Image src="/images/1.png" alt="cxmpute logo" height={70} width={70} />
          <h1>CXMPUTE</h1>
        </div>

        <nav className={styles.menu}>
          <ul>
            <li><Link href="/models"><Button text="ALL MODELS" backgroundColor={cxmputeGreen} /></Link></li>
            <li><a href="/docs" target="_blank"><Button text="DOCUMENTATION" backgroundColor={cxmputePurple} /></a></li>
            <li><Link href="/graphgen"><Button text="GRAPH GEN" backgroundColor={cxmputeGreen} /></Link></li>
          </ul>
        </nav>
      </header>

      {/* ===== Graph generator ===== */}
      <section className={styles.content}>
        <div className={styles.leftPane}>
          <h2>Describe the chart you want</h2>
          <textarea
            className={styles.textarea}
            placeholder="ex: Show a bar chart comparing quarterly revenue of Apple, Google and Amazon for 2023."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={keepHistory}
              onChange={() => setKeepHistory(!keepHistory)}
            />
            Keep chat history
          </label>

          <Button
            text={loading ? 'Generating…' : 'Generate'}
            backgroundColor={cxmputeGreen}
            disabled={loading || !prompt.trim()}
            onClick={handleGenerate}
          />

          {chartEl && (
            <div className={styles.chartWrapper}>
              {chartEl}
            </div>
          )}
        </div>

        {/* ===== Saved graphs list ===== */}
        <aside className={styles.rightPane}>
          <div className={styles.listHeader}>
            <h3>My graphs</h3>
            {graphs.length > 0 && (
              <button className={styles.clearBtn} onClick={clearAll}>
                clear all
              </button>
            )}
          </div>

          {graphs.length === 0 && <p className={styles.empty}>No saved graphs yet.</p>}

          {graphs.map((g) => (
            <div key={g.id} className={styles.graphItem}>
              <span
                className={styles.graphLink}
                onClick={() => router.push(`/graphgen?g=${g.id}`)}
              >
                {g.name}
              </span>
              <button className={styles.deleteBtn} onClick={() => deleteGraph(g.id)}>✕</button>
            </div>
          ))}
        </aside>
      </section>
    </div>
  );
}