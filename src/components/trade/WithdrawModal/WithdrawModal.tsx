// src/components/trade/WithdrawModal/WithdrawModal.tsx
"use client";

import React, { useState, useEffect, ChangeEvent, useMemo, useCallback } from 'react';
import styles from './WithdrawModal.module.css';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import { useAccountContext } from '@/contexts/AccountContext';
import { useWallet } from '@/contexts/WalletContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import { ethers } from 'ethers';
import { AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
import LoadingSpinner from '@/components/ui/LoadingSpinner/LoadingSpinner';
import { USDC_ASSET_INFO, SUPPORTED_SYNTH_ASSETS } from '@/lib/references'; // CXPT is not in SUPPORTED_SYNTH_ASSETS

const CXPT_ASSET_INFO = { symbol: "CXPT", name: "Cxmpute Token", decimals: 18 };

// Combine all withdrawable assets
const ALL_WITHDRAWABLE_ASSETS = [
  USDC_ASSET_INFO,
  CXPT_ASSET_INFO,
  ...SUPPORTED_SYNTH_ASSETS
];

const getAssetInfo = (symbol: string) => ALL_WITHDRAWABLE_ASSETS.find(a => a.symbol === symbol);

const formatBaseUnitsToDisplay = (baseUnitsStr: string | undefined | null, decimals: number): string => {
    if (baseUnitsStr === undefined || baseUnitsStr === null || baseUnitsStr === '') return '0.00';
    try {
        const displayAmount = ethers.formatUnits(BigInt(baseUnitsStr), decimals);
        const displayPrecision = Math.min(decimals, 6); // Show up to 6 decimals for UI
        const num = parseFloat(displayAmount);
        if (num === 0) return "0.00";
        if (Math.abs(num) < 0.000001 && num !== 0) return num.toExponential(2);
        return num.toFixed(displayPrecision);
    } catch { return "Error"; }
};

const shortenAddress = (address: string, chars = 6): string => {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
};

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAsset?: string; // Can be USDC, CXPT, or any sAsset symbol
}

type Step = "input" | "confirm" | "withdrawing" | "success" | "error";

