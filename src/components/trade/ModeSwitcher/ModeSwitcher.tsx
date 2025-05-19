// src/components/trade/ModeSwitcher/ModeSwitcher.tsx
"use client";

import React, { useState } from 'react';
import styles from './ModeSwitcher.module.css';
import { useTradingMode } from '@/contexts/TradingModeContext';
import type { TradingMode } from '@/lib/interfaces';
import Tooltip from '@/components/ui/Tooltip/Tooltip';
import Modal from '@/components/ui/Modal/Modal'; // Import your Modal component
import Button from '@/components/ui/Button/Button'; // Import your UI Button

const ModeSwitcher: React.FC = () => {
  const { currentMode, setCurrentMode } = useTradingMode();
  const [showRealModeConfirm, setShowRealModeConfirm] = useState(false);
  const [pendingMode, setPendingMode] = useState<TradingMode | null>(null);

  const handleChangeRequest = (newMode: TradingMode) => {
    if (newMode === currentMode) return;

    if (newMode === 'REAL' && currentMode === 'PAPER') {
      setPendingMode(newMode);
      setShowRealModeConfirm(true);
    } else {
      setCurrentMode(newMode);
    }
  };

  const confirmModeSwitch = () => {
    if (pendingMode) {
      setCurrentMode(pendingMode);
    }
    setShowRealModeConfirm(false);
    setPendingMode(null);
  };

  const cancelModeSwitch = () => {
    setShowRealModeConfirm(false);
    setPendingMode(null);
  };

  return (
    <>
      <div className={styles.modeSwitcherContainer}>
        <Tooltip
          content={currentMode === 'PAPER' ? "Switch to REAL trading (live funds)" : "Currently in REAL trading"}
          position="bottom"
        >
          <button
            onClick={() => handleChangeRequest('REAL')}
            className={`${styles.modeButton} ${currentMode === 'REAL' ? styles.active : ''} ${styles.realMode}`}
            aria-pressed={currentMode === 'REAL'}
            disabled={currentMode === 'REAL'} // Visually disable if already active
          >
            REAL
          </button>
        </Tooltip>
        <Tooltip
          content={currentMode === 'REAL' ? "Switch to PAPER trading (simulated funds)" : "Currently in PAPER trading"}
          position="bottom"
        >
          <button
            onClick={() => handleChangeRequest('PAPER')}
            className={`${styles.modeButton} ${currentMode === 'PAPER' ? styles.active : ''} ${styles.paperMode}`}
            aria-pressed={currentMode === 'PAPER'}
            disabled={currentMode === 'PAPER'} // Visually disable if already active
          >
            PAPER
          </button>
        </Tooltip>
      </div>

      {/* Confirmation Modal for switching to REAL mode */}
      <Modal
        isOpen={showRealModeConfirm}
        onClose={cancelModeSwitch}
        title="Confirm Switch to REAL Mode"
        size="sm"
      >
        <div className={styles.confirmModalBody}>
          <p>You are about to switch to **REAL** trading mode.</p>
          <p>All trades and actions in this mode will involve actual funds and market conditions.</p>
          <p>Are you sure you want to proceed?</p>
        </div>
        <div className={styles.confirmModalFooter}>
          <Button variant="secondary" onClick={cancelModeSwitch} size="md">
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmModeSwitch} size="md">
            Switch to REAL
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default ModeSwitcher;