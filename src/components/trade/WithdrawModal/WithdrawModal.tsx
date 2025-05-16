/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/WithdrawModal/WithdrawModal.tsx
"use client";

import React, { useState, useEffect, ChangeEvent, useMemo } from 'react';
import styles from './WithdrawModal.module.css'; // Create this CSS file
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import { useAccountContext } from '@/contexts/AccountContext';
import { useWallet } from '@/contexts/WalletContext'; // To display withdrawal address
import { useTradingMode } from '@/contexts/TradingModeContext';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import { AlertCircle, CheckCircle } from 'lucide-react';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
import LoadingSpinner from '@/components/ui/LoadingSpinner/LoadingSpinner';
import { ethers } from 'ethers';

// Define withdrawable assets and their properties
// For now, USDC and CXPT are primary. sASSETs are internal balances.
const WITHDRAWABLE_ASSETS = [
  { symbol: "USDC", name: "USD Coin", decimals: 6 },
  { symbol: "CXPT", name: "Cxmpute Token", decimals: 18 }, // Assuming 18 decimals for CXPT
];

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAsset?: "USDC" | "CXPT"; // Asset to pre-select
}

type Step = "input" | "confirm" | "withdrawing" | "success" | "error";

const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose, initialAsset }) => {
  const { refreshBalances, getBalanceByAsset } = useAccountContext();
  const { account: connectedWalletAddress } = useWallet(); // User's linked external Peaq wallet
  const { currentMode } = useTradingMode(); // Withdrawals are typically REAL mode only

  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string>(initialAsset || "USDC");
  const [amount, setAmount] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<Step>("input");
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedAssetInfo = useMemo(() => {
    return WITHDRAWABLE_ASSETS.find(a => a.symbol === selectedAssetSymbol);
  }, [selectedAssetSymbol]);

  const availableInternalBalance = useMemo(() => {
    if (!selectedAssetInfo) return 0;
    const balanceItem = getBalanceByAsset(selectedAssetInfo.symbol);
    if (balanceItem?.balance) {
      try {
        // balanceItem.balance is a string representing base units
        return Number(BigInt(balanceItem.balance)) / (10 ** selectedAssetInfo.decimals);
      } catch { return 0; }
    }
    return 0;
  }, [ selectedAssetInfo, getBalanceByAsset]);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep("input");
      setSelectedAssetSymbol(initialAsset || "USDC");
      setAmount('');
      setTxHash(null);
      setErrorMessage(null);
      // No need to fetch external balance for withdrawal, only internal DEX balance matters
    }
  }, [isOpen, initialAsset]);

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleAssetChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedAssetSymbol(e.target.value);
    setAmount(''); // Reset amount when asset changes
  };

  const proceedToConfirm = () => {
    if (!selectedAssetInfo) {
        notify.error("Invalid asset selected."); return;
    }
    const withdrawAmountNum = parseFloat(amount);
    if (isNaN(withdrawAmountNum) || withdrawAmountNum <= 0) {
      notify.error("Please enter a valid withdrawal amount."); return;
    }
    const epsilon = 1 / (10 ** (selectedAssetInfo.decimals + 1));
    if (withdrawAmountNum > availableInternalBalance + epsilon) {
      notify.error(`Withdrawal amount exceeds your available ${selectedAssetInfo.symbol} balance.`); return;
    }
    setCurrentStep("confirm");
  };
  
  const setMaxAmount = () => {
    if (selectedAssetInfo) {
        setAmount(availableInternalBalance.toFixed(selectedAssetInfo.decimals));
    }
  };

  const handleWithdraw = async () => {
    if (!connectedWalletAddress) {
      notify.error("Peaq wallet not connected. Cannot proceed with REAL mode withdrawal.");
      return;
    }
    if (!selectedAssetInfo) {
      notify.error("Asset information is missing."); return;
    }
    const withdrawAmountStr = amount;
    let amountInBaseUnits: string;
    try {
      amountInBaseUnits = ethers.parseUnits(withdrawAmountStr, selectedAssetInfo.decimals).toString();
    } catch {
      notify.error("Invalid amount format or too many decimals for the selected asset."); return;
    }

    setCurrentStep("withdrawing");
    setIsLoading(true);
    setErrorMessage(null);
    setTxHash(null);
    const loadingToastId = notify.loading(`Processing ${selectedAssetInfo.symbol} withdrawal...`);

    try {
      const response = await fetch('/api/vault/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInBaseUnits,
          asCxpt: selectedAssetInfo.symbol === "CXPT", // Backend uses this to mint CXPT or send USDC
          // userWalletAddress is determined by the backend based on authenticated user
          // and their linked wallet, not sent from client for security.
        }),
      });

      notify.dismiss(loadingToastId);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Withdrawal failed (${response.status})`);
      }
      
      setTxHash(result.txHash);
      notify.success(result.message || `${selectedAssetInfo.symbol} withdrawal initiated!`);
      setCurrentStep("success");
      refreshBalances(); // Refresh internal DEX balances
    } catch (err: any) {
      console.error("Withdrawal API error:", err);
      notify.dismiss(loadingToastId);
      notify.error(err.message || "Withdrawal failed.");
      setErrorMessage(err.message || "Withdrawal API failed. Please check transaction or try again.");
      setCurrentStep("error");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDone = () => {
    onClose();
    setTimeout(() => {
        setAmount('');
        setSelectedAssetSymbol(initialAsset || "USDC");
        setCurrentStep("input");
        setTxHash(null);
        setErrorMessage(null);
    }, 300);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleDone} title={`Withdraw Funds (${currentMode})`} size="md">
      <div className={styles.withdrawModalContent}>
        {currentMode !== "REAL" && isOpen && (
            <div className={`${styles.notice} ${styles.errorNotice}`}>
                <AlertCircle size={20} /> Withdrawals are only available in REAL trading mode.
            </div>
        )}
        {!connectedWalletAddress && currentMode === "REAL" && isOpen && (
          <div className={styles.notice}>
            <AlertCircle size={20} /> Please connect your Peaq wallet to withdraw funds.
          </div>
        )}

        {currentMode === "REAL" && connectedWalletAddress && (
          <>
            {currentStep === "input" && (
              <>
                <div className={styles.formGroup}>
                  <label htmlFor="withdrawAssetSelect">Asset to Withdraw</label>
                  <select
                    id="withdrawAssetSelect"
                    value={selectedAssetSymbol}
                    onChange={handleAssetChange}
                    className={styles.assetSelect}
                    disabled={isLoading}
                  >
                    {WITHDRAWABLE_ASSETS.map(asset => (
                      <option key={asset.symbol} value={asset.symbol}>
                        {asset.name} ({asset.symbol})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.balanceDisplay}>
                  Available DEX Balance: 
                  {isLoading && availableInternalBalance === null ? <SkeletonLoader width="80px" height="18px" className={styles.balanceSkeleton}/> : 
                  <span className={styles.balanceValue}>
                    {availableInternalBalance.toFixed(selectedAssetInfo?.decimals || 2)} {selectedAssetInfo?.symbol}
                  </span>}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="withdrawAmount">Amount to Withdraw</label>
                  <div className={styles.amountInputWrapper}>
                    <input
                      type="text"
                      id="withdrawAmount"
                      value={amount}
                      onChange={handleAmountChange}
                      placeholder="0.00"
                      disabled={isLoading}
                      className={styles.inputField}
                    />
                    <span className={styles.assetTicker}>{selectedAssetInfo?.symbol}</span>
                  </div>
                  <div className={styles.maxButtonContainer}>
                    <Button type="button" variant="ghost" size="sm" onClick={setMaxAmount} className={styles.maxButton}>
                        Use Max Available
                    </Button>
                  </div>
                </div>
                <Button onClick={proceedToConfirm} disabled={isLoading || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > availableInternalBalance} className={styles.actionButton} variant="primary">
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
                    {connectedWalletAddress}
                </p>
                {selectedAssetInfo.symbol === "CXPT" && (
                    <p className={styles.infoSmall}>Note: Withdrawing as $CXPT will mint new tokens to your wallet. This action is irreversible.</p>
                )}
                <div className={styles.confirmActions}>
                    <Button onClick={() => setCurrentStep("input")} variant="ghost" size="sm" className={styles.backButton}>Back</Button>
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
                <p>Please wait while your withdrawal is processed. Confirm any transactions if prompted by backend (usually server handles this).</p>
                {txHash && <p className={styles.txInfo}>Tx: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLink}>{shortenAddress(txHash, 10)}</a></p>}
              </div>
            )}
            
            {currentStep === "success" && (
              <div className={`${styles.stepContainer} ${styles.centered}`}>
                <CheckCircle size={48} className={styles.successIcon} />
                <h4>Withdrawal Initiated!</h4>
                <p>{amount} {selectedAssetSymbol} is being sent to your wallet.</p>
                {txHash && <p className={styles.txInfo}>Confirmation Tx: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLink}>{shortenAddress(txHash, 10)}</a></p>}
                <p className={styles.infoSmall}>Your DEX balance will update shortly. Blockchain confirmations may take some time.</p>
                <Button onClick={handleDone} variant="primary" className={styles.actionButton}>Done</Button>
              </div>
            )}
            
            {currentStep === "error" && (
              <div className={`${styles.stepContainer} ${styles.centered}`}>
                <AlertCircle size={48} className={styles.errorIcon} />
                <h4>Withdrawal Failed</h4>
                <p className={styles.errorMessage}>{errorMessage || "An unknown error occurred."}</p>
                {txHash && <p className={styles.txInfo}>Failed Tx Attempt: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLink}>{shortenAddress(txHash, 10)}</a></p>}
                <div className={styles.confirmActions}>
                    <Button onClick={() => setCurrentStep("input")} variant="secondary" size="sm" className={styles.backButton}>Try Again</Button>
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

// Helper to shorten addresses (can be moved to utils)
const shortenAddress = (address: string, chars = 6): string => {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
};

export default WithdrawModal;