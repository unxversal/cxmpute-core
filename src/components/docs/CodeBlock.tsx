"use client"

import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import styles from './CodeBlock.module.css';

interface CodeBlockProps {
  language: string;
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Detect theme from parent element
  useEffect(() => {
    const detectTheme = () => {
      const docsLayout = document.querySelector('[class*="docsLayout"]');
      if (docsLayout) {
        const isDarkTheme = docsLayout.classList.contains('dark') || 
                          docsLayout.className.includes('dark');
        setIsDark(isDarkTheme);
      }
    };

    detectTheme();
    
    // Watch for theme changes
    const observer = new MutationObserver(detectTheme);
    const docsLayout = document.querySelector('[class*="docsLayout"]');
    
    if (docsLayout) {
      observer.observe(docsLayout, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    return () => observer.disconnect();
  }, []);

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

  // Custom style based on theme
  const getCustomStyle = () => {
    const baseStyle = isDark ? oneDark : oneLight;
    
    return {
      ...baseStyle,
      'pre[class*="language-"]': {
        ...baseStyle['pre[class*="language-"]'],
        background: 'transparent',
        border: '0',
        borderRadius: '0',
        padding: '0',
        margin: '0',
        overflow: 'auto',
      },
      'code[class*="language-"]': {
        ...baseStyle['code[class*="language-"]'],
        background: 'transparent',
        fontSize: '0.875rem',
        lineHeight: '1.5',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace",
      }
    };
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
          style={getCustomStyle()}
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