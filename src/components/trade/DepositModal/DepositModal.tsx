/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/DepositModal/DepositModal.tsx
"use client";

import React, { useState, useEffect, ChangeEvent, useCallback, useMemo } from 'react';
import styles from './DepositModal.module.css';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import { useAccountContext } from '@/contexts/AccountContext';
import { useWallet } from '@/contexts/WalletContext'; // For signer, provider, account
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import { ethers, MaxUint256 } from 'ethers'; // Using ethers v6
import { AlertCircle, CheckCircle } from 'lucide-react';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
import LoadingSpinner from '@/components/ui/LoadingSpinner/LoadingSpinner';
import { Resource } from 'sst';

const USDC_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || "0xbba60da06c2c5424f03f7434542280fcad453d10"; // Replace with actual
const VAULT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS || Resource.CoreVaultAddress.value; // From SST linked resource or env

const USDC_DECIMALS = 6; // Standard for USDC

const erc20Abi = [
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  // asset is implicitly USDC for this modal
}

type Step = "input" | "approve" | "approving" | "deposit" | "depositing" | "success" | "error";

const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose }) => {
  const { refreshBalances } = useAccountContext();
  const { account, provider, signer } = useWallet(); // From WalletContext

  const [amount, setAmount] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<Step>("input");
  const [isLoading, setIsLoading] = useState(false); // Generic loading for API calls/allowance check
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usdcBalanceExternal, setUsdcBalanceExternal] = useState<string | null>(null);
  const [currentAllowance, setCurrentAllowance] = useState<bigint | null>(null);

  const usdcContract = useMemo(() => {
    if (provider && USDC_CONTRACT_ADDRESS !== "0xReplaceWithActualUSDConPeaqAddress") {
      return new ethers.Contract(USDC_CONTRACT_ADDRESS, erc20Abi, provider);
    }
    return null;
  }, [provider]);

  const usdcContractWithSigner = useMemo(() => {
    if (signer && USDC_CONTRACT_ADDRESS !== "0xReplaceWithActualUSDConPeaqAddress") {
      return new ethers.Contract(USDC_CONTRACT_ADDRESS, erc20Abi, signer);
    }
    return null;
  }, [signer]);


  const checkAllowanceAndBalance = useCallback(async () => {
    if (!usdcContract || !account) return;
    setIsLoading(true);
    try {
      const [balanceBigInt, allowanceBigInt] = await Promise.all([
        usdcContract.balanceOf(account),
        usdcContract.allowance(account, VAULT_CONTRACT_ADDRESS),
      ]);
      setUsdcBalanceExternal(ethers.formatUnits(balanceBigInt, USDC_DECIMALS));
      setCurrentAllowance(allowanceBigInt as bigint); // ethers v6 returns bigint
    } catch (err) {
      console.error("Error checking allowance/balance:", err);
      notify.error("Failed to check USDC allowance/balance.");
      setErrorMessage("Could not fetch your USDC balance or allowance from your wallet.");
    } finally {
      setIsLoading(false);
    }
  }, [usdcContract, account]);

  useEffect(() => {
    if (isOpen && account && usdcContract) {
      setCurrentStep("input");
      setAmount('');
      setTxHash(null);
      setErrorMessage(null);
      checkAllowanceAndBalance();
    }
  }, [isOpen, account, usdcContract, checkAllowanceAndBalance]);


  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and a single decimal point
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const proceedToNextStep = async () => {
    if (!account || !VAULT_CONTRACT_ADDRESS || VAULT_CONTRACT_ADDRESS === "0xReplaceWithCoreVaultAddress") {
        notify.error("Wallet not connected or Vault address not configured.");
        return;
    }
    const depositAmountStr = amount;
    if (!depositAmountStr || parseFloat(depositAmountStr) <= 0) {
      notify.error("Please enter a valid deposit amount.");
      return;
    }
    
    let depositAmountBigInt: bigint;
    try {
        depositAmountBigInt = ethers.parseUnits(depositAmountStr, USDC_DECIMALS);
    } catch {
        notify.error("Invalid amount format or too many decimals.");
        return;
    }

    if (usdcBalanceExternal !== null && depositAmountBigInt > ethers.parseUnits(usdcBalanceExternal, USDC_DECIMALS)) {
        notify.error("Deposit amount exceeds your wallet's USDC balance.");
        return;
    }

    if (currentAllowance !== null && currentAllowance >= depositAmountBigInt) {
      setCurrentStep("deposit"); // Sufficient allowance, proceed to deposit step
    } else {
      setCurrentStep("approve"); // Needs approval
    }
  };


  const handleApprove = async () => {
    if (!usdcContractWithSigner || !VAULT_CONTRACT_ADDRESS) {
      notify.error("USDC Contract or Vault not initialized properly.");
      return;
    }
    // For simplicity, approve MaxUint256, or calculate needed amount if preferred
    // const amountToApprove = ethers.parseUnits(amount, USDC_DECIMALS); // Or MaxUint256
    const amountToApprove = MaxUint256;


    setCurrentStep("approving");
    setIsLoading(true);
    setErrorMessage(null);
    setTxHash(null);
    const loadingToastId = notify.loading("Requesting approval from your wallet...");

    try {
      const approveTx = await usdcContractWithSigner.approve(VAULT_CONTRACT_ADDRESS, amountToApprove);
      notify.dismiss(loadingToastId);
      setTxHash(approveTx.hash);
      notify.custom(() => (
          <span>Approval submitted! Tx: <a href={`https://peaq.subscan.io/tx/${approveTx.hash}`} target="_blank" rel="noopener noreferrer" className={styles.txLink}>{approveTx.hash.substring(0,10)}...</a> Waiting for confirmation...</span>
      ), { id: loadingToastId, duration: Infinity });

      await approveTx.wait(1); // Wait for 1 confirmation
      
      notify.dismiss(loadingToastId);
      notify.success("USDC successfully approved for Vault!");
      setCurrentAllowance(amountToApprove); // Optimistically update allowance
      setCurrentStep("deposit"); // Proceed to deposit step
    } catch (err: any) {
      console.error("Approval error:", err);
      notify.dismiss(loadingToastId);
      notify.error(err.reason || err.message || "Approval failed.");
      setErrorMessage(err.reason || err.message || "Failed to approve USDC. Please try again.");
      setCurrentStep("approve"); // Go back to approve step
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!account || !VAULT_CONTRACT_ADDRESS) {
      notify.error("Wallet not connected or Vault address not configured.");
      return;
    }
    const depositAmountStr = amount;
    if (!depositAmountStr || parseFloat(depositAmountStr) <= 0) {
      notify.error("Invalid deposit amount.");
      return;
    }
    
    let depositAmountBaseUnits: string;
    try {
        depositAmountBaseUnits = ethers.parseUnits(depositAmountStr, USDC_DECIMALS).toString();
    } catch {
        notify.error("Invalid amount format for deposit.");
        return;
    }

    setCurrentStep("depositing");
    setIsLoading(true);
    setErrorMessage(null);
    setTxHash(null);
    const loadingToastId = notify.loading("Processing deposit...");

    try {
      const response = await fetch('/api/vault/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: depositAmountBaseUnits, // Send amount in base units
          userWalletAddress: account, // API uses this as the 'from' address for transferFrom
        }),
      });

      notify.dismiss(loadingToastId);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Deposit failed (${response.status})`);
      }
      
      setTxHash(result.txHash);
      notify.success(result.message || "Deposit successful! Balance will update shortly.");
      setCurrentStep("success");
      refreshBalances(); // Refresh internal DEX balances
      checkAllowanceAndBalance(); // Re-check external wallet balance and allowance
    } catch (err: any) {
      console.error("Deposit API error:", err);
      notify.dismiss(loadingToastId);
      notify.error(err.message || "Deposit failed.");
      setErrorMessage(err.message || "Deposit via API failed. Please check transaction or try again.");
      setCurrentStep("error"); // Go to error step
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDone = () => {
    onClose();
    // Small delay to allow modal to close before resetting state,
    // to avoid flicker if reopened quickly.
    setTimeout(() => {
        setAmount('');
        setCurrentStep("input");
        setTxHash(null);
        setErrorMessage(null);
    }, 300);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleDone} title="Deposit USDC (REAL Mode)" size="md">
      <div className={styles.depositModalContent}>
        {!account && (
          <div className={styles.notice}>
            <AlertCircle size={20} /> Please connect your Peaq wallet to deposit USDC.
          </div>
        )}

        {USDC_CONTRACT_ADDRESS === "0xReplaceWithActualUSDConPeaqAddress" && isOpen && (
             <div className={`${styles.notice} ${styles.errorNotice}`}>
                <AlertCircle size={20} /> USDC Contract Address is not configured. Deposits are disabled.
            </div>
        )}
        {VAULT_CONTRACT_ADDRESS === "0xReplaceWithCoreVaultAddress" && isOpen && (
             <div className={`${styles.notice} ${styles.errorNotice}`}>
                <AlertCircle size={20} /> Vault Contract Address is not configured. Deposits are disabled.
            </div>
        )}

        {account && currentStep === "input" && (
          <>
            <div className={styles.balanceDisplay}>
              Your Wallet USDC Balance: 
              {isLoading && usdcBalanceExternal === null ? <SkeletonLoader width="80px" height="18px" className={styles.balanceSkeleton}/> : 
              <span className={styles.balanceValue}>{usdcBalanceExternal !== null ? parseFloat(usdcBalanceExternal).toFixed(2) : "N/A"} USDC</span>}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="depositAmount">Amount to Deposit</label>
              <div className={styles.amountInputWrapper}>
                <input
                  type="text" // Use text to better handle decimal input
                  id="depositAmount"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0.00"
                  disabled={isLoading}
                  className={styles.inputField}
                />
                <span className={styles.assetTicker}>USDC</span>
              </div>
            </div>
            <Button onClick={proceedToNextStep} disabled={isLoading || !amount || parseFloat(amount) <= 0} className={styles.actionButton} variant="primary">
              Next
            </Button>
          </>
        )}

        {account && currentStep === "approve" && (
          <div className={styles.stepContainer}>
            <h4>Step 1: Approve Vault to spend USDC</h4>
            <p>To deposit, you first need to grant the DEX Vault permission to transfer {amount} USDC from your wallet.</p>
            <p className={styles.contractInfo}>
                <span>USDC Contract: <a href={`https://peaq.subscan.io/account/${USDC_CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className={styles.addressLink}>{shortenAddress(USDC_CONTRACT_ADDRESS)}</a></span>
                <span>Vault Contract: <a href={`https://peaq.subscan.io/account/${VAULT_CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className={styles.addressLink}>{shortenAddress(VAULT_CONTRACT_ADDRESS)}</a></span>
            </p>
            <p>Current allowance: {currentAllowance !== null ? `${ethers.formatUnits(currentAllowance, USDC_DECIMALS)} USDC` : "Loading..."}</p>
            <Button onClick={handleApprove} isLoading={isLoading} className={styles.actionButton} variant="primary">
              Approve Vault for {amount} USDC
            </Button>
            <Button onClick={() => setCurrentStep("input")} variant="ghost" size="sm" className={styles.backButton}>Back</Button>
          </div>
        )}

         {account && currentStep === "approving" && (
          <div className={styles.stepContainer}>
            <h4>Approving USDC...</h4>
            <LoadingSpinner size={32} />
            <p>Please confirm the approval transaction in your wallet.</p>
            {txHash && <p className={styles.txInfo}>Tx: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLink}>{shortenAddress(txHash, 10)}</a></p>}
          </div>
        )}

        {account && currentStep === "deposit" && (
          <div className={styles.stepContainer}>
            <h4>Step 2: Confirm Deposit</h4>
            <p>You are about to deposit <strong>{amount} USDC</strong> into the DEX.</p>
            <p className={styles.infoSmall}>Your wallet allowance for the Vault is sufficient.</p>
             <Button onClick={handleDeposit} isLoading={isLoading} className={styles.actionButton} variant="primary">
              Confirm Deposit
            </Button>
            <Button onClick={() => setCurrentStep("input")} variant="ghost" size="sm" className={styles.backButton}>Back to Amount</Button>
          </div>
        )}

        {account && currentStep === "depositing" && (
          <div className={styles.stepContainer}>
            <h4>Depositing USDC...</h4>
            <LoadingSpinner size={32} />
            <p>Processing your deposit. Please confirm any transactions in your wallet if prompted by the API interaction (though typically server handles this part).</p>
             {txHash && <p className={styles.txInfo}>API Tx: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLink}>{shortenAddress(txHash, 10)}</a></p>}
          </div>
        )}

        {currentStep === "success" && (
          <div className={`${styles.stepContainer} ${styles.centered}`}>
            <CheckCircle size={48} className={styles.successIcon} />
            <h4>Deposit Successful!</h4>
            <p>{amount} USDC has been processed.</p>
            {txHash && <p className={styles.txInfo}>Confirmation Tx: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLink}>{shortenAddress(txHash, 10)}</a></p>}
            <p className={styles.infoSmall}>Your DEX balance will update shortly if not already reflected.</p>
            <Button onClick={handleDone} variant="primary" className={styles.actionButton}>Done</Button>
          </div>
        )}
        
        {currentStep === "error" && (
          <div className={`${styles.stepContainer} ${styles.centered}`}>
            <AlertCircle size={48} className={styles.errorIcon} />
            <h4>Deposit Failed</h4>
            <p className={styles.errorMessage}>{errorMessage || "An unknown error occurred."}</p>
            {txHash && <p className={styles.txInfo}>Failed Tx: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLink}>{shortenAddress(txHash, 10)}</a></p>}
            <Button onClick={handleDone} variant="secondary" className={styles.actionButton}>Close</Button>
          </div>
        )}
        
      </div>
    </Modal>
  );
};

// Helper to shorten addresses
const shortenAddress = (address: string, chars = 6): string => {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
};


export default DepositModal;