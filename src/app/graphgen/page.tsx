/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  PointElement,
  LineElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { set, del, keys, get } from 'idb-keyval';
import type {
    ScriptableContext,
    TooltipItem,
  } from 'chart.js';
import Button from '@/components/button/button';
import styles from './graphgen.module.css';

ChartJS.register(
  ArcElement,
  BarElement,
  PointElement,
  LineElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
);

/* ---------- brand palette ---------- */
const cxmputeGreen  = '#20a191';
const cxmputePurple = '#91a8eb';
const cxmputePink   = '#fe91e8';
const cxmputeOrange = '#ff8c00';

/* ---------- sample chart (UI demo) ---------- */
const sampleConfig = {
  type: 'bar',

  data: {
    labels: ['Q1-23', 'Q2-23', 'Q3-23', 'Q4-23'],

    datasets: [
      /* ── Product Alpha ── */
      {
        label: 'Product Alpha ($M)',
        data: [12, 17, 14, 19],
        backgroundColor: (ctx: ScriptableContext<'bar'>) => {
          const { chart } = ctx;                   // Chart<'bar'>
          const { ctx: c, chartArea } = chart;     // Canvas ctx & area
          if (!chartArea) return 'rgba(32,161,145,.6)';
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, 'rgba(32,161,145,.85)');
          g.addColorStop(1, 'rgba(32,161,145,.35)');
          return g;
        },
        borderRadius: 8,
        barPercentage: 0.55,
        categoryPercentage: 0.5,
      },

      /* ── Product Beta ── */
      {
        label: 'Product Beta ($M)',
        data: [8, 11, 10, 15],
        backgroundColor: (ctx: ScriptableContext<'bar'>) => {
          const { chart } = ctx;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return 'rgba(145,168,235,.6)';
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, 'rgba(145,168,235,.85)');
          g.addColorStop(1, 'rgba(145,168,235,.35)');
          return g;
        },
        borderRadius: 8,
        barPercentage: 0.55,
        categoryPercentage: 0.5,
      },

      /* ── YoY growth line ── */
      {
        type : 'line',
        label: 'YoY growth (%)',
        data : [15, 22, 18, 24],
        yAxisID: 'yGrowth',
        borderColor: '#fe91e8',
        backgroundColor: '#fe91e8',
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBorderWidth: 2,
        fill: false,
        order: 3,
      },
    ],
  },

  options: {
    responsive: true,
    interaction: { mode: 'index', intersect: false },

    plugins: {
      legend: {
        position: 'top',
        labels: { usePointStyle: true, padding: 20 },
      },
      title: {
        display: true,
        text: 'Quarterly revenue & growth rate — 2023',
        font: { size: 18, weight: 'bold' },
        padding: { bottom: 4 },
      },
      subtitle: {
        display: true,
        text: 'Grouped bars with YoY growth line',
        font: { size: 13, style: 'italic' },
        color: '#374151',
        padding: { bottom: 16 },
      },
      tooltip: {
        callbacks: {
          label: (ti: TooltipItem<'bar' | 'line'>) => {
            if (ti.dataset.type === 'line') return `Growth ${ti.parsed.y}%`;
            return `${ti.dataset.label}: $${ti.parsed.y} M`;
          },
        },
      },
    },

    scales: {
      y: {
        stacked: false,
        grid: { color: '#e5e7eb' },
        title: { display: true, text: 'Revenue ($M)' },
      },
      yGrowth: {
        position: 'right',
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Growth (%)' },
        ticks: {
          callback: (v: string | number) => `${v}%`,
        },
      },
      x: {
        grid: { display: false },
      },
    },
  },
};

  

type SavedGraph = { id: string; name: string; config: any };

