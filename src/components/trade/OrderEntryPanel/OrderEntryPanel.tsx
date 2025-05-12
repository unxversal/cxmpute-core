/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/OrderEntryPanel/OrderEntryPanel.tsx
"use client";

import React, { useState, useEffect, ChangeEvent, FormEvent, useMemo } from 'react';
import styles from './OrderEntryPanel.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { useMarketContext } from '@/contexts/MarketContext';
import { useAccountContext } from '@/contexts/AccountContext';
import { useWebSocket } from '@/contexts/WebsocketContext';
import {
    useOrderEntry,
    OrderFormState, // This is the form state structure from OrderEntryContext
    OrderEntryOrderType,
    // OrderEntryOrderSide, // Defined locally or used from formState
    // FormOptionType, // Defined locally or used from formState
} from '@/contexts/OrderEntryContext';

import Button from '@/components/ui/Button/Button';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type {
    UnderlyingPairMeta,
    InstrumentMarketMeta,
    DerivativeType,
    TradingMode, // For constructing PKs
} from '@/lib/interfaces';
import { TrendingDown, TrendingUp, CalendarDays, Target } from 'lucide-react'; // Removed unused Info, Settings2
import Tooltip from '@/components/ui/Tooltip/Tooltip';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';

const FEE_BPS = 100;

// PK Helper (can be moved to utils)
const pkMarketKey = (marketSymbol: string, mode: TradingMode) => `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`;

// Formatting helpers
const formatDisplayPrice = (priceStr: string | number | undefined | null, marketMeta: UnderlyingPairMeta | InstrumentMarketMeta | null): string => {
    if (priceStr === undefined || priceStr === null || priceStr === '') return '-.--';
    const priceNum = parseFloat(String(priceStr));
    if (isNaN(priceNum)) return '-.--';
    if (!marketMeta) return priceNum.toFixed(2);
    const tickSize = 'tickSize' in marketMeta ? marketMeta.tickSize : marketMeta.tickSizeSpot;
    if (typeof tickSize !== 'number' || tickSize <=0) return priceNum.toFixed(2);
    const decimals = tickSize.toString().split('.')[1]?.length || 0;
    return priceNum.toFixed(decimals);
};

const getAssetDecimals = (asset: string | undefined): number => {
    if (!asset) return 2;
    const SYMBOL_DECIMALS: Record<string, number> = { "USDC": 6, "CXPT": 18, "sBTC": 8, "BTC": 8, "sETH": 8, "ETH": 8, "sPEAQ": 6, "PEAQ": 6, "sAVAX": 8, "AVAX": 8, "sSOL": 9, "SOL": 9, "sBNB": 8, "BNB": 8, "sNEAR": 8, "NEAR": 8, "sOP": 8, "OP": 8, "sDOT": 10, "DOT": 10 };
    return SYMBOL_DECIMALS[asset.toUpperCase()] || SYMBOL_DECIMALS[`s${asset.toUpperCase()}`] || (asset.toUpperCase() === "USDC" ? 6 : 8);
};


