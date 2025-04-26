'use client';

import { useState } from 'react';
import { models } from '@/lib/references';
import styles from './models.module.css';
import { Search, Info } from 'lucide-react';
import Image from 'next/image';
import Button from '@/components/button/button';

const cxmputeGreen = '#20a191';
const cxmputePurple = '#91a8eb';
const cxmputePink = "#fe91e8";
const cxmputeRed = "#d64989";
const cxmputeOrange = "#f76707";
const cxmputeYellow = "#f8cb46";

export default function ModelsPage() {
  // text search
  const [filterText, setFilterText] = useState('');

  // new category selector  ────────────────┐
  const [category, setCategory] = useState<'all' | 'embeddings' | 'text' | 'vision' | 'code' | 'video' | 'audio'>('all');
  //                                          └───────────────────────────────────────┘

  // combined filter
  const filteredModels = models.filter((model) => {
    const matchesText =
      model.Name.toLowerCase().includes(filterText.toLowerCase()) ||
      model.description.toLowerCase().includes(filterText.toLowerCase()) ||
      model.Category.toLowerCase().includes(filterText.toLowerCase());

    const matchesCategory =
      category === 'all' || model.Category.toLowerCase() === category;

    return matchesText && matchesCategory;
  });


  return (
    <div className={styles.container}>
      {/* ─────────────────────────── NAV / HERO ─────────────────────────── */}
      <header className={styles.mainheader}>
        <div className={styles.logo} onClick={() => (window.location.href = '/')}>
          <Image src="/images/1.png" alt="cxmpute logo" height={70} width={70} />
          <h1>CXMPUTE</h1>
        </div>

        <div className={styles.menu}>
          <ul>
            
            <li>
              <a href="/docs" target="_blank">
                <Button text="DOCUMENTATION" backgroundColor={cxmputePurple} />
              </a>
            </li>
            <li>
              <a href="/dashboard" target="_blank">
                <Button text=" DASHBOARD" backgroundColor={cxmputeGreen} />
              </a>
            </li>
            <li>
              <a href="/download" target="_blank">
                <Button text="BECOME A PROVIDER" backgroundColor={cxmputePink} />
              </a>
            </li>
          </ul>
        </div>
      </header>

      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>Your multi-model, multi-modal inference platform.</h1>
          <p className={styles.heroDescription}>
            All your AI models in one API—LLM, TTS, image gen, instantly.
          </p>
        </div>
      </div>

      {/* ─────────────────────────── MAIN CONTENT ─────────────────────────── */}
      <div className={styles.content}>

        {/* search / sort / category / view toggles */}
        <div className={styles.filterBar}>
          {/* search box */}
          <div className={styles.searchContainer}>
            <Search className={styles.searchIcon} size={16} />
            <input
              type="text"
              placeholder="Filter models"
              className={styles.searchInput}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>

          {/* new category buttons */}
          <div className={styles.categoryFilter}>
            {(['all', 'embeddings', 'text', 'vision', 'code', 'video', 'audio'] as const).map((c) => (
              <div
                key={c}
                className={`${styles.categoryButton} ${
                  category === c ? styles.activeCategory : ''
                }`}
                onClick={() => setCategory(c)}
              >
                <Button text={
                    c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)} 
                    backgroundColor={c === 'all' ? cxmputeGreen 
                        : c === 'embeddings' ? cxmputeOrange 
                        : c === 'text' ? cxmputePurple 
                        : c === 'vision' ? cxmputeYellow 
                        : c === 'code' ? cxmputeRed
                        : c === 'video' ? cxmputePurple
                        : c === 'audio' ? cxmputeOrange
                        : cxmputeRed}
                />
              </div>
            ))}
          </div>

        </div>

        {/* model cards */}
        <div
          className={ styles.modelsGrid }
        >
          {filteredModels.map((model, index) => (
            <div key={index} className={styles.modelCard} >
              {/* header */}
              <div className={styles.modelHeader}>
                <div className={styles.modelNameContainer}>
                  <a href={`/models/${model.slug}`} className={styles.modelLink}>
                    <h3 className={styles.modelName}>{model.Name}</h3>
                  </a>
                  {model.blogUrl && (
                    <a
                      href={model.blogUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.infoButton}
                    >
                      <Info size={16}/>
                    </a>
                  )}
                </div>

                <div className={styles.modelMeta}>
                  {model.vectorSize && (
                    <span className={styles.tokenCount}>
                      {model.vectorSize} dimensions
                    </span>
                  )}
                  {!model.vectorSize && model.outputLength && (
                    <span className={styles.tokenCount}>
                      {model.outputLength}
                    </span>
                  )}
                </div>
              </div>

              {/* description */}
              <p className={styles.modelDescription}>{model.description}</p>

              {/* tags */}
              <div className={styles.tags}>
                {model.Category && (
                  <span className={styles.categoryTag}>{model.Category}</span>
                )}
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

              {/* footer */}
              <div className={styles.modelFooter}>
                <div className={styles.creatorInfo}>
                  by{' '}
                  <a href={model.creatorUrl} target="_blank" className={styles.creatorLink}>
                    {model.Creator}
                  </a>
                </div>
                <div className={styles.modelStats}>
                  {model.contextSize && (
                    <span className={styles.contextSize}>
                      {model.contextSize} context
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
