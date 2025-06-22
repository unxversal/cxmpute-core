'use client';

import React from 'react';
import styles from '../page.module.css';

interface ErrorDisplayProps {
  error: string;
  onClose: () => void;
}

export default function ErrorDisplay({ error, onClose }: ErrorDisplayProps) {
  return (
    <div className={styles.errorOverlay}>
      <div className={styles.errorContent}>
        <div className={styles.errorHeader}>
          <h4 className={styles.errorTitle}>Execution Error</h4>
          <button 
            className={styles.errorCloseButton}
            onClick={onClose}
            title="Close error"
          >
            ✕
          </button>
        </div>
        <div className={styles.errorMessage}>
          {error}
        </div>
      </div>
    </div>
  );
} 