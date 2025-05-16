// src/components/trade/SynthExchangeModal/SynthExchangeModal.tsx
"use client";

import React, { useState, useEffect, ChangeEvent, FormEvent, useMemo } from 'react';
import styles from './SynthExchangeModal.module.css';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import { useAccountContext } from '@/contexts/AccountContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import { ArrowRightLeft } from 'lucide-react'; // Removed ChevronDown
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
import { USDC_ASSET_INFO, SUPPORTED_SYNTH_ASSETS } from '@/lib/references';

// Helper to format balance numbers (copied from BalancesInfo or a util file)
const formatBalanceDisplay = (balanceValue: number | string | undefined, decimals: number = 6): string => {
    if (balanceValue === undefined || balanceValue === null) return '-.--';
    try {
        const num = typeof balanceValue === 'string' ? parseFloat(balanceValue) : balanceValue;
        if (isNaN(num)) return '-.--';
        
        const val = num / (10 ** decimals); // Assumes balanceValue is in base units

        if (val === 0) return "0.00";
        if (Math.abs(val) < 0.000001 && val !== 0) return val.toExponential(2);
        // Show more precision for values less than 1, up to asset's decimals, capped at a reasonable number like 6 for display
        if (Math.abs(val) < 1) return val.toFixed(Math.min(decimals, 6)); 
        return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
        console.error("Error formatting balance:", e, "Value:", balanceValue);
        return "Error";
    }
};


interface SynthExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFromAsset?: string;
  initialToAsset?: string;
}

