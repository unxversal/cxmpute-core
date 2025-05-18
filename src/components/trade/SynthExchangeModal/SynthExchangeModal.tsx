/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/SynthExchangeModal/SynthExchangeModal.tsx
"use client";

import React, { useState, useEffect, ChangeEvent, FormEvent, useMemo, useCallback } from 'react';
import styles from './SynthExchangeModal.module.css';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import { useAccountContext } from '@/contexts/AccountContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { useWallet } from '@/contexts/WalletContext';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import { ArrowRightLeft, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
import LoadingSpinner from '@/components/ui/LoadingSpinner/LoadingSpinner';
import { USDC_ASSET_INFO, SUPPORTED_SYNTH_ASSETS, USDC_ADDRESS } from '@/lib/references';
import { ethers, MaxUint256 } from 'ethers';
import { Resource } from 'sst'; // For Vault address
import type { PriceSnapshot } from '@/lib/interfaces';


const getAssetInfo = (assetSymbol: string): { name: string; symbol: string; decimals: number; baseForOracle?: string } | undefined => {
    if (assetSymbol === USDC_ASSET_INFO.symbol) return USDC_ASSET_INFO;
    return SUPPORTED_SYNTH_ASSETS.find(s => s.symbol === assetSymbol);
};

const formatBaseUnitsToDisplay = (baseUnitsStr: string | undefined | null, decimals: number): string => {
    if (baseUnitsStr === undefined || baseUnitsStr === null || baseUnitsStr === '') return '0.00';
    try {
        const displayAmount = ethers.formatUnits(BigInt(baseUnitsStr), decimals);
        return parseFloat(displayAmount).toFixed(Math.min(decimals, 6));
    } catch { return "Error"; }
};

const shortenAddress = (address: string, chars = 6): string => {
    if (!address || address.length < chars * 2 + 2) return address;
    return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
};

const erc20AbiMinimal = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() view returns (uint8)"
];

const VAULT_CONTRACT_ADDRESS = Resource.CoreVaultAddress.value;
const FACTORY_CONTRACT_ADDRESS = Resource.CoreFactoryAddress.value;
const USDC_CONTRACT_ADDRESS = USDC_ADDRESS;


interface SynthExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFromAsset?: string;
  initialToAsset?: string;
}

type ExchangeStep = "input" | "needs_approval" | "approving" | "ready_to_exchange" | "exchanging" | "success" | "error";