export default function GraphGenPage() {
  /* ---------- state ---------- */
  const [prompt, setPrompt]           = useState('');
  const [chartConfig, setChartConfig] = useState<any | null>(null);
  const [loading, setLoading]         = useState(false);

  const [graphs, setGraphs]           = useState<SavedGraph[]>([]);
  const [keepHistory, setKeepHistory] = useState(false);
  const [history, setHistory]         = useState<string[]>([]);

  const searchParams = useSearchParams();
  const router       = useRouter();
  const urlGraphId   = searchParams.get('g');     // ?g=<uuid> if present

  /* ---------- IndexedDB helpers ---------- */
  const refreshGraphs = useCallback(async () => {
    const allKeys   = await keys();
    const graphKeys = allKeys.filter(
      (k) => typeof k === 'string' && (k as string).startsWith('graph:'),
    ) as string[];

    const result: SavedGraph[] = [];
    for (const k of graphKeys) {
      const g = await get(k);
      if (g) result.push(g as SavedGraph);
    }
    setGraphs(result);
  }, []);

  /* ---------- load graph from URL ---------- */
  useEffect(() => {
    (async () => {
      if (!urlGraphId) return;
      const localKey  = `graph:${urlGraphId}`;
      const localCopy = await get(localKey);
      if (localCopy) {
        setChartConfig(localCopy.config);
        return;
      }

      // no backend yet – silently ignore
    })();
  }, [urlGraphId]);

  /* ---------- first mount ---------- */
  useEffect(() => {
    refreshGraphs();

    // preload a sample chart once
    if (!urlGraphId) setChartConfig(sampleConfig);
  }, [refreshGraphs, urlGraphId]);

  /* ---------- generate handler (still posts to backend) ---------- */
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);

    try {
      /*  ----- call backend -----  */
      const body: any = { prompt };
      if (keepHistory && history.length) body.history = history;

      const res = await fetch('/api/graphgen', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());

      const { id, config } = await res.json();

      /*  ----- update UI / storage -----  */
      router.push(`/graphgen?g=${id}`);
      setChartConfig(config);

      const saved: SavedGraph = {
        id,
        name: config?.options?.plugins?.title?.text ?? id,
        config,
      };
      await set(`graph:${id}`, saved);
      refreshGraphs();

      if (keepHistory) setHistory((h) => [...h, prompt]);
      else setHistory([prompt]);
      setPrompt('');
    } catch (err: any) {
      alert(err.message ?? 'Error generating graph');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- local helpers ---------- */
  const deleteGraph = async (id: string) => {
    await del(`graph:${id}`);
    refreshGraphs();
    if (id === urlGraphId) {
      router.push('/graphgen');
      setChartConfig(sampleConfig);      // revert to sample
    }
  };

  const clearAll = async () => {
    for (const g of graphs) await del(`graph:${g.id}`);
    setGraphs([]);
    router.push('/graphgen');
    setChartConfig(sampleConfig);
  };

  const chartEl = useMemo(() => {
    if (!chartConfig) return null;
    return (
      <Chart
        type={chartConfig.type || 'bar'}
        data={chartConfig.data}
        options={chartConfig.options || { responsive: true }}
      />
    );
  }, [chartConfig]);

  /* ---------- JSX ---------- */
  return (
    <div className={styles.container}>
      {/* ===== Header ===== */}
      <header className={styles.mainheader}>
        <div
          className={styles.logo}
          onClick={() => (window.location.href = '/')}
        >
          <Image
            src="/images/1.png"
            alt="cxmpute logo"
            height={70}
            width={70}
          />
          <h1>CXMPUTE</h1>
        </div>

        <nav className={styles.menu}>
          <ul>
            <li>
              <Link href="/">
                <Button
                  text="LEARN MORE ABOUT CXMPUTE"
                  backgroundColor={cxmputeOrange}
                />
              </Link>
            </li>
            <li>
              <a href="/docs" target="_blank">
                <Button
                  text="DOCUMENTATION"
                  backgroundColor={cxmputePurple}
                />
              </a>
            </li>
            <li>
              <a href="/dashboard" target="_blank">
                <Button
                  text="DASHBOARD"
                  backgroundColor={cxmputeGreen}
                />
              </a>
            </li>
            <li>
              <a href="/download" target="_blank">
                <Button
                  text="BECOME A PROVIDER"
                  backgroundColor={cxmputePink}
                />
              </a>
            </li>
          </ul>
        </nav>
      </header>

      {/* ===== 3-card layout ===== */}
      <section className={styles.layout}>
        {/* --- Left column (graph + prompt) --- */}
        <div className={styles.leftColumn}>
          {/* graph card */}
          <div className={styles.graphCard}>
            {chartEl ?? (
              <p className={styles.placeholder}>
                Your chart will appear here.
              </p>
            )}
          </div>

          {/* prompt card */}
          <div className={styles.inputCard}>
            
            <textarea
              className={styles.textarea}
              placeholder="ex: Show a bar chart comparing this data:..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            <div className={styles.inputCardFooter}>
                {/* <h2>Describe the chart you want</h2> */}
                <label className={styles.toggle}>
                <input
                    type="checkbox"
                    checked={keepHistory}
                    onChange={() => setKeepHistory(!keepHistory)}
                />
                Remember my last prompt
                </label>

                <Button
                text={loading ? 'Generating…' : 'Generate'}
                backgroundColor={cxmputeGreen}
                disabled={loading || !prompt.trim()}
                onClick={handleGenerate}
                />
            </div>
          </div>
        </div>

        {/* --- Right column (saved list) --- */}
        <aside className={styles.rightPane}>
          <div className={styles.listHeader}>
            <h3>My graphs</h3>
            {graphs.length > 0 && (
              <button className={styles.clearBtn} onClick={clearAll}>
                clear all
              </button>
            )}
          </div>

          {graphs.length === 0 && (
            <p className={styles.empty}>No saved graphs yet.</p>
          )}

          {graphs.map((g) => (
            <div key={g.id} className={styles.graphItem}>
              <span
                className={styles.graphLink}
                onClick={() => router.push(`/graphgen?g=${g.id}`)}
              >
                {g.name}
              </span>
              <button
                className={styles.deleteBtn}
                onClick={() => deleteGraph(g.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </aside>
      </section>
    </div>
  );
}