const SynthExchangeModal: React.FC<SynthExchangeModalProps> = ({
  isOpen,
  onClose,
  initialFromAsset,
  initialToAsset,
}) => {
  const { refreshBalances, getBalanceByAsset } = useAccountContext(); // Removed unused 'balances'
  const { currentMode } = useTradingMode();

  const [fromAsset, setFromAsset] = useState<string>(initialFromAsset || "USDC");
  const [toAsset, setToAsset] = useState<string>(initialToAsset || SUPPORTED_SYNTH_ASSETS[0]?.symbol || "");
  const [fromAmount, setFromAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fromAssetInfo = useMemo(() => {
    if (fromAsset === "USDC") return USDC_ASSET_INFO;
    return SUPPORTED_SYNTH_ASSETS.find(s => s.symbol === fromAsset);
  }, [fromAsset]);

  const toAssetInfo = useMemo(() => {
    if (toAsset === "USDC") return USDC_ASSET_INFO;
    return SUPPORTED_SYNTH_ASSETS.find(s => s.symbol === toAsset);
  }, [toAsset]);
  
  const availableFromBalance = useMemo(() => {
    const balanceItem = getBalanceByAsset(fromAsset); // This returns Partial<Balance> | undefined
    if (balanceItem && balanceItem.balance && fromAssetInfo) {
        try {
            // balanceItem.balance is a string representing base units
            return Number(BigInt(balanceItem.balance)) / (10 ** fromAssetInfo.decimals);
        } catch { return 0; }
    }
    return 0;
  }, [fromAsset, fromAssetInfo, getBalanceByAsset]);

  useEffect(() => {
    if (isOpen) {
      const defaultFrom = initialFromAsset || "USDC";
      let defaultTo = initialToAsset || SUPPORTED_SYNTH_ASSETS[0]?.symbol || "";
      if (defaultTo === defaultFrom) {
        // If defaultTo is same as defaultFrom, pick the next available synth or USDC
        if (defaultFrom === "USDC") {
            defaultTo = SUPPORTED_SYNTH_ASSETS.find(s => s.symbol !== defaultFrom)?.symbol || "";
        } else {
            defaultTo = "USDC";
        }
      }
      setFromAsset(defaultFrom);
      setToAsset(defaultTo);
      setFromAmount('');
      setIsSubmitting(false);
    }
  }, [isOpen, initialFromAsset, initialToAsset]);

  useEffect(() => {
    if (fromAsset === toAsset && isOpen) { // Check isOpen to prevent reset on modal close
      if (fromAsset === "USDC") {
        const nextSynth = SUPPORTED_SYNTH_ASSETS.find(s => s.symbol !== "USDC");
        setToAsset(nextSynth?.symbol || ""); // Fallback to empty if no other synths
      } else {
        setToAsset("USDC");
      }
    }
  }, [fromAsset, toAsset, isOpen]);

  const handleFromAssetChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setFromAsset(e.target.value);
    setFromAmount('');
  };

  const setToAssetChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setToAsset(e.target.value);
  };

  const handleSwapAssets = () => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
    setFromAmount(''); 
  };
  
  const setMaxFromAmount = () => {
    if (availableFromBalance !== null && fromAssetInfo) {
        // Format to the precision of the asset for the input field
        setFromAmount(availableFromBalance.toFixed(fromAssetInfo.decimals));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fromAssetInfo || !toAssetInfo) {
      notify.error("Invalid asset selection.");
      return;
    }

    const amountNum = parseFloat(fromAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      notify.error("Please enter a valid positive amount.");
      return;
    }
    // Use a small epsilon for floating point comparison
    const epsilon = 1 / (10 ** (fromAssetInfo.decimals + 1)); 
    if (amountNum > availableFromBalance + epsilon) {
        notify.error(`Insufficient ${fromAssetInfo.name} balance. Available: ${availableFromBalance.toFixed(fromAssetInfo.decimals)}`);
        return;
    }

    const amountInBaseUnits = (BigInt(Math.round(amountNum * (10**fromAssetInfo.decimals)))).toString();

    setIsSubmitting(true);
    const loadingToastId = notify.loading(`Exchanging ${fromAssetInfo.symbol} for ${toAssetInfo.symbol}...`);

    try {
      const response = await fetch('/api/synths/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAsset: fromAssetInfo.symbol,
          toAsset: toAssetInfo.symbol,
          amount: amountInBaseUnits,
          mode: currentMode,
        }),
      });

      notify.dismiss(loadingToastId);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Exchange failed (${response.status})`);
      }
      
      // Use the formatBalanceDisplay for the notification
      const receivedAmountFormatted = formatBalanceDisplay(result.toAmount, toAssetInfo.decimals);
      notify.success(result.message || `Successfully exchanged for ${receivedAmountFormatted} ${toAssetInfo.symbol}.`);
      setFromAmount('');
      refreshBalances();
      onClose();
    } catch (err: unknown) { // Typed err as unknown
      notify.dismiss(loadingToastId);
      console.error("Synth exchange error:", err);
      if (err instanceof Error) { // Type guard
        notify.error(err.message);
      } else {
        notify.error("An unknown error occurred during exchange.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const allAssetsForDropdown = [USDC_ASSET_INFO, ...SUPPORTED_SYNTH_ASSETS];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Exchange Assets" size="md">
      <form onSubmit={handleSubmit} className={styles.exchangeForm}>
        <div className={styles.fieldGroup}>
          <label htmlFor="fromAssetSelect">From</label>
          <div className={styles.assetInputWrapper}>
            <select
              id="fromAssetSelect"
              value={fromAsset}
              onChange={handleFromAssetChange}
              className={styles.assetSelect}
            >
              {allAssetsForDropdown.map(asset => (
                <option key={`from-${asset.symbol}`} value={asset.symbol} disabled={asset.symbol === toAsset}>
                  {asset.name} ({asset.symbol})
                </option>
              ))}
            </select>
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="0.00"
              step="any"
              min="0"
              required
              className={styles.amountInput}
            />
          </div>
          <div className={styles.balanceInfo}>
            <span>Balance: {availableFromBalance !== null && fromAssetInfo ? availableFromBalance.toFixed(fromAssetInfo.decimals) : <SkeletonLoader width="60px" height="14px"/>} {fromAssetInfo?.symbol}</span>
            <Button type="button" variant="ghost" size="sm" onClick={setMaxFromAmount} className={styles.maxButton}>MAX</Button>
          </div>
        </div>

        <div className={styles.swapButtonContainer}>
            <Button type="button" variant="outline" onClick={handleSwapAssets} iconLeft={<ArrowRightLeft size={16}/>} aria-label="Swap assets">
                Swap assets
            </Button>
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="toAssetSelect">To</label>
           <div className={styles.assetInputWrapper}>
            <select
                id="toAssetSelect"
                value={toAsset}
                onChange={setToAssetChange}
                className={styles.assetSelect}
            >
                {allAssetsForDropdown.map(asset => (
                    <option key={`to-${asset.symbol}`} value={asset.symbol} disabled={asset.symbol === fromAsset}>
                    {asset.name} ({asset.symbol})
                    </option>
                ))}
            </select>
            <input
              type="text"
              placeholder="Estimated amount"
              readOnly
              disabled
              className={`${styles.amountInput} ${styles.readOnlyAmount}`}
            />
          </div>
        </div>
        
        <div className={styles.modalActions}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting || !fromAssetInfo || !toAssetInfo || !fromAmount || parseFloat(fromAmount) <= 0}>
            Exchange
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default SynthExchangeModal;