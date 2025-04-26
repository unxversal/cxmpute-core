'use client';

import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { models } from '@/lib/references';
import Button from '@/components/button/button';
import styles from './page.module.css';
import { use } from 'react';

const cxmputeGreen  = '#20a191';
const cxmputePurple = '#91a8eb';
const cxmputePink   = '#fe91e8';

export default function ModelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const model = models.find((m) => m.slug === slug);

  if (!model) notFound();

  return (
    <div className={styles.container}>
      {/* ───────────── HEADER ───────────── */}
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
              <Link href="/models">
                <Button text="ALL MODELS" backgroundColor={cxmputeGreen} />
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
                <Button text="DASHBOARD" backgroundColor={cxmputeGreen} />
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

      {/* ───────────── HERO ───────────── */}
      <section className={styles.hero}>
        <h1 className={styles.title}>{model.Name}</h1>
        <div className={styles.meta}>
          <div className={styles.metaItem}>
            <span>Category:</span> {model.Category}
          </div>

          <div className={styles.metaItem}>
            <span>Creator:</span>{' '}
            <a
              href={model.creatorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.creatorLink}
            >
              {model.Creator}
            </a>
          </div>

          {model.contextSize && (
            <div className={styles.metaItem}>
              <span>Context size:</span> {model.contextSize}
            </div>
          )}

          {model.vectorSize && (
            <div className={styles.metaItem}>
              <span>Vector dim:</span> {model.vectorSize}
            </div>
          )}

          {model.outputLength && !model.vectorSize && (
            <div className={styles.metaItem}>
              <span>Output length:</span> {model.outputLength}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className={styles.tags}>
          <span className={styles.categoryTag}>{model.Category}</span>

          {model.InputModalities.map((m, idx) => (
            <span key={`in-${idx}`} className={styles.inputTag}>
              {m}
            </span>
          ))}

          {model.OutputModalities.map((m, idx) => (
            <span key={`out-${idx}`} className={styles.outputTag}>
              {m}
            </span>
          ))}
        </div>
        
      </section>

      {/* ───────────── DETAILS ───────────── */}
      <section className={styles.details}>
        <p className={styles.description}>{model.description}</p>

        {model.blogUrl && (
        <a
            href={model.blogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.blogLink}
        >
            Read the full blog&nbsp;post →
        </a>
        )}
      </section>
    </div>
  );
}
