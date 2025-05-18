// src/components/trade/BalancesInfo/BalancesInfo.tsx
"use client";

import React, { useState, useMemo } from 'react'; // Added useState
import styles from './BalancesInfo.module.css';
import { useAccountContext } from '@/contexts/AccountContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import Button from '@/components/ui/Button/Button';
import PaperFaucetButton from '@/components/trade/PaperFaucetButton/PaperFaucetButton';
import DepositModal from '@/components/trade/DepositModal/DepositModal';
import WithdrawModal from '@/components/trade/WithdrawModal/WithdrawModal';
import SynthExchangeModal from '@/components/trade/SynthExchangeModal/SynthExchangeModal';
import DepositSynthModal from '@/components/trade/DepositSynthModal/DepositSynthModal'; // <<< NEW IMPORT
import { USDC_ASSET_INFO, SUPPORTED_SYNTH_ASSETS } from '@/lib/references';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
import { Wallet, Award, Repeat, ArrowDownCircle, ArrowUpCircle, RefreshCw, DownloadCloud } from 'lucide-react'; // <<< Added DownloadCloud
import type { Balance } from '@/lib/interfaces';
import Tooltip from '@/components/ui/Tooltip/Tooltip';

// ... (Keep existing ASSET_DECIMALS, getAssetDisplayInfo, formatDisplayBalance helpers) ...
// These are the same as in the previous response for BalancesInfo.tsx

const ASSET_DECIMALS: Record<string, number> = {
  [USDC_ASSET_INFO.symbol]: USDC_ASSET_INFO.decimals,
  "CXPT": 18,
  ...SUPPORTED_SYNTH_ASSETS.reduce((acc, asset) => {
    acc[asset.symbol] = asset.decimals;
    return acc;
  }, {} as Record<string, number>)
};

const getAssetDisplayInfo = (assetSymbol: string): { name: string; decimals: number } => {
    if (assetSymbol === USDC_ASSET_INFO.symbol) return { name: USDC_ASSET_INFO.name, decimals: USDC_ASSET_INFO.decimals };
    if (assetSymbol === "CXPT") return { name: "Cxmpute Token", decimals: ASSET_DECIMALS["CXPT"] || 18 };
    const synth = SUPPORTED_SYNTH_ASSETS.find(s => s.symbol === assetSymbol);
    if (synth) return { name: synth.name, decimals: synth.decimals };
    return { name: assetSymbol, decimals: 8 };
};

const formatDisplayBalance = (balanceValueStr: string | number | undefined | null, assetSymbol: string): string => {
    if (balanceValueStr === undefined || balanceValueStr === null) return '-.--';
    const assetInfo = getAssetDisplayInfo(assetSymbol);
    const decimals = assetInfo.decimals;
    try {
        const balanceBigInt = BigInt(String(balanceValueStr));
        const divisor = BigInt(10) ** BigInt(decimals);
        const wholePart = balanceBigInt / divisor;
        const fractionalPart = balanceBigInt % divisor;
        let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
        const displayPrecision = Math.min(decimals, assetSymbol === "USDC" || assetSymbol === "CXPT" ? 2 : 4);
        fractionalStr = fractionalStr.substring(0, displayPrecision);
        if (fractionalStr.length > 0) return `${wholePart.toLocaleString()}.${fractionalStr}`;
        return wholePart.toLocaleString();
    } catch {
        const num = Number(balanceValueStr);
        if (isNaN(num)) return "Error";
        return num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: Math.min(decimals, 6)});
    }
};


