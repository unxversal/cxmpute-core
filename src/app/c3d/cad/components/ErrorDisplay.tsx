'use client';

import styles from '../page.module.css';

interface ErrorDisplayProps {
  error: string;
  onDismiss: () => void;
}

export function ErrorDisplay({ error, onDismiss }: ErrorDisplayProps) {
  return (
    <div className={styles.errorDisplay}>
      <div className={styles.errorHeader}>
        <h4 className={styles.errorTitle}>Error</h4>
        <button 
          className={styles.errorClose}
          onClick={onDismiss}
          title="Dismiss error"
        >
          ×
        </button>
      </div>
      <pre className={styles.errorMessage}>{error}</pre>
    </div>
  );
} 