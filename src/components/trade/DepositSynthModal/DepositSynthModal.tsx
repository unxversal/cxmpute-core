/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/DepositSynthModal/DepositSynthModal.tsx
"use client";

import React, { useState, useEffect, ChangeEvent, useCallback, useMemo } from 'react';
import styles from './DepositSynthModal.module.css';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import { useAccountContext } from '@/contexts/AccountContext';
import { useWallet } from '@/contexts/WalletContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import { ethers, MaxUint256 } from 'ethers';
import { AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
import LoadingSpinner from '@/components/ui/LoadingSpinner/LoadingSpinner';
import { SUPPORTED_SYNTH_ASSETS } from '@/lib/references';
import { Resource } from 'sst';

const VAULT_CONTRACT_ADDRESS = Resource.CoreVaultAddress.value;
const FACTORY_CONTRACT_ADDRESS = Resource.CoreFactoryAddress.value;

const erc20AbiMinimal = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const factoryAbiMinimalForSynthDeposit = ["function getSynthBySymbol(string calldata symbol) external view returns (address synthContract)"];

const getSynthAssetInfo = (symbol: string) => SUPPORTED_SYNTH_ASSETS.find(s => s.symbol === symbol);

const formatBaseUnitsToDisplay = (baseUnitsStr: string | undefined | null, decimals: number): string => {
    if (baseUnitsStr === undefined || baseUnitsStr === null || baseUnitsStr === '') return '0.00';
    try {
        const displayAmount = ethers.formatUnits(BigInt(baseUnitsStr), decimals);
        // Show more precision for values less than 1, up to asset's decimals, capped at a reasonable number like 6 for display
        const displayPrecision = Math.min(decimals, 6);
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

interface DepositSynthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSynthSymbol?: string;
}

type Step = "input" | "needs_approval" | "approving" | "deposit" | "depositing" | "success" | "error";

const DepositSynthModal: React.FC<DepositSynthModalProps> = ({ isOpen, onClose, initialSynthSymbol }) => {
  const { refreshBalances } = useAccountContext();
  const { account: connectedWalletAddress, provider, signer, status: walletStatus } = useWallet();
  const { currentMode } = useTradingMode();

  const [selectedSynthSymbol, setSelectedSynthSymbol] = useState<string>(initialSynthSymbol || SUPPORTED_SYNTH_ASSETS[0]?.symbol || "");
  const [amount, setAmount] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<Step>("input");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingExternalData, setIsFetchingExternalData] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [externalSynthBalance, setExternalSynthBalance] = useState<string | null>(null);
  const [currentAllowance, setCurrentAllowance] = useState<bigint | null>(null);
  const [sAssetContractAddress, setSAssetContractAddress] = useState<string | null>(null);

  const selectedSynthInfo = useMemo(() => getSynthAssetInfo(selectedSynthSymbol), [selectedSynthSymbol]);

  const resetForm = useCallback(() => {
    setSelectedSynthSymbol(initialSynthSymbol || SUPPORTED_SYNTH_ASSETS[0]?.symbol || "");
    setAmount(''); setCurrentStep("input"); setIsLoading(false); setIsFetchingExternalData(false);
    setTxHash(null); setErrorMessage(null); setExternalSynthBalance(null);
    setCurrentAllowance(null); setSAssetContractAddress(null);
  },[initialSynthSymbol]);

  useEffect(() => { if (isOpen) resetForm(); }, [isOpen, resetForm]);

  const fetchExternalBalanceAndAllowance = useCallback(async () => {
    if (!isOpen || !connectedWalletAddress || !selectedSynthInfo || !provider || !VAULT_CONTRACT_ADDRESS || !FACTORY_CONTRACT_ADDRESS) {
      setExternalSynthBalance(null); setCurrentAllowance(null); setSAssetContractAddress(null); return;
    }
    
    setIsFetchingExternalData(true);
    try {
      const factoryContract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, factoryAbiMinimalForSynthDeposit, provider);
      const sAssetAddr = await factoryContract.getSynthBySymbol(selectedSynthInfo.symbol);

      if (!sAssetAddr || sAssetAddr === ethers.ZeroAddress) {
        throw new Error(`sAsset contract for ${selectedSynthInfo.symbol} not found.`);
      }
      setSAssetContractAddress(sAssetAddr);

      const tokenContract = new ethers.Contract(sAssetAddr, erc20AbiMinimal, provider);
      const [balanceBigInt, allowanceBigInt] = await Promise.all([
        tokenContract.balanceOf(connectedWalletAddress),
        tokenContract.allowance(connectedWalletAddress, VAULT_CONTRACT_ADDRESS),
      ]);
      setExternalSynthBalance(balanceBigInt.toString());
      setCurrentAllowance(allowanceBigInt);
    } catch (error: any) {
      console.error(`Error fetching external data for ${selectedSynthInfo.symbol}:`, error);
      notify.error(`Could not fetch wallet balance/allowance for ${selectedSynthInfo.symbol}.`);
      setExternalSynthBalance(null); setCurrentAllowance(null); setSAssetContractAddress(null);
    } finally {
      setIsFetchingExternalData(false);
    }
  }, [isOpen, connectedWalletAddress, selectedSynthInfo, provider]);

  useEffect(() => {
    if (isOpen && connectedWalletAddress && selectedSynthInfo && provider && VAULT_CONTRACT_ADDRESS && FACTORY_CONTRACT_ADDRESS && 
        (currentStep === "input" || currentStep === "needs_approval" || currentStep === "deposit")) {
        fetchExternalBalanceAndAllowance();
    }
  }, [isOpen, connectedWalletAddress, selectedSynthInfo, provider, currentStep, fetchExternalBalanceAndAllowance]);


  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) setAmount(value);
  };

  const handleSynthChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedSynthSymbol(e.target.value); setAmount(''); setCurrentStep("input");
  };

  const proceedToNextStep = async () => {
    if (!connectedWalletAddress || !sAssetContractAddress) {
        notify.error("Wallet not connected or sAsset contract not resolved."); return;
    }
    if (!selectedSynthInfo) { notify.error("Select an sAsset."); return; }
    const depositAmountStr = amount;
    if (!depositAmountStr || parseFloat(depositAmountStr) <= 0) {
      notify.error("Please enter a valid deposit amount."); return;
    }
    let depositAmountBigInt: bigint;
    try { depositAmountBigInt = ethers.parseUnits(depositAmountStr, selectedSynthInfo.decimals); }
    catch { notify.error("Invalid amount format or too many decimals."); return; }

    if (externalSynthBalance) {
        const externalBalanceBigInt = BigInt(externalSynthBalance);
        if (depositAmountBigInt > externalBalanceBigInt) {
            notify.error("Deposit amount exceeds your wallet's sAsset balance."); return;
        }
    } else { // If balance couldn't be fetched, we might allow proceeding but it's risky
        notify.error(`Could not verify your ${selectedSynthInfo.symbol} wallet balance. Proceed with caution.`);
    }

    await fetchExternalBalanceAndAllowance(); // Re-check allowance
    if (currentAllowance === null) { notify.error("Could not verify Vault allowance for the sAsset."); return; }

    if (currentAllowance >= depositAmountBigInt) setCurrentStep("deposit");
    else setCurrentStep("needs_approval");
  };

  const handleApprove = async () => {
    if (!signer || !sAssetContractAddress || !VAULT_CONTRACT_ADDRESS || !selectedSynthInfo) {
        notify.error("Wallet not connected or contract/asset info missing for approval."); return;
    }
    const amountToApprove = MaxUint256;

    setCurrentStep("approving"); setIsLoading(true); setErrorMessage(null); setTxHash(null);
    const loadingToastId = notify.loading(`Requesting approval for ${selectedSynthInfo.symbol}...`);

    try {
      const tokenContract = new ethers.Contract(sAssetContractAddress, erc20AbiMinimal, signer);
      const approveTx = await tokenContract.approve(VAULT_CONTRACT_ADDRESS, amountToApprove);
      setTxHash(approveTx.hash);
      notify.dismiss(loadingToastId);
      let loadingTId
        notify.custom((t) => {

          loadingTId = t.id;
          
          return (
            <span>Approval submitted! Tx: 
                <a href={`https://peaq.subscan.io/tx/${approveTx.hash}`} target="_blank" rel="noopener noreferrer" className={styles.txLinkModal}>
                    {shortenAddress(approveTx.hash, 10)} <ExternalLink size={12}/>
                </a> Waiting for confirmation...
            </span>
        )}, { id: loadingTId, duration: Infinity });
      await approveTx.wait(1);
      notify.dismiss(loadingTId || loadingToastId);
      notify.success(`${selectedSynthInfo.symbol} approved successfully!`);
      await fetchExternalBalanceAndAllowance(); // Refresh allowance state
      setCurrentStep("deposit");
    } catch (err: any) {
      console.error(`${selectedSynthInfo.symbol} Approval error:`, err);
      notify.dismiss(loadingToastId);
      notify.error(err.reason || err.message || `${selectedSynthInfo.symbol} approval failed.`);
      setErrorMessage(err.reason || err.message || `Failed to approve ${selectedSynthInfo.symbol}.`);
      setCurrentStep("needs_approval");
    } finally { setIsLoading(false); }
  };

  const handleDeposit = async () => {
    if (!connectedWalletAddress || !sAssetContractAddress || !selectedSynthInfo) {
      notify.error("Wallet not connected or sAsset info missing."); return;
    }
    const depositAmountStr = amount;
    let depositAmountBaseUnits: string;
    try { depositAmountBaseUnits = ethers.parseUnits(depositAmountStr, selectedSynthInfo.decimals).toString(); }
    catch { notify.error("Invalid amount format for deposit."); return; }

    setCurrentStep("depositing"); setIsLoading(true); setErrorMessage(null); setTxHash(null);
    const loadingToastId = notify.loading(`Processing ${selectedSynthInfo.symbol} deposit...`);

    try {
      const response = await fetch('/api/vault/depositsynth', { // Correct API endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ synthSymbol: selectedSynthInfo.symbol, amount: depositAmountBaseUnits, mode: currentMode }),
      });
      const result = await response.json();
      notify.dismiss(loadingToastId);

      if (!response.ok) throw new Error(result.error || `sAsset Deposit failed (${response.status})`);
      
      setTxHash(result.txHash);
      notify.success(result.message || `${selectedSynthInfo.symbol} deposit successful!`);
      setCurrentStep("success");
      refreshBalances(); // Refresh internal DEX balances
      await fetchExternalBalanceAndAllowance(); // Re-check external wallet balance and allowance
    } catch (err: any) {
      console.error("sAsset Deposit API error:", err);
      notify.dismiss(loadingToastId);
      notify.error(err.message || `Deposit of ${selectedSynthInfo.symbol} failed.`);
      setErrorMessage(err.message || `Deposit of ${selectedSynthInfo.symbol} failed.`);
      setCurrentStep("error");
    } finally { setIsLoading(false); }
  };
  
  const handleDone = () => { onClose(); };

  const setMaxAmount = () => {
    if (externalSynthBalance && selectedSynthInfo) {
        setAmount(ethers.formatUnits(BigInt(externalSynthBalance), selectedSynthInfo.decimals));
    }
  };
  
  const isNextDisabled = isLoading || isFetchingExternalData || !amount || parseFloat(amount) <= 0 || 
                        (externalSynthBalance !== null && parseFloat(amount) > parseFloat(ethers.formatUnits(BigInt(externalSynthBalance), selectedSynthInfo?.decimals || 0)));

  return (
    <Modal isOpen={isOpen} onClose={handleDone} title={`Deposit Synthetic Asset (${currentMode})`} size="md">
      <div className={styles.depositSynthModalContent}>
        {currentMode !== "REAL" && isOpen && (
            <div className={`${styles.notice} ${styles.errorNotice}`}><AlertCircle size={20}/> sAsset deposits are only available in REAL trading mode.</div>
        )}
        {(!connectedWalletAddress && currentMode === "REAL" && isOpen && walletStatus !== "CONNECTING") && (
          <div className={styles.notice}><AlertCircle size={20} /> Please connect your Peaq wallet to deposit sAssets.</div>
        )}
        {(!FACTORY_CONTRACT_ADDRESS || !VAULT_CONTRACT_ADDRESS) && isOpen && (
             <div className={`${styles.notice} ${styles.errorNotice}`}><AlertCircle size={20} /> On-chain contract addresses not configured. Deposits disabled.</div>
        )}

        {currentMode === "REAL" && connectedWalletAddress && walletStatus === 'CONNECTED' && FACTORY_CONTRACT_ADDRESS && VAULT_CONTRACT_ADDRESS && (
          <>
            {currentStep === "input" && (
              <>
                <div className={styles.formGroup}>
                  <label htmlFor="depositSynthSelect">Select sAsset to Deposit</label>
                  <select id="depositSynthSelect" value={selectedSynthSymbol} onChange={handleSynthChange} className={styles.assetSelect} disabled={isLoading || isFetchingExternalData}>
                    {SUPPORTED_SYNTH_ASSETS.map(asset => (
                      <option key={asset.symbol} value={asset.symbol}>
                        {asset.name} ({asset.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.balanceInfo}>
                  Wallet Balance: 
                  {isFetchingExternalData && externalSynthBalance === null ? <SkeletonLoader width="80px" height="18px" className={styles.balanceSkeleton}/> : 
                  <span className={styles.balanceValue}>
                    {externalSynthBalance && selectedSynthInfo ? formatBaseUnitsToDisplay(externalSynthBalance, selectedSynthInfo.decimals) : "0.00"} {selectedSynthInfo?.symbol}
                  </span>}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="depositSynthAmount">Amount to Deposit</label>
                  <div className={styles.amountInputWrapper}>
                    <input type="text" id="depositSynthAmount" value={amount} onChange={handleAmountChange} placeholder={`0.00${'0'.repeat(Math.max(0, (selectedSynthInfo?.decimals || 2)-2))}`} disabled={isLoading || isFetchingExternalData} className={styles.inputField}/>
                    <span className={styles.assetTicker}>{selectedSynthInfo?.symbol}</span>
                  </div>
                   <div className={styles.maxButtonContainer}>
                        <Button type="button" variant="ghost" size="sm" onClick={setMaxAmount} className={styles.maxButton} disabled={isLoading || isFetchingExternalData || !externalSynthBalance}>MAX</Button>
                    </div>
                </div>
                <Button onClick={proceedToNextStep} disabled={isNextDisabled} className={styles.actionButton} variant="primary">Next</Button>
              </>
            )}

            {currentStep === "needs_approval" && selectedSynthInfo && (
              <div className={styles.stepContainer}>
                <h4>Step 1: Approve Vault for {selectedSynthInfo.symbol}</h4>
                <p>The DEX Vault needs permission to transfer {amount} {selectedSynthInfo.symbol} from your wallet.</p>
                {sAssetContractAddress && (
                    <div className={styles.contractInfo}>
                        <span>Your Wallet: {shortenAddress(connectedWalletAddress)}</span>
                        <span>{selectedSynthInfo.symbol} Contract: <a href={`https://peaq.subscan.io/account/${sAssetContractAddress}`} target="_blank" rel="noopener noreferrer" className={styles.addressLinkModal}>{shortenAddress(sAssetContractAddress)} <ExternalLink size={10}/></a></span>
                        <span>Vault Contract (Spender): <a href={`https://peaq.subscan.io/account/${VAULT_CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className={styles.addressLinkModal}>{shortenAddress(VAULT_CONTRACT_ADDRESS)} <ExternalLink size={10}/></a></span>
                    </div>
                )}
                <p>Current Allowance: {isFetchingExternalData ? <SkeletonLoader width="60px" height="14px"/> : (currentAllowance !== null ? `${formatBaseUnitsToDisplay(currentAllowance.toString(), selectedSynthInfo.decimals)} ${selectedSynthInfo.symbol}` : "Checking...")}</p>
                <Button onClick={handleApprove} isLoading={isLoading} className={styles.actionButtonConfirm} variant="primary">Approve {selectedSynthInfo.symbol}</Button>
                <Button onClick={() => setCurrentStep("input")} variant="ghost" size="sm" className={styles.backButton} disabled={isLoading}>Back</Button>
              </div>
            )}

            {currentStep === "approving" && (
              <div className={styles.stepContainer}>
                <h4>Approving {selectedSynthInfo?.symbol}...</h4>
                <LoadingSpinner size={32} />
                <p>Please confirm the approval transaction in your wallet.</p>
                {txHash && <p className={styles.txInfo}>Tx: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLinkModal}>{shortenAddress(txHash, 10)} <ExternalLink size={12}/></a></p>}
              </div>
            )}

            {currentStep === "deposit" && selectedSynthInfo && (
              <div className={styles.stepContainer}>
                <h4>Step 2: Confirm Deposit of {selectedSynthInfo.symbol}</h4>
                <p>You are about to deposit <strong>{amount} {selectedSynthInfo.symbol}</strong> into the DEX Vault.</p>
                <p className={styles.infoSmall}>Your wallet allowance for the Vault is sufficient.</p>
                <Button onClick={handleDeposit} isLoading={isLoading} className={styles.actionButtonConfirm} variant="primary">Confirm Deposit</Button>
                <Button onClick={() => setCurrentStep("input")} variant="ghost" size="sm" className={styles.backButton} disabled={isLoading}>Back</Button>
              </div>
            )}

            {currentStep === "depositing" && (
              <div className={styles.stepContainer}>
                <h4>Depositing {selectedSynthInfo?.symbol}...</h4>
                <LoadingSpinner size={32} />
                <p>Processing your sAsset deposit. The backend will interact with the Vault contract.</p>
                {txHash && <p className={styles.txInfo}>Initiated Deposit Tx: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLinkModal}>{shortenAddress(txHash, 10)} <ExternalLink size={12}/></a></p>}
              </div>
            )}
            
            {currentStep === "success" && (
              <div className={`${styles.stepContainer} ${styles.centered}`}>
                <CheckCircle size={48} className={styles.successIcon} />
                <h4>{selectedSynthInfo?.symbol} Deposit Successful!</h4>
                <p>{amount} {selectedSynthInfo?.symbol} processed and credited to your DEX account.</p>
                {txHash && <p className={styles.txInfo}>Confirmation Tx: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLinkModal}>{shortenAddress(txHash, 10)} <ExternalLink size={12}/></a></p>}
                <Button onClick={handleDone} variant="primary" className={styles.actionButton}>Done</Button>
              </div>
            )}
            
            {currentStep === "error" && (
              <div className={`${styles.stepContainer} ${styles.centered}`}>
                <AlertCircle size={48} className={styles.errorIcon} />
                <h4>{selectedSynthInfo?.symbol || "sAsset"} Deposit Failed</h4>
                <p className={styles.errorMessageModal}>{errorMessage || "An unknown error occurred."}</p>
                {txHash && <p className={styles.txInfo}>Failed Tx Attempt: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLinkModal}>{shortenAddress(txHash, 10)} <ExternalLink size={12}/></a></p>}
                <div className={styles.confirmActions}>
                    <Button onClick={() => setCurrentStep("input")} variant="secondary" size="sm" className={styles.backButton} disabled={isLoading}>Try Again</Button>
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

export default DepositSynthModal;