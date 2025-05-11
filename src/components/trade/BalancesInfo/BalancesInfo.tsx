// src/components/trade/BalancesInfo/BalancesInfo.tsx
"use client";

import React, { useState } from 'react';
import styles from './BalancesInfo.module.css';
import { useAccountContext } from '@/contexts/AccountContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import Button from '@/components/ui/Button/Button'; // Your UI Button
import PaperFaucetButton from '@/components/trade/PaperFaucetButton/PaperFaucetButton';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
import { Wallet, Coins, Award, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import type { Balance } from '@/lib/interfaces'; // Assuming Balance has asset, balance, pending

// Placeholder for Modal components - to be implemented later
// For now, buttons will just log or set a simple state
// import DepositModal from '@/components/trade/DepositModal/DepositModal';
// import WithdrawModal from '@/components/trade/WithdrawModal/WithdrawModal';


// Helper to format large balance numbers (USDC, CXPT usually have 6-18 decimals)
// This needs to be robust based on how your 'balance' numbers are stored (e.g., string for BigInts, or number)
const formatBalance = (balanceValue: number | string | undefined, decimals: number = 6): string => {
    if (balanceValue === undefined || balanceValue === null) return '-.--';
    try {
        const num = typeof balanceValue === 'string' ? parseFloat(balanceValue) : balanceValue;
        if (isNaN(num)) return '-.--';
        
        // If it's a whole number already (e.g., from BigInt conversion without decimals)
        // or a number that represents base units
        const val = num / (10 ** decimals);

        if (val === 0) return "0.00";
        if (Math.abs(val) < 0.000001) return val.toExponential(2);
        if (Math.abs(val) < 1) return val.toFixed(Math.min(decimals, 4)); // Show up to 4 decimals for small amounts
        return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
        console.error("Error formatting balance:", e, "Value:", balanceValue);
        return "Error";
    }
};

const BalancesInfo: React.FC = () => {
  const { balances, paperPoints, isLoading, error } = useAccountContext();
  const { currentMode } = useTradingMode();

  // State for controlling deposit/withdraw modals (to be used when modals are implemented)
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [assetForModal, setAssetForModal] = useState<'USDC' | 'CXPT' | null>(null);

  const openDepositModal = (asset: 'USDC' | 'CXPT') => {
    setAssetForModal(asset);
    setIsDepositModalOpen(true);
    console.log(`Open deposit modal for ${asset}`); // Placeholder
  };

  const openWithdrawModal = (asset: 'USDC' | 'CXPT') => {
    setAssetForModal(asset);
    setIsWithdrawModalOpen(true);
    console.log(`Open withdraw modal for ${asset}`); // Placeholder
  };

  const usdcBalance = balances.find(b => b.asset === 'USDC');
  const cxptBalance = balances.find(b => b.asset === 'CXPT');
  // Add other assets if you track them, e.g., synth balances in paper mode

  const renderBalanceRow = (
    label: string,
    balanceItem: Partial<Balance> | undefined,
    assetSymbol: 'USDC' | 'CXPT',
    decimals: number = 6
  ) => {
    if (isLoading.balances) {
      return (
        <div className={styles.balanceRow}>
          <span className={styles.assetLabel}>{label}</span>
          <SkeletonLoader width="100px" height="20px" />
        </div>
      );
    }
    if (error.balances && !balanceItem) { // Show error only if no specific balance item is found for this asset
        return (
            <div className={styles.balanceRow}>
                <span className={styles.assetLabel}>{label}</span>
                <span className={styles.errorText}>Error loading</span>
            </div>
        );
    }

    return (
      <div className={styles.balanceRow}>
        <span className={styles.assetLabel}>{label}</span>
        <span className={styles.assetAmount} title={String(balanceItem?.balance || '0')}>
          {formatBalance(balanceItem?.balance, decimals)}
        </span>
        {/* Optional: Display pending amounts
        {balanceItem?.pending && Number(balanceItem.pending) !== 0 && (
          <span className={styles.pendingAmount} title={`Pending: ${formatBalance(balanceItem.pending, decimals)}`}>
            ({formatBalance(balanceItem.pending, decimals)})
          </span>
        )} */}
      </div>
    );
  };

  return (
    <div className={styles.balancesContainer}>
      <div className={styles.header}>
        <Wallet size={18} />
        <h3 className={styles.title}>Account Balances ({currentMode})</h3>
      </div>

      {error.balances && <p className={styles.globalError}>Failed to load balances: {error.balances}</p>}

      <div className={styles.balancesList}>
        {renderBalanceRow('USDC Balance', usdcBalance, 'USDC', 6)}
        {renderBalanceRow('CXPT Balance', cxptBalance, 'CXPT', 18)} {/* Assuming 18 decimals for CXPT */}
        {/* Add more assets here if needed */}
      </div>

      {currentMode === 'PAPER' && (
        <div className={styles.paperSection}>
            {isLoading.points ? (
                <div className={styles.balanceRow}>
                    <span className={styles.assetLabel}><Award size={16} /> Paper Points</span>
                    <SkeletonLoader width="80px" height="20px" />
                </div>
            ) : error.points ? (
                 <div className={styles.balanceRow}>
                    <span className={styles.assetLabel}><Award size={16} /> Paper Points</span>
                    <span className={styles.errorText}>Error</span>
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

      {currentMode === 'REAL' && (
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openDepositModal('USDC')}
            iconLeft={<ArrowDownCircle size={16} />}
          >
            Deposit USDC
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openWithdrawModal('USDC')}
            iconLeft={<ArrowUpCircle size={16} />}
          >
            Withdraw USDC
          </Button>
           <Button
            variant="secondary"
            size="sm"
            onClick={() => openWithdrawModal('CXPT')}
            iconLeft={<ArrowUpCircle size={16} />}
            disabled={!cxptBalance || Number(cxptBalance.balance) === 0} // Example disabled state
          >
            Withdraw CXPT
          </Button>
        </div>
      )}

      {/* Placeholder for Modals - to be implemented fully later */}
      {/* {isDepositModalOpen && assetForModal && (
        <DepositModal
          asset={assetForModal}
          isOpen={isDepositModalOpen}
          onClose={() => setIsDepositModalOpen(false)}
        />
      )}
      {isWithdrawModalOpen && assetForModal && (
        <WithdrawModal
          asset={assetForModal}
          isOpen={isWithdrawModalOpen}
          onClose={() => setIsWithdrawModalOpen(false)}
        />
      )} */}
    </div>
  );
};

export default BalancesInfo;