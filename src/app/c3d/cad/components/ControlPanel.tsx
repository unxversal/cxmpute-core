'use client';

import { useState } from 'react';
import styles from '../page.module.css';

interface ControlPanelProps {
  onExport: (format: 'stl' | 'step') => void;
  canExport: boolean;
}

export function ControlPanel({ onExport, canExport }: ControlPanelProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'stl' | 'step') => {
    if (!canExport || isExporting) return;
    
    setIsExporting(true);
    try {
      await onExport(format);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={styles.controlPanel}>
      <button
        className={styles.button}
        onClick={() => handleExport('stl')}
        disabled={!canExport || isExporting}
        title="Export as STL"
      >
        {isExporting ? 'Exporting...' : 'Export STL'}
      </button>
      
      <button
        className={styles.button}
        onClick={() => handleExport('step')}
        disabled={!canExport || isExporting}
        title="Export as STEP"
      >
        {isExporting ? 'Exporting...' : 'Export STEP'}
      </button>

      <button
        className={`${styles.button} ${styles.primary}`}
        onClick={() => window.open('/c3d/cad', '_blank')}
        title="Open in new window"
      >
        New Window
      </button>
    </div>
  );
} 