const BalancesInfo: React.FC = () => {
  const { balances, paperPoints, isLoading, error, refreshAllAccountData } = useAccountContext();
  const { currentMode } = useTradingMode();

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
  const [isDepositSynthModalOpen, setIsDepositSynthModalOpen] = useState(false); // <<< NEW STATE

  const sortedBalances = useMemo(() => {
    return [...balances].sort((a, b) => {
      if (a.asset === "USDC") return -1; if (b.asset === "USDC") return 1;
      if (a.asset === "CXPT") return -1; if (b.asset === "CXPT") return 1;
      return (a.asset || "").localeCompare(b.asset || "");
    });
  }, [balances]);

  const renderBalanceRow = (balanceItem: Partial<Balance>) => {
    if (!balanceItem.asset) return null;
    const assetInfo = getAssetDisplayInfo(balanceItem.asset);

    return (
      <div className={styles.balanceRow} key={balanceItem.asset}>
        <div className={styles.assetInfo}>
            <span className={styles.assetSymbol}>{balanceItem.asset}</span>
            <span className={styles.assetName}>{assetInfo.name}</span>
        </div>
        <div className={styles.amountInfo} title={`Full: ${balanceItem.balance || '0'} base units`}>
          <span className={styles.assetAmount}>
            {formatDisplayBalance(balanceItem.balance, balanceItem.asset)}
          </span>
          {balanceItem.pending && BigInt(balanceItem.pending) !== BigInt(0) && (
            <Tooltip content={`Pending/Locked: ${formatDisplayBalance(balanceItem.pending, balanceItem.asset)}`}>
              <span className={styles.pendingAmount}>
                (In Orders: {formatDisplayBalance(balanceItem.pending, balanceItem.asset)})
              </span>
            </Tooltip>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={styles.balancesContainer}>
        <div className={styles.header}>
            <div className={styles.titleContainer}>
                <Wallet size={18} />
                <h3 className={styles.title}>Balances ({currentMode})</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={refreshAllAccountData} disabled={Object.values(isLoading).some(Boolean)} title="Refresh all account data">
                <RefreshCw size={14} className={Object.values(isLoading).some(Boolean) ? styles.spin : ''} />
            </Button>
        </div>

        {isLoading.balances && sortedBalances.length === 0 && (
          <div className={styles.balancesList}>
            {Array.from({length: 3}).map((_, i) => (
              <div className={styles.balanceRow} key={`skel-bal-${i}`}>
                <SkeletonLoader width="80px" height="18px" />
                <SkeletonLoader width="100px" height="18px" />
              </div>
            ))}
          </div>
        )}
        {!isLoading.balances && error.balances && <p className={styles.globalError}>Failed to load balances: {error.balances}</p>}
        {!isLoading.balances && !error.balances && sortedBalances.length === 0 && (
            <p className={styles.noBalances}>No balances found for {currentMode} mode.</p>
        )}
        {!isLoading.balances && !error.balances && sortedBalances.length > 0 && (
          <div className={styles.balancesList}>
            {sortedBalances.map(renderBalanceRow)}
          </div>
        )}

        {currentMode === 'PAPER' && (
          <div className={styles.paperSection}>
              {isLoading.points ? (
                  <div className={styles.balanceRow}>
                      <span className={styles.assetLabel}><Award size={16} /> Paper Points</span>
                      <SkeletonLoader width="80px" height="18px" />
                  </div>
              ) : error.points ? (
                  <div className={styles.balanceRow}>
                      <span className={styles.assetLabel}><Award size={16} /> Paper Points</span>
                      <span className={styles.errorTextSmall}>Error</span>
                  </div>
              ) : (
                  <div className={styles.balanceRow}>
                      <span className={styles.assetLabel}><Award size={16} /> Paper Points</span>
                      <span className={styles.assetAmount}>
                      {paperPoints?.totalPoints?.toLocaleString() || '0'}
                      </span>
                  </div>
              )}
            <PaperFaucetButton />
          </div>
        )}

        <div className={styles.actions}>
          {currentMode === 'REAL' && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsDepositModalOpen(true)} iconLeft={<ArrowDownCircle size={16} />}>
                Deposit USDC
              </Button>
              {/* <<< NEW BUTTON FOR SYNTH DEPOSIT >>> */}
              <Button variant="secondary" size="sm" onClick={() => setIsDepositSynthModalOpen(true)} iconLeft={<DownloadCloud size={16} />}>
                Deposit sAsset
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIsWithdrawModalOpen(true)} iconLeft={<ArrowUpCircle size={16} />}>
                Withdraw
              </Button>
            </>
          )}
          <Button variant="secondary" size="sm" onClick={() => setIsExchangeModalOpen(true)} iconLeft={<Repeat size={16} />}>
            Exchange
          </Button>
        </div>
      </div>

      {/* Modals */}
      {currentMode === 'REAL' && (
        <>
          <DepositModal isOpen={isDepositModalOpen} onClose={() => setIsDepositModalOpen(false)} />
          <WithdrawModal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} />
          {/* <<< NEW MODAL INSTANCE >>> */}
          <DepositSynthModal isOpen={isDepositSynthModalOpen} onClose={() => setIsDepositSynthModalOpen(false)} />
        </>
      )}
      {/* ExchangeModal can be available in both modes if needed, or conditioned on REAL */}
      <SynthExchangeModal isOpen={isExchangeModalOpen} onClose={() => setIsExchangeModalOpen(false)} />
    </>
  );
};

export default BalancesInfo;