const OrderEntryPanel: React.FC = () => {
  const { user } = useAuth();
  const { currentMode } = useTradingMode();
  const {
    selectedUnderlying,
    instrumentsForSelectedUnderlying,
    activeInstrumentSymbol, // This is the symbol of the specific instrument being traded
    fetchInstrumentsForUnderlying,
    setActiveInstrumentSymbol, // This updates MarketContext
    isLoadingInstruments,
    errorInstruments
  } = useMarketContext();

  const { getBalanceByAsset, refreshBalances } = useAccountContext();
  const { marketSpecificData } = useWebSocket();

  const {
    formState,
    updateFormField,
    resetForm,
    selectedInstrumentType, // SPOT, OPTION, FUTURE, PERP (from OrderEntryContext)
    setSelectedInstrumentType,
    selectedExpiryTs,
    setSelectedExpiryTs,
    finalInstrumentSymbol: orderEntryFinalInstrumentSymbol, // Symbol resolved within OrderEntryContext
    setFinalInstrumentSymbol: setOrderEntryFinalInstrumentSymbol,
  } = useOrderEntry();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estimatedTotal, setEstimatedTotal] = useState<number | null>(null);
  const [estimatedFee, setEstimatedFee] = useState<number | null>(null);
  const [collateralAssetSymbol, setCollateralAssetSymbol] = useState<string>('USDC');
  const [availableCollateral, setAvailableCollateral] = useState<number | null>(null);

  // currentMarketDefinition now refers to the specific instrument being traded if a derivative is selected,
  // or the underlying pair if SPOT is selected.
  const currentMarketDefinition: UnderlyingPairMeta | InstrumentMarketMeta | null = useMemo(() => {
    if (!selectedUnderlying) return null;

    // If a specific instrument symbol is active (fully selected derivative or SPOT/PERP)
    if (activeInstrumentSymbol) {
        if (activeInstrumentSymbol === selectedUnderlying.symbol && selectedUnderlying.type === "SPOT") {
            return selectedUnderlying;
        }
        if (instrumentsForSelectedUnderlying?.perp?.symbol === activeInstrumentSymbol) {
            return instrumentsForSelectedUnderlying.perp;
        }
        if (instrumentsForSelectedUnderlying?.options) {
            for (const expiry of instrumentsForSelectedUnderlying.options) {
                const call = expiry.callStrikes?.find(s => s.instrumentSymbol === activeInstrumentSymbol);
                if (call) return { // Construct a temporary InstrumentMarketMeta-like object for display
                    pk: pkMarketKey(call.instrumentSymbol, currentMode), sk: "META", symbol: call.instrumentSymbol, type: "OPTION",
                    underlyingPairSymbol: selectedUnderlying.symbol, baseAsset: selectedUnderlying.baseAsset, quoteAsset: selectedUnderlying.quoteAsset,
                    status: "ACTIVE", mode: currentMode, tickSize: selectedUnderlying.defaultOptionTickSize, lotSize: selectedUnderlying.defaultOptionLotSize,
                    expiryTs: expiry.expiryTs, strikePrice: call.strikePrice, optionType: "CALL", createdAt: 0,
                } as InstrumentMarketMeta;
                const put = expiry.putStrikes?.find(s => s.instrumentSymbol === activeInstrumentSymbol);
                if (put) return {
                    pk: pkMarketKey(put.instrumentSymbol, currentMode), sk: "META", symbol: put.instrumentSymbol, type: "OPTION",
                    underlyingPairSymbol: selectedUnderlying.symbol, baseAsset: selectedUnderlying.baseAsset, quoteAsset: selectedUnderlying.quoteAsset,
                    status: "ACTIVE", mode: currentMode, tickSize: selectedUnderlying.defaultOptionTickSize, lotSize: selectedUnderlying.defaultOptionLotSize,
                    expiryTs: expiry.expiryTs, strikePrice: put.strikePrice, optionType: "PUT", createdAt: 0,
                } as InstrumentMarketMeta;
            }
        }
        if (instrumentsForSelectedUnderlying?.futures) {
            for (const expiry of instrumentsForSelectedUnderlying.futures) {
                if (expiry.futureInstrument?.instrumentSymbol === activeInstrumentSymbol) {
                    return {
                        pk: pkMarketKey(expiry.futureInstrument.instrumentSymbol, currentMode), sk: "META", symbol: expiry.futureInstrument.instrumentSymbol, type: "FUTURE",
                        underlyingPairSymbol: selectedUnderlying.symbol, baseAsset: selectedUnderlying.baseAsset, quoteAsset: selectedUnderlying.quoteAsset,
                        status: "ACTIVE", mode: currentMode, tickSize: selectedUnderlying.defaultFutureTickSize, lotSize: selectedUnderlying.defaultFutureLotSize,
                        expiryTs: expiry.expiryTs, createdAt: 0,
                    } as InstrumentMarketMeta;
                }
            }
        }
    }
    // Fallback to underlying if no specific instrument is active yet (e.g. user is still selecting derivative params)
    return selectedUnderlying;
  }, [selectedUnderlying, activeInstrumentSymbol, instrumentsForSelectedUnderlying, currentMode]);


  useEffect(() => {
    resetForm({ orderType: 'LIMIT', side: 'BUY' });
    if (selectedUnderlying) {
        if (selectedUnderlying.type === "SPOT") {
            setSelectedInstrumentType("SPOT");
            setActiveInstrumentSymbol(selectedUnderlying.symbol);
            setOrderEntryFinalInstrumentSymbol(selectedUnderlying.symbol);
            updateFormField('orderType', 'LIMIT');
        } else {
            setSelectedInstrumentType(null);
            setActiveInstrumentSymbol(null);
            setOrderEntryFinalInstrumentSymbol(null);
            // Determine a sensible default order type based on what the underlying allows
            let defaultOrderTypeForDeriv: OrderEntryOrderType = 'LIMIT'; // Fallback
             if (selectedUnderlying.allowsOptions) defaultOrderTypeForDeriv = 'OPTION';
            else if (selectedUnderlying.allowsFutures) defaultOrderTypeForDeriv = 'FUTURE';
            else if (selectedUnderlying.allowsPerpetuals) defaultOrderTypeForDeriv = 'PERP';
            updateFormField('orderType', defaultOrderTypeForDeriv);
        }
    } else {
        setSelectedInstrumentType(null);
        setActiveInstrumentSymbol(null);
        setOrderEntryFinalInstrumentSymbol(null);
    }
  }, [selectedUnderlying, currentMode, resetForm, setSelectedInstrumentType, setActiveInstrumentSymbol, setOrderEntryFinalInstrumentSymbol, updateFormField]);

  useEffect(() => {
    if (selectedUnderlying && selectedInstrumentType && selectedInstrumentType !== "SPOT") {
      fetchInstrumentsForUnderlying(selectedUnderlying, selectedInstrumentType);
    }
  }, [selectedUnderlying, selectedInstrumentType, fetchInstrumentsForUnderlying]);

  useEffect(() => {
    if (!currentMarketDefinition) {
      setAvailableCollateral(null);
      setCollateralAssetSymbol('USDC');
      return;
    }
    const base = currentMarketDefinition.baseAsset;
    const quote = currentMarketDefinition.quoteAsset;
    let assetForCheck: string;

    if (formState.side === 'BUY') {
        assetForCheck = quote;
    } else { // SELL
        if (currentMarketDefinition.type === 'SPOT') {
            assetForCheck = base;
        } else if (currentMarketDefinition.type === 'OPTION' && formState.optionType === 'CALL') {
            assetForCheck = base; // Covered Call
        } else {
            assetForCheck = quote; // USDC for Put Write, Future/Perp Short
        }
    }
    setCollateralAssetSymbol(assetForCheck);
    const balanceItem = getBalanceByAsset(assetForCheck);
    if (balanceItem?.balance) {
        const decimals = getAssetDecimals(assetForCheck);
        try { setAvailableCollateral(Number(BigInt(balanceItem.balance)) / (10 ** decimals));}
        catch { setAvailableCollateral(0); }
    } else { setAvailableCollateral(0); }
  }, [formState.side, formState.optionType, selectedInstrumentType, currentMarketDefinition, getBalanceByAsset]);


  useEffect(() => {
    const qty = parseFloat(formState.quantity);
    let prc: number | undefined | null = null;
    const localActiveInstrumentSymbol = activeInstrumentSymbol; // Use consistent value from context

    if (formState.orderType === 'LIMIT' || formState.orderType === 'OPTION' || formState.orderType === 'FUTURE' || formState.orderType === 'PERP') {
      prc = parseFloat(formState.price);
    } else if (formState.orderType === 'MARKET') {
      if (localActiveInstrumentSymbol === marketSpecificData.depth?.market && currentMode === marketSpecificData.depth?.mode) {
        prc = formState.side === 'BUY' ? marketSpecificData.depth?.asks[0]?.[0] : marketSpecificData.depth?.bids[0]?.[0];
      }
    }

    if (currentMarketDefinition && !isNaN(qty) && qty > 0 && prc !== undefined && prc !== null && prc > 0) {
      const lotSize = 'lotSize' in currentMarketDefinition ? currentMarketDefinition.lotSize : currentMarketDefinition.lotSizeSpot;
      let total: number;
      if (currentMarketDefinition.type === "SPOT" || currentMarketDefinition.type === "PERP") {
        total = qty * prc;
      } else { // OPTION, FUTURE
        total = qty * prc * lotSize;
      }
      const fee = (total * FEE_BPS) / 10000;
      setEstimatedTotal(total);
      setEstimatedFee(fee);
    } else {
      setEstimatedTotal(null);
      setEstimatedFee(null);
    }
  }, [formState.quantity, formState.price, formState.orderType, formState.side, marketSpecificData.depth, currentMarketDefinition, activeInstrumentSymbol, currentMode]);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    updateFormField(name as keyof OrderFormState, value);

    if (name === 'rawExpiryInput' && (selectedInstrumentType === 'OPTION' || selectedInstrumentType === 'FUTURE')) {
        setSelectedExpiryTs(null);
        setActiveInstrumentSymbol(null); // Use MarketContext setter
        setOrderEntryFinalInstrumentSymbol(null); // Use OrderEntryContext setter
    } else if (name === 'strikePriceDisplay' && selectedInstrumentType === 'OPTION') {
        setActiveInstrumentSymbol(null);
        setOrderEntryFinalInstrumentSymbol(null);
    } else if (name === 'optionType' && selectedInstrumentType === 'OPTION') {
        updateFormField('strikePriceDisplay', '');
        setActiveInstrumentSymbol(null);
        setOrderEntryFinalInstrumentSymbol(null);
    }
  };

  const handleOrderTypeSelect = (type: OrderEntryOrderType) => {
    updateFormField('orderType', type);
    
    // Map OrderEntryOrderType to DerivativeType | "SPOT" | "PERP" | null
    let instrumentContextType: DerivativeType | "SPOT" | "PERP" | null = null;
    if (type === "OPTION" || type === "FUTURE" || type === "PERP") {
        instrumentContextType = type as DerivativeType | "PERP";
    } else if (type === "MARKET" || type === "LIMIT") {
        // If underlying is SPOT, type is SPOT. If underlying allows PERP and user selects PERP tab, it's PERP.
        // This logic needs to be smarter or rely on a separate "Instrument Group" selector (Spot, Perp, Options, Futures)
        instrumentContextType = "SPOT"; // Default to spot for Market/Limit if no other context
        if (selectedUnderlying && selectedUnderlying.type === "SPOT" && selectedUnderlying.allowsPerpetuals) {
            // If the OrderEntryPanel had a sub-tab for "Perpetual" under an underlying,
            // then we'd set instrumentContextType to "PERP". For now, assume Market/Limit on SPOT.
        }
    }
    setSelectedInstrumentType(instrumentContextType);
    
    if (type === 'MARKET') updateFormField('price', '');
    if (type !== 'OPTION') { updateFormField('strikePriceDisplay', ''); updateFormField('optionType', 'CALL'); }
    if (type !== 'OPTION' && type !== 'FUTURE') { updateFormField('rawExpiryInput', ''); setSelectedExpiryTs(null); }

    if (type === 'SPOT' && selectedUnderlying) {
        setActiveInstrumentSymbol(selectedUnderlying.symbol);
        setOrderEntryFinalInstrumentSymbol(selectedUnderlying.symbol);
    } else if (type === 'PERP' && selectedUnderlying && instrumentsForSelectedUnderlying?.perp) {
        setActiveInstrumentSymbol(instrumentsForSelectedUnderlying.perp.symbol);
        setOrderEntryFinalInstrumentSymbol(instrumentsForSelectedUnderlying.perp.symbol);
    } else {
        setActiveInstrumentSymbol(null);
        setOrderEntryFinalInstrumentSymbol(null);
    }
  };
  
  const handleExpirySelect = (e: ChangeEvent<HTMLSelectElement>) => {
    const ts = e.target.value ? parseInt(e.target.value, 10) : null;
    setSelectedExpiryTs(ts);
    updateFormField('strikePriceDisplay', '');
    setActiveInstrumentSymbol(null); 
    setOrderEntryFinalInstrumentSymbol(null);
  };

  const handleStrikeSelect = (e: ChangeEvent<HTMLSelectElement>) => {
    const instrumentSymbolFromStrikeDropdown = e.target.value;
    if (!instrumentSymbolFromStrikeDropdown) {
        updateFormField('strikePriceDisplay', '');
        setActiveInstrumentSymbol(null);
        setOrderEntryFinalInstrumentSymbol(null);
        return;
    }
    const expiryData = instrumentsForSelectedUnderlying?.options?.find(ex => ex.expiryTs === selectedExpiryTs);
    const currentOptionType = formState.optionType; // Use formState.optionType
    const strikeDetail = currentOptionType === 'CALL'
        ? expiryData?.callStrikes?.find(s => s.instrumentSymbol === instrumentSymbolFromStrikeDropdown)
        : expiryData?.putStrikes?.find(s => s.instrumentSymbol === instrumentSymbolFromStrikeDropdown);

    if (strikeDetail) {
        updateFormField('strikePriceDisplay', strikeDetail.strikePrice.toString());
        setActiveInstrumentSymbol(instrumentSymbolFromStrikeDropdown);
        setOrderEntryFinalInstrumentSymbol(instrumentSymbolFromStrikeDropdown);
    }
  };
  
   useEffect(() => {
    if (selectedInstrumentType === 'FUTURE' && selectedExpiryTs && instrumentsForSelectedUnderlying?.futures) {
        const expiryData = instrumentsForSelectedUnderlying.futures.find(ex => ex.expiryTs === selectedExpiryTs);
        if (expiryData?.futureInstrument) {
            setActiveInstrumentSymbol(expiryData.futureInstrument.instrumentSymbol);
            setOrderEntryFinalInstrumentSymbol(expiryData.futureInstrument.instrumentSymbol);
        } else {
            setActiveInstrumentSymbol(null);
            setOrderEntryFinalInstrumentSymbol(null);
        }
    }
   }, [selectedInstrumentType, selectedExpiryTs, instrumentsForSelectedUnderlying?.futures, setActiveInstrumentSymbol, setOrderEntryFinalInstrumentSymbol]);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const finalActiveSymbol = activeInstrumentSymbol || orderEntryFinalInstrumentSymbol;

    if (!user?.properties.traderId || !selectedUnderlying || !finalActiveSymbol || !currentMarketDefinition) {
      notify.error("User, Underlying, or specific Instrument not resolved."); return;
    }
    if (currentMarketDefinition.status !== 'ACTIVE') {
        notify.error(`Market (${finalActiveSymbol}) is ${currentMarketDefinition.status.toLowerCase()}. Orders cannot be placed.`); return;
    }

    const quantityNum = parseFloat(formState.quantity);
    const marketTickSize = 'tickSize' in currentMarketDefinition ? currentMarketDefinition.tickSize : currentMarketDefinition.tickSizeSpot;
    const marketLotSize = 'lotSize' in currentMarketDefinition ? currentMarketDefinition.lotSize : currentMarketDefinition.lotSizeSpot;

    if (isNaN(quantityNum) || quantityNum <= 0) { notify.error("Qty must be > 0."); return; }
    if (marketLotSize > 0) {
        const qtyDecimals = getAssetDecimals(currentMarketDefinition.baseAsset);
        const roundedQty = parseFloat(quantityNum.toFixed(qtyDecimals));
        const roundedLot = parseFloat(marketLotSize.toFixed(qtyDecimals)); // Ensure lotSize is also rounded for comparison
        if (parseFloat((roundedQty % roundedLot).toFixed(qtyDecimals + 1)) !== 0) { // Check remainder with tolerance
            notify.error(`Qty ${quantityNum} must be multiple of lot size (${marketLotSize} ${currentMarketDefinition.baseAsset}).`); return;
        }
    }

    let orderPriceNum: number | undefined = undefined;
    if (formState.orderType !== 'MARKET') {
      orderPriceNum = parseFloat(formState.price);
      if (isNaN(orderPriceNum) || orderPriceNum <= 0) { notify.error("Price must be > 0 for non-market."); return; }
      if (marketTickSize > 0) {
          const priceDecimals = getAssetDecimals(currentMarketDefinition.quoteAsset);
          const roundedPrice = parseFloat(orderPriceNum.toFixed(priceDecimals));
          const roundedTick = parseFloat(marketTickSize.toFixed(priceDecimals));
          if (parseFloat((roundedPrice % roundedTick).toFixed(priceDecimals + 1)) !== 0) {
            notify.error(`Price ${orderPriceNum} must be multiple of tick size (${marketTickSize} ${currentMarketDefinition.quoteAsset}).`); return;
          }
      }
    }
    
    const costExclFee = estimatedTotal;
    if (formState.side === 'BUY' && costExclFee !== null && availableCollateral !== null && costExclFee > availableCollateral) {
        const quoteDecimals = getAssetDecimals(collateralAssetSymbol);
        notify.error(`Est. cost ${costExclFee.toFixed(quoteDecimals)} ${collateralAssetSymbol} exceeds available ${availableCollateral.toFixed(quoteDecimals)} ${collateralAssetSymbol}.`);
        return;
    }
    
    const payload: any = {
      traderId: user.properties.traderId, mode: currentMode,
      orderType: formState.orderType, side: formState.side, qty: quantityNum,
      market: finalActiveSymbol,
    };
    if (orderPriceNum !== undefined) payload.price = orderPriceNum;

    if ((formState.orderType === "OPTION" || formState.orderType === "FUTURE")) {
        payload.underlyingPairSymbol = selectedUnderlying.symbol;
        if (selectedExpiryTs) payload.rawExpiryDate = new Date(selectedExpiryTs).toISOString().split('T')[0];
        if (formState.orderType === "OPTION") {
            payload.strikePrice = parseFloat(formState.strikePriceDisplay);
            payload.optionType = formState.optionType;
        }
    }

    setIsSubmitting(true);
    const loadingToastId = notify.loading("Submitting order...");
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      notify.dismiss(loadingToastId);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Order submission failed`);
      notify.success(`Order ${result.orderId.substring(0,8)}... for ${result.market} placed!`);
      resetForm({ orderType: formState.orderType, side: formState.side });
      refreshBalances();
    } catch (err:any) {
      notify.dismiss(loadingToastId);
      notify.error(err.message || "Order submission error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const setQuantityByPercentage = (percentage: number) => {
    if (availableCollateral === null || availableCollateral <= 0 || !currentMarketDefinition) {
        notify.error(`Not enough ${collateralAssetSymbol} balance or market not defined.`); return;
    }
    let targetQuantity: number;
    const baseDecimals = getAssetDecimals(currentMarketDefinition.baseAsset);
    const marketLotSize = 'lotSize' in currentMarketDefinition ? currentMarketDefinition.lotSize : currentMarketDefinition.lotSizeSpot;

    if (formState.side === 'BUY') {
        const priceToUseForCalc = formState.orderType === 'LIMIT' && parseFloat(formState.price) > 0
            ? parseFloat(formState.price)
            : (activeInstrumentSymbol === marketSpecificData.depth?.market && currentMode === marketSpecificData.depth?.mode) ? marketSpecificData.depth?.asks[0]?.[0] : null;
        if (!priceToUseForCalc || priceToUseForCalc <= 0) {
            notify.error("Enter limit price or wait for order book for % calculation."); return;
        }
        const spendableQuote = availableCollateral * percentage;
        if (currentMarketDefinition.type === "SPOT" || currentMarketDefinition.type === "PERP") {
             targetQuantity = spendableQuote / priceToUseForCalc;
        } else {
             targetQuantity = spendableQuote / (priceToUseForCalc * marketLotSize);
        }
    } else { 
        if (collateralAssetSymbol === currentMarketDefinition.baseAsset) {
            targetQuantity = availableCollateral * percentage;
        } else {
            const priceToUseForCalc = formState.orderType === 'LIMIT' && parseFloat(formState.price) > 0
                ? parseFloat(formState.price)
                : (activeInstrumentSymbol === marketSpecificData.depth?.market && currentMode === marketSpecificData.depth?.mode) ? marketSpecificData.depth?.bids[0]?.[0] : null;
            if (!priceToUseForCalc || priceToUseForCalc <= 0) {
                 notify.error("Enter limit price or wait for order book for % calculation."); return;
            }
            const notionalToTrade = availableCollateral * percentage;
            if (currentMarketDefinition.type === "SPOT" || currentMarketDefinition.type === "PERP") { // Should not hit here if collateral is USDC for SPOT/PERP sell
                 targetQuantity = notionalToTrade / priceToUseForCalc;
            } else {
                 targetQuantity = notionalToTrade / (priceToUseForCalc * marketLotSize);
            }
        }
    }
    if (marketLotSize > 0) {
        targetQuantity = Math.max(0, Math.floor(targetQuantity / marketLotSize) * marketLotSize);
    }
    updateFormField('quantity', targetQuantity > 0 ? targetQuantity.toFixed(baseDecimals) : '');
  };

  const orderTypeTabsDefinition: { label: string; type: OrderEntryOrderType; requiresDerivative: boolean }[] = [
    { label: 'Limit', type: 'LIMIT', requiresDerivative: false },
    { label: 'Market', type: 'MARKET', requiresDerivative: false },
    { label: 'Option', type: 'OPTION', requiresDerivative: true },
    { label: 'Future', type: 'FUTURE', requiresDerivative: true },
    { label: 'Perp', type: 'PERP', requiresDerivative: false },
  ];
  
  const availableOrderTypes = orderTypeTabsDefinition.filter(tab => {
      if (!selectedUnderlying) return tab.type === 'LIMIT' || tab.type === 'MARKET'; // Show basic if no underlying
      if (tab.type === 'OPTION') return selectedUnderlying.allowsOptions;
      if (tab.type === 'FUTURE') return selectedUnderlying.allowsFutures;
      if (tab.type === 'PERP') return selectedUnderlying.allowsPerpetuals;
      // For LIMIT/MARKET, check if the selectedUnderlying itself is a SPOT or PERP market.
      // If selectedUnderlying is SPOT type, Limit/Market are on it.
      // If selectedUnderlying allows PERP, and a PERP instrument is selected, Limit/Market are on that PERP.
      return true; 
  });

  const isLoadingDisplay = isLoadingInstruments && (selectedInstrumentType === "OPTION" || selectedInstrumentType === "FUTURE");


  return (
    <div className={styles.orderEntryContainer}>
        <div className={styles.header}> <h3 className={styles.title}>Place Order</h3> </div>
        <div className={styles.sideToggle}>
            <Button variant={formState.side === 'BUY' ? 'primary' : 'ghost'} onClick={() => updateFormField('side', 'BUY')} className={`${styles.sideButton} ${formState.side === 'BUY' ? styles.buyActiveCss : ''}`} style={{borderColor: formState.side === 'BUY' ? 'var(--cxmpute-green)' : '#3e4556' }}><TrendingUp size={16} /> Buy/Long</Button>
            <Button variant={formState.side === 'SELL' ? 'danger' : 'ghost'} onClick={() => updateFormField('side', 'SELL')} className={`${styles.sideButton} ${formState.side === 'SELL' ? styles.sellActiveCss : ''}`} style={{borderColor: formState.side === 'SELL' ? 'var(--cxmpute-red)' : '#3e4556' }}><TrendingDown size={16} /> Sell/Short</Button>
        </div>

      {selectedUnderlying && (
        <div className={styles.orderTypeTabs}>
            {availableOrderTypes.map(tab => (
            <Button key={tab.type} variant="ghost" size="sm"
                className={`${styles.orderTypeButton} ${formState.orderType === tab.type ? styles.activeOrderType : ''}`}
                onClick={() => handleOrderTypeSelect(tab.type)}
                disabled={ // Disable if type not allowed by selected underlying
                    (tab.type === 'OPTION' && !selectedUnderlying.allowsOptions) ||
                    (tab.type === 'FUTURE' && !selectedUnderlying.allowsFutures) ||
                    (tab.type === 'PERP' && !selectedUnderlying.allowsPerpetuals)
                }
                title={ /* ... (title generation logic based on disabled state) ... */ tab.label }
            >
                {tab.label}
            </Button>
            ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        {isLoadingDisplay ? <div className={styles.loadingOverlayForm}><SkeletonLoader count={3} /> <p>Loading Instruments...</p></div> : 
         !selectedUnderlying ? <p className={styles.placeholderText}>Select an underlying pair to begin.</p> :
         !activeInstrumentSymbol && (selectedInstrumentType === "OPTION" || selectedInstrumentType === "FUTURE" || selectedInstrumentType === "PERP") && !isLoadingInstruments ? 
            <p className={styles.placeholderText}>Select {selectedInstrumentType?.toLowerCase()} details.</p> :
        <>
            {(formState.orderType === 'LIMIT' || (formState.orderType === 'OPTION' && selectedInstrumentType==='OPTION') || (formState.orderType === 'FUTURE' && selectedInstrumentType==='FUTURE') || (formState.orderType === 'PERP' && selectedInstrumentType==='PERP')) && (
            <div className={styles.formGroup}>
                <label htmlFor="price">{formState.orderType === 'OPTION' ? 'Premium' : 'Price'} ({currentMarketDefinition?.quoteAsset || 'USDC'})</label>
                <input type="number" id="price" name="price" value={formState.price} onChange={handleInputChange}
                    placeholder="0.00" step={currentMarketDefinition ? (('tickSize' in currentMarketDefinition ? currentMarketDefinition.tickSize : currentMarketDefinition.tickSizeSpot) || 0.01) : '0.01'} 
                    min={currentMarketDefinition ? (('tickSize' in currentMarketDefinition ? currentMarketDefinition.tickSize : currentMarketDefinition.tickSizeSpot) || 0.01) : '0.01'}
                    required className={styles.inputField} />
            </div>
            )}

            {(selectedInstrumentType === 'OPTION' || selectedInstrumentType === 'FUTURE') && !isLoadingInstruments && (
            <>
                <div className={styles.formGroup}>
                <label htmlFor="expiryDateSelect">Expiry Date <CalendarDays size={14} /></label>
                <select id="expiryDateSelect" name="rawExpiryInput" value={selectedExpiryTs || ""} onChange={handleExpirySelect} required className={styles.inputField} disabled={isLoadingInstruments}>
                    <option value="" disabled>{isLoadingInstruments ? "Loading..." : "Select Expiry"}</option>
                    {(selectedInstrumentType === 'OPTION' ? instrumentsForSelectedUnderlying?.options : instrumentsForSelectedUnderlying?.futures)?.map(ex => (
                    <option key={ex.expiryTs} value={ex.expiryTs}>{ex.displayDate}</option>
                    ))}
                     {/* Allow creating new expiry if list is empty and type is selected? More complex UI */}
                </select>
                </div>
            </>
            )}
            {errorInstruments && <p className={styles.errorTextSmall}>{errorInstruments}</p>}

            {selectedInstrumentType === 'OPTION' && selectedExpiryTs && !isLoadingInstruments && instrumentsForSelectedUnderlying?.options && (
            <>
                <div className={styles.formGroup}>
                <label htmlFor="optionTypeSelect">Option Type</label>
                <select id="optionTypeSelect" name="optionType" value={formState.optionType} onChange={handleInputChange} className={styles.inputField}>
                    <option value="CALL">CALL</option>
                    <option value="PUT">PUT</option>
                </select>
                </div>
                <div className={styles.formGroup}>
                <label htmlFor="strikePriceSelect">Strike ({currentMarketDefinition?.quoteAsset || 'USDC'}) <Target size={14}/></label>
                <select id="strikePriceSelect" name="strikePriceDisplay" 
                    value={orderEntryFinalInstrumentSymbol || ""} 
                    onChange={handleStrikeSelect} required className={styles.inputField}
                    disabled={!selectedExpiryTs || isLoadingInstruments || !(instrumentsForSelectedUnderlying.options?.find(e=>e.expiryTs === selectedExpiryTs)?.[formState.optionType === 'CALL' ? 'callStrikes' : 'putStrikes']?.length)}
                >
                    <option value="" disabled>{isLoadingInstruments ? "Loading..." : !selectedExpiryTs ? "Select Expiry First" : "Select Strike"}</option>
                    {instrumentsForSelectedUnderlying.options?.find(ex => ex.expiryTs === selectedExpiryTs)?.[formState.optionType === 'CALL' ? 'callStrikes' : 'putStrikes']?.map(strikeOpt => (
                    <option key={strikeOpt.instrumentSymbol} value={strikeOpt.instrumentSymbol}>
                        {formatDisplayPrice(strikeOpt.strikePrice, currentMarketDefinition)}
                    </option>
                    ))}
                    {/* Allow creating new strike if list is empty? More complex UI */}
                </select>
                </div>
            </>
            )}
            
            <div className={styles.formGroup}>
            <label htmlFor="quantity">Amount ({currentMarketDefinition?.baseAsset || 'BASE'})</label>
            <input type="number" id="quantity" name="quantity" value={formState.quantity} onChange={handleInputChange}
                placeholder="0.0000" 
                step={currentMarketDefinition ? (('lotSize' in currentMarketDefinition ? currentMarketDefinition.lotSize : currentMarketDefinition.lotSizeSpot) || 0.0001) : '0.0001'} 
                min={currentMarketDefinition ? (('lotSize' in currentMarketDefinition ? currentMarketDefinition.lotSize : currentMarketDefinition.lotSizeSpot) || 0.0001) : '0.0001'} 
                required className={styles.inputField} />
            </div>
            
            <div className={styles.percentageButtons}>
                {[0.25, 0.50, 0.75, 1.0].map(pct => (
                    <Button key={pct} type="button" variant="outline" size="sm" onClick={() => setQuantityByPercentage(pct)} className={styles.percentageButton} disabled={!currentMarketDefinition || availableCollateral === null}>
                        {pct*100}%
                    </Button>
                ))}
            </div>
            
            <div className={styles.orderSummary}>
                <div className={styles.summaryRow}>
                    <Tooltip content={`Your available balance of ${collateralAssetSymbol} for this trade.`}><span className={styles.summaryLabel}>Available:</span></Tooltip>
                    <span className={styles.summaryValue}>
                        {availableCollateral !== null ? `${availableCollateral.toFixed(getAssetDecimals(collateralAssetSymbol))} ${collateralAssetSymbol}` : <SkeletonLoader width="80px" height="14px"/>}
                    </span>
                </div>
                <div className={styles.summaryRow}>
                    <Tooltip content={`Estimated fee (0.5%). Market order fees are approximate.`}><span className={styles.summaryLabel}>Est. Fee:</span></Tooltip>
                    <span className={styles.summaryValue}>
                    {estimatedFee !== null && currentMarketDefinition ? `${estimatedFee.toFixed(Math.max(4, getAssetDecimals(currentMarketDefinition.quoteAsset)))} ${currentMarketDefinition.quoteAsset}` : '-.--'}
                    </span>
                </div>
                <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                    <Tooltip content={`Estimated total value in ${currentMarketDefinition?.quoteAsset || 'USDC'}. Based on current best bid/ask for market orders.`}>
                        <span className={styles.totalLabel}>Est. Total:</span>
                    </Tooltip>
                    <span className={styles.totalValue}>
                    {estimatedTotal !== null && currentMarketDefinition ? `~ ${estimatedTotal.toFixed(getAssetDecimals(currentMarketDefinition.quoteAsset))} ${currentMarketDefinition.quoteAsset}` : '-.--'}
                    </span>
                </div>
            </div>

            <Button type="submit" variant={formState.side === 'BUY' ? 'primary' : 'danger'}
                size="lg" isLoading={isSubmitting}
                disabled={isSubmitting || !activeInstrumentSymbol || currentMarketDefinition?.status !== 'ACTIVE' || 
                    ((selectedInstrumentType === 'OPTION' || selectedInstrumentType === 'FUTURE') && !orderEntryFinalInstrumentSymbol)}
                className={styles.submitButton}
            >
                {!selectedUnderlying ? "Select Pair" :
                 currentMarketDefinition?.status !== 'ACTIVE' ? `Market Inactive` :
                 !activeInstrumentSymbol && (selectedInstrumentType === 'OPTION' || selectedInstrumentType === 'FUTURE') ? `Select ${selectedInstrumentType} Details` :
                `${formState.side} ${currentMarketDefinition?.baseAsset || 'BASE'}`
                }
            </Button>
        </>
        }
      </form>
    </div>
  );
};

export default OrderEntryPanel;