const SynthExchangeModal: React.FC<SynthExchangeModalProps> = ({
  isOpen,
  onClose,
  initialFromAsset,
  initialToAsset,
}) => {
  const { refreshBalances: refreshInternalDEXBalances } = useAccountContext();
  const { currentMode } = useTradingMode();
  const { account: connectedWalletAddress, provider, signer } = useWallet();

  const [fromAsset, setFromAsset] = useState<string>(initialFromAsset || USDC_ASSET_INFO.symbol);
  const [toAsset, setToAsset] = useState<string>(initialToAsset || SUPPORTED_SYNTH_ASSETS[0]?.symbol || "");
  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');

  const [currentStep, setCurrentStep] = useState<ExchangeStep>("input");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingExternal, setIsCheckingExternal] = useState(false);

  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [fromAssetExternalBalance, setFromAssetExternalBalance] = useState<string | null>(null);
  const [currentAllowance, setCurrentAllowance] = useState<bigint | null>(null);
  const [oraclePrice, setOraclePrice] = useState<number | null>(null);
  
  const [approvalData, setApprovalData] = useState<{tokenToApprove: string, spenderAddress: string, requiredAmountBaseUnits?: string} | null>(null);

  const fromAssetInfo = useMemo(() => getAssetInfo(fromAsset), [fromAsset]);
  const toAssetInfo = useMemo(() => getAssetInfo(toAsset), [toAsset]);

  const resetForm = useCallback(() => {
    const defaultFrom = initialFromAsset || USDC_ASSET_INFO.symbol;
    let defaultTo = initialToAsset || SUPPORTED_SYNTH_ASSETS[0]?.symbol || "";
    if (defaultTo === defaultFrom) {
        defaultTo = (defaultFrom === USDC_ASSET_INFO.symbol) ? SUPPORTED_SYNTH_ASSETS[0]?.symbol || "" : USDC_ASSET_INFO.symbol;
    }
    setFromAsset(defaultFrom);
    setToAsset(defaultTo);
    setFromAmount(''); setToAmount(''); setCurrentStep("input"); setIsLoading(false);
    setIsCheckingExternal(false); setTxHash(null); setErrorMessage(null);
    setFromAssetExternalBalance(null); setCurrentAllowance(null); setOraclePrice(null); setApprovalData(null);
  },[initialFromAsset, initialToAsset]);

  useEffect(() => { if (isOpen) resetForm(); }, [isOpen, resetForm]);

  const fetchExternalBalanceAndAllowance = useCallback(async () => {
    if (!isOpen || !connectedWalletAddress || !fromAssetInfo || !provider || !VAULT_CONTRACT_ADDRESS) {
      setFromAssetExternalBalance(null); setCurrentAllowance(null); return;
    }
    
    setIsCheckingExternal(true);
    try {
      let tokenContractAddress: string;
      if (fromAssetInfo.symbol === USDC_ASSET_INFO.symbol) {
        tokenContractAddress = USDC_CONTRACT_ADDRESS;
      } else {
        const factoryContract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, ["function getSynthBySymbol(string) view returns (address)"], provider);
        tokenContractAddress = await factoryContract.getSynthBySymbol(fromAssetInfo.symbol);
      }

      if (!tokenContractAddress || tokenContractAddress === ethers.ZeroAddress) {
        throw new Error(`Contract address for ${fromAssetInfo.symbol} not found.`);
      }
      setApprovalData(prev => ({...prev, tokenToApprove: tokenContractAddress, spenderAddress: VAULT_CONTRACT_ADDRESS}));


      const tokenContract = new ethers.Contract(tokenContractAddress, erc20AbiMinimal, provider);
      const [balanceBigInt, allowanceBigInt] = await Promise.all([
        tokenContract.balanceOf(connectedWalletAddress),
        tokenContract.allowance(connectedWalletAddress, VAULT_CONTRACT_ADDRESS),
      ]);
      setFromAssetExternalBalance(balanceBigInt.toString());
      setCurrentAllowance(allowanceBigInt);
    } catch (error: any) {
      console.error(`Error fetching balance/allowance for ${fromAssetInfo.symbol}:`, error);
      notify.error(`Could not fetch wallet balance/allowance for ${fromAssetInfo.symbol}.`);
      setFromAssetExternalBalance(null); setCurrentAllowance(null);
    } finally {
      setIsCheckingExternal(false);
    }
  }, [isOpen, connectedWalletAddress, fromAssetInfo, provider]);

  useEffect(() => {
    if (isOpen && connectedWalletAddress && fromAssetInfo && provider && VAULT_CONTRACT_ADDRESS && 
        (currentStep === "input" || currentStep === "needs_approval" || currentStep === "ready_to_exchange")) {
        fetchExternalBalanceAndAllowance();
    }
  }, [isOpen, connectedWalletAddress, fromAssetInfo, provider, currentStep, fetchExternalBalanceAndAllowance]);

  const fetchIndicativeOraclePrice = useCallback(async () => {
    if (!isOpen || !fromAssetInfo || !toAssetInfo || fromAssetInfo.symbol === toAssetInfo.symbol) {
      setOraclePrice(null); return;
    }
    const sAssetInvolved = fromAssetInfo.baseForOracle ? fromAssetInfo : toAssetInfo;
    if (!sAssetInvolved?.baseForOracle) { setOraclePrice(null); return; }

    try {
      const params = new URLSearchParams({ asset: sAssetInvolved.baseForOracle });
      const response = await fetch(`/api/prices?${params.toString()}`); // Ensure this endpoint returns the latest oracle price
      if (!response.ok) throw new Error("Failed to fetch oracle price.");
      const priceData: PriceSnapshot[] | PriceSnapshot = await response.json();
      const latestPrice = Array.isArray(priceData) ? priceData[0]?.price : priceData?.price;

      if (typeof latestPrice === 'number' && latestPrice > 0) setOraclePrice(latestPrice);
      else { setOraclePrice(null); console.warn(`Oracle price for ${sAssetInvolved.baseForOracle} not found or invalid.`); }
    } catch (error) { console.error("Error fetching oracle price:", error); setOraclePrice(null); }
  }, [isOpen, fromAssetInfo, toAssetInfo]);

  useEffect(() => { fetchIndicativeOraclePrice(); }, [fetchIndicativeOraclePrice]);

  useEffect(() => {
    if (fromAmount && fromAssetInfo && toAssetInfo && oraclePrice && parseFloat(fromAmount) > 0) {
      const amountFromNum = parseFloat(fromAmount);
      let calculatedToAmountNum: number;
      if (fromAssetInfo.symbol === USDC_ASSET_INFO.symbol) {
        calculatedToAmountNum = amountFromNum / oraclePrice;
      } else {
        calculatedToAmountNum = amountFromNum * oraclePrice;
      }
      setToAmount(calculatedToAmountNum > 0 ? calculatedToAmountNum.toFixed(toAssetInfo.decimals) : '0.00');
    } else {
      setToAmount('');
    }
  }, [fromAmount, fromAssetInfo, toAssetInfo, oraclePrice]);


  const handleFromAssetChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setFromAsset(e.target.value); setFromAmount(''); setToAmount(''); setCurrentStep("input"); setApprovalData(null);
  };
  const handleToAssetChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setToAsset(e.target.value); setFromAmount(''); setToAmount(''); setCurrentStep("input"); setApprovalData(null);
  };
  const handleSwapAssets = () => {
    setFromAsset(toAsset); setToAsset(fromAsset); setFromAmount(''); setToAmount(''); setCurrentStep("input"); setApprovalData(null);
  };
  const setMaxFromAmount = () => {
    if (fromAssetExternalBalance && fromAssetInfo) {
        setFromAmount(ethers.formatUnits(BigInt(fromAssetExternalBalance), fromAssetInfo.decimals));
    }
  };

  const handleApprove = async () => {
    if (!signer || !approvalData?.tokenToApprove || !approvalData?.spenderAddress || !fromAssetInfo) {
        notify.error("Wallet not connected or approval data missing."); return;
    }
    setCurrentStep("approving"); setIsLoading(true); setErrorMessage(null); setTxHash(null);
    const loadingToastId = notify.loading(`Requesting approval for ${fromAssetInfo.symbol}...`);
    try {
        const tokenContract = new ethers.Contract(approvalData.tokenToApprove, erc20AbiMinimal, signer);
        const approveTx = await tokenContract.approve(approvalData.spenderAddress, MaxUint256);
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
        notify.dismiss(loadingToastId);
        notify.success(`${fromAssetInfo.symbol} approved successfully!`);
        await fetchExternalBalanceAndAllowance(); // Re-check allowance
        setCurrentStep("ready_to_exchange");
    } catch (err: any) {
        console.error("Approval error:", err);
        notify.dismiss(loadingToastId);
        notify.error(err.reason || err.message || `Approval for ${fromAssetInfo.symbol} failed.`);
        setErrorMessage(err.reason || err.message || `Failed to approve ${fromAssetInfo.symbol}.`);
        setCurrentStep("needs_approval");
    } finally { setIsLoading(false); }
  };

  const handleSubmitExchange = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!fromAssetInfo || !toAssetInfo || !VAULT_CONTRACT_ADDRESS) {
      notify.error("Invalid asset selection or Vault address not configured."); return;
    }
    const amountNum = parseFloat(fromAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      notify.error("Please enter a valid positive amount."); return;
    }
    const fromBalanceNum = fromAssetExternalBalance ? parseFloat(ethers.formatUnits(BigInt(fromAssetExternalBalance), fromAssetInfo.decimals)) : 0;
    const epsilon = 1 / (10 ** (fromAssetInfo.decimals + 2)); // Increased precision for epsilon
    if (amountNum > fromBalanceNum + epsilon) {
      notify.error(`Amount exceeds your wallet balance of ${fromAssetInfo.symbol}. Available: ${fromBalanceNum.toFixed(fromAssetInfo.decimals)}`); return;
    }
    
    // Always re-check allowance right before submitting the exchange request, unless we just approved.
    if (currentStep !== "ready_to_exchange") { // if not coming directly from successful approval
        await fetchExternalBalanceAndAllowance(); // This updates currentAllowance state
        const requiredAmountBigInt = ethers.parseUnits(fromAmount, fromAssetInfo.decimals);
        if (currentAllowance === null || currentAllowance < requiredAmountBigInt) {
             setApprovalData(prev => ({...prev!, tokenToApprove: prev!.tokenToApprove || (fromAssetInfo.symbol === USDC_ASSET_INFO.symbol ? USDC_CONTRACT_ADDRESS : ""), spenderAddress: VAULT_CONTRACT_ADDRESS, requiredAmountBaseUnits: requiredAmountBigInt.toString() }));
             setCurrentStep("needs_approval");
             setErrorMessage(`Vault requires approval for ${fromAmount} ${fromAssetInfo.symbol}.`);
             return;
        }
    }
    
    const amountInBaseUnits = ethers.parseUnits(fromAmount, fromAssetInfo.decimals).toString();

    setCurrentStep("exchanging"); setIsLoading(true); setErrorMessage(null); setTxHash(null);
    const loadingToastId = notify.loading(`Exchanging ${fromAssetInfo.symbol} for ${toAssetInfo.symbol}...`);

    try {
      const response = await fetch('/api/synths/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAsset: fromAssetInfo.symbol, toAsset: toAssetInfo.symbol, amount: amountInBaseUnits, mode: currentMode }),
      });
      const result = await response.json();
      notify.dismiss(loadingToastId);

      if (!response.ok) {
        // If API explicitly says needsApproval even after our client-side check (rare, but possible due to race or complex logic)
        if (result.needsApproval) {
            setApprovalData({ tokenToApprove: result.tokenToApprove, spenderAddress: result.spenderAddress, requiredAmountBaseUnits: result.requiredAmountBaseUnits });
            setErrorMessage(result.error); setCurrentStep("needs_approval"); return;
        }
        throw new Error(result.error || `Exchange failed (${response.status})`);
      }
      
      setTxHash(result.txHash);
      notify.success(result.message || `Successfully exchanged!`);
      setCurrentStep("success");
      refreshInternalDEXBalances(); 
      await fetchExternalBalanceAndAllowance(); // Refresh external wallet balances and allowance after successful exchange
    } catch (err: any) {
      console.error("Synth exchange error:", err);
      notify.dismiss(loadingToastId);
      notify.error(err.message || "Exchange failed.");
      setErrorMessage(err.message || "Exchange API failed.");
      setCurrentStep("error");
    } finally { setIsLoading(false); }
  };
  
  const handleDone = () => { onClose(); };
  const allAssetsForDropdown = [USDC_ASSET_INFO, ...SUPPORTED_SYNTH_ASSETS];

  const renderContent = () => { /* ... (same as before, no significant changes needed for this part from previous draft based on prompt) ... */
    if (!isOpen) return null;
    if (currentMode !== "REAL") return <div className={`${styles.notice} ${styles.errorNotice}`}><AlertCircle size={20}/> sAsset exchange is only available in REAL trading mode.</div>
    if (!connectedWalletAddress) return <div className={styles.notice}><AlertCircle size={20}/> Please connect your Peaq wallet to exchange assets.</div>
    if (!USDC_CONTRACT_ADDRESS || !VAULT_CONTRACT_ADDRESS || !FACTORY_CONTRACT_ADDRESS) return <div className={`${styles.notice} ${styles.errorNotice}`}><AlertCircle size={20}/> On-chain contract addresses not configured. Exchange disabled.</div>;


    switch (currentStep) {
      case "input":
      case "ready_to_exchange":
        return (
          <form onSubmit={handleSubmitExchange} className={styles.exchangeForm}>
            <div className={styles.fieldGroup}>
              <label htmlFor="fromAssetSelect">From</label>
              <div className={styles.assetInputWrapper}>
                <select id="fromAssetSelect" value={fromAsset} onChange={handleFromAssetChange} className={styles.assetSelect} disabled={isLoading || isCheckingExternal}>
                  {allAssetsForDropdown.map(asset => (
                    <option key={`from-${asset.symbol}`} value={asset.symbol} disabled={asset.symbol === toAsset}>
                      {asset.name} ({asset.symbol})
                    </option>
                  ))}
                </select>
                <input type="text" value={fromAmount} onChange={(e) => setFromAmount(e.target.value)} placeholder="0.00" required className={styles.amountInput} disabled={isLoading || isCheckingExternal}/>
              </div>
              <div className={styles.balanceInfo}>
                <span>Wallet Balance: {isCheckingExternal ? <SkeletonLoader width="70px" height="14px"/> : (fromAssetExternalBalance && fromAssetInfo ? formatBaseUnitsToDisplay(fromAssetExternalBalance, fromAssetInfo.decimals) : '0.00')} {fromAssetInfo?.symbol}</span>
                <Button type="button" variant="ghost" size="sm" onClick={setMaxFromAmount} className={styles.maxButton} disabled={isLoading || isCheckingExternal || !fromAssetExternalBalance}>MAX</Button>
              </div>
            </div>

            <div className={styles.swapButtonContainer}>
              <Button type="button" variant="outline" onClick={handleSwapAssets} iconLeft={<ArrowRightLeft size={16}/>} aria-label="Swap assets" disabled={isLoading || isCheckingExternal}>
                Swap Assets
              </Button>            
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="toAssetSelect">To</label>
              <div className={styles.assetInputWrapper}>
                <select id="toAssetSelect" value={toAsset} onChange={handleToAssetChange} className={styles.assetSelect} disabled={isLoading || isCheckingExternal}>
                    {allAssetsForDropdown.map(asset => (
                        <option key={`to-${asset.symbol}`} value={asset.symbol} disabled={asset.symbol === fromAsset}>
                        {asset.name} ({asset.symbol})
                        </option>
                    ))}
                </select>
                <input type="text" value={toAmount} placeholder="~ Estimated amount" readOnly disabled className={`${styles.amountInput} ${styles.readOnlyAmount}`}/>
              </div>
            </div>
            
            {oraclePrice && fromAssetInfo && toAssetInfo && fromAssetInfo.baseForOracle && toAssetInfo.baseForOracle && (
                <div className={styles.indicativePrice}>
                    1 {fromAssetInfo.symbol === USDC_ASSET_INFO.symbol ? fromAssetInfo.symbol : fromAssetInfo.baseForOracle}
                    {' ≈ '}
                    {fromAssetInfo.symbol === USDC_ASSET_INFO.symbol ? (1 / oraclePrice).toFixed(toAssetInfo.decimals) : oraclePrice.toFixed(USDC_ASSET_INFO.decimals)}
                    {' '}
                    {toAssetInfo.symbol === USDC_ASSET_INFO.symbol ? toAssetInfo.symbol : toAssetInfo.baseForOracle}
                </div>
            )}


            <div className={styles.modalActions}>
              <Button type="button" variant="secondary" onClick={handleDone} disabled={isLoading}>Cancel</Button>
              <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading || isCheckingExternal || !fromAssetInfo || !toAssetInfo || !fromAmount || parseFloat(fromAmount) <= 0}>
                {currentStep === "ready_to_exchange" ? "Exchange Now" : "Review & Exchange"}
              </Button>
            </div>
          </form>
        );
    
      case "needs_approval":
        return (
            <div className={styles.stepContainer}>
                <h4>Approval Required</h4>
                <p>{errorMessage || `The DEX Vault needs your permission to spend your ${fromAssetInfo?.symbol}.`} This is a one-time approval for this token (or until revoked).</p>
                {approvalData && (
                    <p className={styles.infoSmall}>
                        Token to Approve: {shortenAddress(approvalData.tokenToApprove)}<br/>
                        Spender (Vault): {shortenAddress(approvalData.spenderAddress)}
                    </p>
                )}
                <p>Current Allowance: {isCheckingExternal ? <SkeletonLoader width="80px" height="14px"/> : (currentAllowance !== null && fromAssetInfo ? `${formatBaseUnitsToDisplay(currentAllowance.toString(), fromAssetInfo.decimals)} ${fromAssetInfo.symbol}` : "Not checked")}</p>
                <div className={styles.confirmActions}>
                    <Button onClick={() => {setCurrentStep("input"); setErrorMessage(null);}} variant="ghost" size="sm" className={styles.backButton} disabled={isLoading}>Back</Button>
                    <Button onClick={handleApprove} isLoading={isLoading} className={styles.actionButtonConfirm} variant="primary">
                        Approve {fromAssetInfo?.symbol}
                    </Button>
                </div>
            </div>
        );

      case "approving":
      case "exchanging":
        return (
            <div className={styles.stepContainer}>
                <h4>{currentStep === "approving" ? `Approving ${fromAssetInfo?.symbol}` : `Exchanging Assets`}...</h4>
                <LoadingSpinner size={32} />
                <p>Please confirm the transaction in your wallet and wait for blockchain confirmation.</p>
                {txHash && <p className={styles.txInfo}>Tx: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLinkModal}>{shortenAddress(txHash, 10)} <ExternalLink size={12}/></a></p>}
            </div>
        );

      case "success":
        return (
            <div className={`${styles.stepContainer} ${styles.centered}`}>
                <CheckCircle size={48} className={styles.successIcon} />
                <h4>Exchange Successful!</h4>
                <p>Exchanged {fromAmount} {fromAssetInfo?.symbol} for approx. {toAmount} {toAssetInfo?.symbol}.</p>
                {txHash && <p className={styles.txInfo}>Confirmation Tx: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLinkModal}>{shortenAddress(txHash, 10)} <ExternalLink size={12}/></a></p>}
                <p className={styles.infoSmall}>Your wallet balances have been updated.</p>
                <Button onClick={handleDone} variant="primary" className={styles.actionButton}>Done</Button>
            </div>
        );
        
      case "error":
        return (
            <div className={`${styles.stepContainer} ${styles.centered}`}>
                <AlertCircle size={48} className={styles.errorIcon} />
                <h4>Exchange Failed</h4>
                <p className={styles.errorMessageModal}>{errorMessage || "An unknown error occurred."}</p>
                {txHash && <p className={styles.txInfo}>Failed Tx Attempt: <a href={`https://peaq.subscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLinkModal}>{shortenAddress(txHash, 10)} <ExternalLink size={12}/></a></p>}
                <div className={styles.confirmActions}>
                    <Button onClick={() => { setCurrentStep("input"); setErrorMessage(null);}} variant="secondary" size="sm" className={styles.backButton} disabled={isLoading}>Try Again</Button>
                    <Button onClick={handleDone} variant="ghost" className={styles.actionButton}>Close</Button>
                </div>
            </div>
        );
      default: return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleDone} title="Exchange On-Chain Assets" size="md">
        {renderContent()}
    </Modal>
  );
};

export default SynthExchangeModal;