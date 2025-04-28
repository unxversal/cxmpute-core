/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { use, useState } from 'react';

import { models } from '@/lib/references';
import Button from '@/components/button/button';
import styles from './page.module.css';

const cxmputeGreen  = '#20a191';
const cxmputePurple = '#91a8eb';
// const cxmputePink   = '#fe91e8';
const cxmputeOrange = '#ff8c00';
// const cxmputeGray   = '#6b7280';

// Handy: change the host at build-/run-time → NEXT_PUBLIC_ORCH_BASE_URL
const BASE_URL = '';
const voiceOptions = [ 'af', 'af_bella', 'af_nicole', 'af_sarah', 'af_sky', 'am_adam', 'am_michael', 'bf_emma', 'bf_isabella', 'bm_george', 'bm_lewis']

export default function ModelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug }  = use(params);
  const model     = models.find((m) => m.slug === slug);

  if (!model) notFound();

  /* ────────── state for UI and "Playground" ────────── */
  const [activeTab, setActiveTab] = useState('docs'); // 'docs', 'description', 'playground'
  const [input,    setInput]   = useState('');
  const [imageUrl, setImage]   = useState('');
  const [voice,    setVoice]   = useState('af_bella');
  const [loading,  setLoading] = useState(false);
  const [response, setResp]    = useState<any>(null);
  const [blobUrl,  setBlobUrl] = useState<string | null>(null);

  /* choose endpoint + body template from the model category */
  const handleRun = async () => {
    setLoading(true);
    setResp(null);
    setBlobUrl(null);

    try {
      let endpoint = '';
      let body: any = { model: model.Name };     // default property

      switch (model.Category) {
        case 'embeddings':
          endpoint      = '/api/v1/embeddings';
          body.input    = input.includes('\n')
            ? input.split('\n').filter(Boolean)
            : input;
          break;

        case 'image':
          endpoint      = '/api/v1/image';
          body          = { prompt: input, width: 512, height: 512 };
          break;

        case 'video':
          endpoint      = '/api/v1/video';
          body          = { prompt: input, size: '832*480' };
          break;

        case 'audio':
          endpoint      = '/api/v1/tts';
          body          = { text: input, voice };
          break;

        case 'vision': // falls through to chat/completions but can send image-url, too
        case 'text':
        case 'code':
        case 'math':
        default:
          endpoint      = '/api/v1/chat/completions';
          body          = {
            model: model.Name,
            stream: false,
            messages: [
              { role: 'system', content: 'You are a helpful assistant.' },
              {
                role   : 'user',
                content: imageUrl
                  ? [
                      { type: 'text',      text: input },
                      { type: 'image_url', image_url: { url: imageUrl } },
                    ]
                  : input,
              },
            ],
          };
      }

      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method : 'POST',
        headers: {
          'Content-Type' : 'application/json',
          // ⭐️ DEV ONLY: fake creds so the call doesn't error out immediately
          'Authorization': 'Bearer debug-key',
          'X-User-Id'    : 'debug-playground',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${res.status} – ${errText}`);
      }

      // binary streams (image / audio / video) → blob URL
      if (['image', 'video', 'audio'].includes(model.Category)) {
        const blob   = await res.blob();
        const url    = URL.createObjectURL(blob);
        setBlobUrl(url);
        setResp(null);
      } else {
        const json   = await res.json();
        setResp(json);
      }
    } catch (e: any) {
      setResp({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────────────────────── render ─────────────────────────────── */
  return (
    <div className={styles.container}>
      {/* ───────────── HEADER ───────────── */}
      <header className={styles.mainheader}>
        <div className={styles.logo} onClick={() => (window.location.href = '/')}>
          <Image src="/images/1.png" alt="cxmpute logo" height={70} width={70} />
          <h1>CXMPUTE</h1>
        </div>

        <nav className={styles.menu}>
          <ul>
            <li>
              <Link href="/models">
                <Button text="ALL MODELS" backgroundColor={cxmputeOrange} />
              </Link>
            </li>
            <li>
              <a href="/docs" target="_blank">
                <Button text="DOCUMENTATION" backgroundColor={cxmputePurple} />
              </a>
            </li>
            <li>
              <a href="/dashboard" target="_blank">
                <Button text="DASHBOARD" backgroundColor= "var(--cxmpute-slate)" />
              </a>
            </li>
            <li>
              <a href="/download" target="_blank">
                <Button text="BECOME A PROVIDER" backgroundColor= "var(--cxmpute-yellow)" />
              </a>
            </li>
          </ul>
        </nav>
      </header>

      <div className={styles.grid}>
        {/* ───────────── MODEL CARD ───────────── */}
        <section className={styles.hero}>
          <h1 className={styles.title}>{model.Name}</h1>

          <div className={styles.meta}>
            <div className={styles.metaItem}><span>Category:</span> {model.Category}</div>
            <div className={styles.metaItem}>
              <span>Creator:</span>{' '}
              <a href={model.creatorUrl} target="_blank" rel="noopener noreferrer" className={styles.creatorLink}>
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
              <span key={`in-${idx}`} className={styles.inputTag}>{m}</span>
            ))}
            {model.OutputModalities.map((m, idx) => (
              <span key={`out-${idx}`} className={styles.outputTag}>{m}</span>
            ))}
          </div>
        </section>

        {/* ───────────── CONTENT CARD WITH TABS ───────────── */}
        <section className={styles.contentCard}>
          {/* Tab Navigation */}
          <div className={styles.tabBar}>
            <div onClick={() => setActiveTab('docs')}>
              <Button 
                text="DOCUMENTATION" 
                backgroundColor={activeTab === 'docs' ? cxmputeGreen : "var(--cxmpute-slate)"} 
              />
            </div>
            <div onClick={() => setActiveTab('description')}>
              <Button 
                text="DESCRIPTION" 
                backgroundColor={activeTab === 'description' ? cxmputeGreen :  "var(--cxmpute-slate)"}
              />
            </div>
            <div onClick={() => setActiveTab('playground')}>
              <Button 
                text="TRY IT" 
                backgroundColor={activeTab === 'playground' ? cxmputeGreen :  "var(--cxmpute-slate)"}
              />
            </div>
          </div>

          {/* Tab Content */}
          <div className={styles.tabContent}>
            {/* Documentation Tab */}
            {activeTab === 'docs' && (
              <div className={styles.markdown}>
                <ReactMarkdown>{model.docs}</ReactMarkdown>
              </div>
            )}

            {/* Description Tab */}
            {activeTab === 'description' && (
              <div className={styles.markdown}>
                <ReactMarkdown>{model.description}</ReactMarkdown>
                
                {model.blogUrl && (
                  <a href={model.blogUrl} target="_blank" rel="noopener noreferrer" className={styles.blogLink}>
                    Read the full blog&nbsp;post →
                  </a>
                )}
              </div>
            )}

            {/* Playground Tab */}
            {activeTab === 'playground' && (
              <div className={styles.playgroundContainer}>
                {/* input controls depend on the category */}
                {model.Category === 'embeddings' && (
                  <>
                    <textarea
                      className={styles.textarea}
                      placeholder="Enter one or more lines of text…"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                    <p className={styles.small}>Tip: multiple lines → multiple embeddings.</p>
                  </>
                )}

                {['text', 'code', 'math', 'vision'].includes(model.Category) && (
                  <>
                    <textarea
                      className={styles.textarea}
                      placeholder="Ask something…"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                    {model.Category === 'vision' && (
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="Optional image URL"
                        value={imageUrl}
                        onChange={(e) => setImage(e.target.value)}
                      />
                    )}
                  </>
                )}

                {model.Category === 'image' && (
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Enter prompt…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                )}

                {model.Category === 'video' && (
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Enter prompt…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                )}

                {model.Category === 'audio' && (
                  <>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="Enter text to speak…"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />

                    {/* voice selector */}
                    <select
                      className={styles.select}
                      value={voice}
                      onChange={(e) => setVoice(e.target.value)}
                    >
                      {voiceOptions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <div className={styles.runButtonContainer}>
                  <Button
                    text={loading ? 'Running…' : 'Run'}
                    backgroundColor={cxmputeGreen}
                    disabled={loading || !input.trim()}
                    onClick={handleRun}
                  />
                </div>

                {/* Results Section */}
                {(blobUrl !== null || response) && (
                  <div className={styles.resultsSection}>
                    {blobUrl !== null && (
                      <>
                        {['image', 'video'].includes(model.Category) && <h3>Generated Media</h3>}
                        {model.Category === 'audio' && <h3>Generated Audio</h3>}
                        {['image', 'video'].includes(model.Category) && (
                          <video
                            src={blobUrl}
                            controls
                            width={512}
                            className={styles.video}
                            onLoadedMetadata={() => {
                              const video = document.querySelector('video');
                              if (video) {
                                video.currentTime = 0;
                                video.play();
                              }
                            }}
                          />
                        )}
                      </>
                    )}

                    {blobUrl && model.Category === 'audio' && (
                      <audio src={blobUrl} controls className={styles.audio} />
                    )}

                    {response && (
                      <pre className={styles.pre}>{JSON.stringify(response, null, 2)}</pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