const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose, initialAsset }) => {
  const { refreshBalances, getBalanceByAsset } = useAccountContext();
  const { account: connectedWalletAddress, status: walletStatus } = useWallet();
  const { currentMode } = useTradingMode();

  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string>(initialAsset || USDC_ASSET_INFO.symbol);
  const [amount, setAmount] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<Step>("input");
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFetchingBalance, setIsFetchingBalance] = useState(false); // For internal balance display loading

  const selectedAssetInfo = useMemo(() => getAssetInfo(selectedAssetSymbol), [selectedAssetSymbol]);

  const availableInternalBalanceStr = useMemo(() => {
    const balanceItem = getBalanceByAsset(selectedAssetSymbol);
    return balanceItem?.balance || null; // balance is string of base units
  }, [selectedAssetSymbol, getBalanceByAsset]);
  
  const availableInternalBalanceDisplay = useMemo(() => {
      if (!selectedAssetInfo || availableInternalBalanceStr === null) return "0.00";
      return formatBaseUnitsToDisplay(availableInternalBalanceStr, selectedAssetInfo.decimals);
  }, [availableInternalBalanceStr, selectedAssetInfo]);

  const resetForm = useCallback(() => {
    setSelectedAssetSymbol(initialAsset || USDC_ASSET_INFO.symbol);
    setAmount(''); setCurrentStep("input"); setIsLoading(false);
    setTxHash(null); setErrorMessage(null);
  }, [initialAsset]);

  useEffect(() => { if (isOpen) resetForm(); }, [isOpen, resetForm]);

  // To show loading for internal balance when modal opens or asset changes
  useEffect(() => {
    if (isOpen) {
      setIsFetchingBalance(true);
      // Simulate a brief delay for balance fetching or rely on AccountContext's isLoading.balances
      const timer = setTimeout(() => setIsFetchingBalance(false), 300); 
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedAssetSymbol]); // `balances` from AccountContext if you track its direct loading state


  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) setAmount(value);
  };

  const handleAssetChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedAssetSymbol(e.target.value); setAmount('');
  };

  const setMaxAmount = () => {
    if (availableInternalBalanceStr && selectedAssetInfo) {
      setAmount(formatBaseUnitsToDisplay(availableInternalBalanceStr, selectedAssetInfo.decimals));
    }
  };

  const proceedToConfirm = () => {
    if (!selectedAssetInfo) { notify.error("Invalid asset selected."); return; }
    const withdrawAmountNum = parseFloat(amount);
    if (isNaN(withdrawAmountNum) || withdrawAmountNum <= 0) {
      notify.error("Please enter a valid withdrawal amount."); return;
    }
    
    const availableNum = availableInternalBalanceStr ? parseFloat(formatBaseUnitsToDisplay(availableInternalBalanceStr, selectedAssetInfo.decimals)) : 0;
    const epsilon = 1 / (10 ** (selectedAssetInfo.decimals + 1)); // For float comparison
    if (withdrawAmountNum > availableNum + epsilon) {
      notify.error(`Withdrawal amount exceeds your available DEX ${selectedAssetInfo.symbol} balance.`); return;
    }
    setCurrentStep("confirm");
  };
  
  const handleWithdraw = async () => {
    if (!connectedWalletAddress) {
      notify.error("Peaq wallet not connected. Cannot proceed with REAL mode withdrawal."); return;
    }
    if (!selectedAssetInfo) {
      notify.error("Asset information is missing."); return;
    }
    
    let amountInBaseUnits: string;
    try { amountInBaseUnits = ethers.parseUnits(amount, selectedAssetInfo.decimals).toString(); } 
    catch { notify.error("Invalid amount format or too many decimals."); return; }

    setCurrentStep("withdrawing"); setIsLoading(true); setErrorMessage(null); setTxHash(null);
    const loadingToastId = notify.loading(`Processing ${selectedAssetInfo.symbol} withdrawal...`);

    try {
      const response = await fetch('/api/vault/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetSymbol: selectedAssetInfo.symbol,
          amount: amountInBaseUnits,
          mode: currentMode, // API route will enforce REAL mode
        }),
      });
      const result = await response.json();
      notify.dismiss(loadingToastId);

      if (!response.ok) throw new Error(result.error || `Withdrawal failed (${response.status})`);
      
      setTxHash(result.txHash);
      notify.success(result.message || `${selectedAssetInfo.symbol} withdrawal initiated!`);
      setCurrentStep("success");
      refreshBalances(); // Refresh internal DEX balances after successful withdrawal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Withdrawal API error:", err);
      notify.dismiss(loadingToastId);
      notify.error(err.message || "Withdrawal failed.");
      setErrorMessage(err.message || "Withdrawal API failed. Please check transaction or try again.");
      setCurrentStep("error");
    } finally { setIsLoading(false); }
  };
  
  const handleDone = () => { onClose(); };

  // Determine if the "Next" or "Confirm Withdraw" button should be disabled
  const isActionDisabled = isLoading || !amount || parseFloat(amount) <= 0 || 
    (availableInternalBalanceStr !== null && selectedAssetInfo && 
     ethers.parseUnits(amount || "0", selectedAssetInfo.decimals) > BigInt(availableInternalBalanceStr));


  return (
    <Modal isOpen={isOpen} onClose={handleDone} title={`Withdraw Funds (${currentMode})`} size="md">
      <div className={styles.withdrawModalContent}>
        {currentMode !== "REAL" && isOpen && (
            <div className={`${styles.notice} ${styles.errorNotice}`}>
                <AlertCircle size={20} /> Withdrawals are only available in REAL trading mode.
            </div>
        )}
        {(!connectedWalletAddress && currentMode === "REAL" && isOpen && walletStatus !== 'CONNECTING') && (
          <div className={styles.notice}>
            <AlertCircle size={20} /> Please connect your Peaq wallet to withdraw funds.
          </div>
        )}

        {currentMode === "REAL" && connectedWalletAddress && walletStatus === 'CONNECTED' && (
          <>
            {currentStep === "input" && (
              <>
                <div className={styles.formGroup}>
                  <label htmlFor="withdrawAssetSelect">Asset to Withdraw</label>
                  <select id="withdrawAssetSelect" value={selectedAssetSymbol} onChange={handleAssetChange} className={styles.assetSelect} disabled={isLoading || isFetchingBalance}>
                    {ALL_WITHDRAWABLE_ASSETS.map(asset => (
                      <option key={asset.symbol} value={asset.symbol}>
                        {asset.name} ({asset.symbol})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.balanceDisplay}>
                  Available DEX Balance: 
                  {isFetchingBalance ? <SkeletonLoader width="80px" height="18px" className={styles.balanceSkeleton}/> : 
                  <span className={styles.balanceValue}>
                    {availableInternalBalanceDisplay} {selectedAssetInfo?.symbol}
                  </span>}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="withdrawAmount">Amount to Withdraw</label>
                  <div className={styles.amountInputWrapper}>
                    <input type="text" id="withdrawAmount" value={amount} onChange={handleAmountChange} placeholder={`0.00${'0'.repeat(Math.max(0, (selectedAssetInfo?.decimals || 2)-2))}`} disabled={isLoading || isFetchingBalance} className={styles.inputField} />
                    <span className={styles.assetTicker}>{selectedAssetInfo?.symbol}</span>
                  </div>
                  <div className={styles.maxButtonContainer}>
                    <Button type="button" variant="ghost" size="sm" onClick={setMaxAmount} className={styles.maxButton} disabled={isLoading || isFetchingBalance || !availableInternalBalanceStr}>MAX</Button>
                  </div>
                </div>
                <Button onClick={proceedToConfirm} disabled={isActionDisabled} className={styles.actionButton} variant="primary">
                  Next
                </Button>
              </>
            )}

            {currentStep === "confirm" && selectedAssetInfo && (
              <div className={styles.stepContainer}>
                <h4>Confirm Withdrawal</h4>
                <p>You are about to withdraw <strong>{amount} {selectedAssetInfo.symbol}</strong> from your DEX account.</p>
                <p>Funds will be sent to your linked Peaq wallet:</p>
                <p className={styles.walletAddressDisplay} title={connectedWalletAddress}>
                    {shortenAddress(connectedWalletAddress)}
                </p>
                {selectedAssetInfo.symbol === "CXPT" && (
                    <p className={styles.infoSmall}>Note: Withdrawing as $CXPT will mint new tokens to your wallet. This action is irreversible.</p>
                )}
                <div className={styles.confirmActions}>
                    <Button onClick={() => setCurrentStep("input")} variant="ghost" size="sm" className={styles.backButton} disabled={isLoading}>Back</Button>
                    <Button onClick={handleWithdraw} isLoading={isLoading} className={styles.actionButtonConfirm} variant="primary">
                        Confirm Withdraw
                    </Button>
                </div>
              </div>
            )}

            {currentStep === "withdrawing" && (
              <div className={styles.stepContainer}>
                <h4>Processing Withdrawal...</h4>
                <LoadingSpinner size={32} />
                <p>Please wait. The backend is processing your withdrawal request with the Vault.</p>
                {txHash && <p className={styles.txInfo}>Tx Initiated: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLinkModal}>{shortenAddress(txHash, 10)} <ExternalLink size={12}/></a></p>}
              </div>
            )}
            
            {currentStep === "success" && (
              <div className={`${styles.stepContainer} ${styles.centered}`}>
                <CheckCircle size={48} className={styles.successIcon} />
                <h4>Withdrawal Initiated!</h4>
                <p>{amount} {selectedAssetSymbol} is being sent to your wallet.</p>
                {txHash && <p className={styles.txInfo}>Confirmation Tx: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLinkModal}>{shortenAddress(txHash, 10)} <ExternalLink size={12}/></a></p>}
                <p className={styles.infoSmall}>Your DEX balance has been updated. Blockchain confirmations may take some time.</p>
                <Button onClick={handleDone} variant="primary" className={styles.actionButton}>Done</Button>
              </div>
            )}
            
            {currentStep === "error" && (
              <div className={`${styles.stepContainer} ${styles.centered}`}>
                <AlertCircle size={48} className={styles.errorIcon} />
                <h4>Withdrawal Failed</h4>
                <p className={styles.errorMessageModal}>{errorMessage || "An unknown error occurred."}</p>
                {txHash && <p className={styles.txInfo}>Failed Tx Attempt: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLinkModal}>{shortenAddress(txHash, 10)} <ExternalLink size={12}/></a></p>}
                <div className={styles.confirmActions}>
                    <Button onClick={() => { setCurrentStep("input"); setErrorMessage(null);}} variant="secondary" size="sm" className={styles.backButton} disabled={isLoading}>Try Again</Button>
                    <Button onClick={handleDone} variant="ghost" className={styles.actionButton}>Close</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default WithdrawModal;