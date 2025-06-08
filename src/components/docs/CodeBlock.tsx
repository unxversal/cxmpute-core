"use client"

import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import styles from './CodeBlock.module.css';

interface CodeBlockProps {
  language: string;
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getLanguageLabel = (lang: string) => {
    const labels: { [key: string]: string } = {
      'js': 'JavaScript',
      'javascript': 'JavaScript',
      'ts': 'TypeScript',
      'typescript': 'TypeScript',
      'python': 'Python',
      'py': 'Python',
      'bash': 'Shell',
      'sh': 'Shell',
      'shell': 'Shell',
      'json': 'JSON',
      'yaml': 'YAML',
      'yml': 'YAML',
      'sql': 'SQL',
      'css': 'CSS',
      'html': 'HTML',
      'jsx': 'React',
      'tsx': 'React TypeScript',
      'curl': 'cURL',
      'http': 'HTTP',
    };
    return labels[lang.toLowerCase()] || lang.toUpperCase();
  };

  // Custom style based on oneDark but adjusted for our theme
  const customOneDark = {
    ...oneDark,
    'pre[class*="language-"]': {
      ...oneDark['pre[class*="language-"]'],
      background: '#1a1f2e',
      border: '1px solid #2d3748',
      borderRadius: '0.5rem',
      padding: '0',
      margin: '0',
      overflow: 'auto',
    },
    'code[class*="language-"]': {
      ...oneDark['code[class*="language-"]'],
      background: 'transparent',
      fontSize: '0.875rem',
      lineHeight: '1.5',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace",
    }
  };

  return (
    <div className={styles.codeBlockContainer}>
      <div className={styles.codeBlockHeader}>
        <span className={styles.languageLabel}>{getLanguageLabel(language)}</span>
        <button
          onClick={handleCopy}
          className={styles.copyButton}
          title={copied ? 'Copied!' : 'Copy to clipboard'}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      <div className={styles.codeBlockWrapper}>
        <SyntaxHighlighter
          language={language}
          style={customOneDark}
          customStyle={{
            padding: '1rem',
            margin: '0',
            background: 'transparent',
            border: '0',
          }}
          codeTagProps={{
            style: {
              fontSize: '0.875rem',
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace",
            }
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}; 