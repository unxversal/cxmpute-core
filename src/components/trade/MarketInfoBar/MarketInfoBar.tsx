/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/MarketInfoBar/MarketInfoBar.tsx
"use client";

import React, { useMemo } from 'react';
import styles from './MarketInfoBar.module.css';
import { useMarketContext } from '@/contexts/MarketContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { useWebSocket } from '@/contexts/WebsocketContext';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
import Tooltip from '@/components/ui/Tooltip/Tooltip';
import { TrendingUp, Zap, Clock, Info, Percent, Activity, Layers } from 'lucide-react';
import type { InstrumentMarketMeta, MarketMeta, ExpiryData, TradingMode } from '@/lib/interfaces'; // Added MarketMeta for clarity

// Formatting helpers (ensure these are robust or imported from a shared util)
const formatPrice = (price: number | undefined | null, tickSize: number | undefined, defaultPrecision = 2): string => {
  if (price === undefined || price === null || typeof price !== 'number' || isNaN(price)) return '-.--';
  if (tickSize === undefined || typeof tickSize !== 'number' || isNaN(tickSize) || tickSize <= 0) {
    return price.toFixed(defaultPrecision);
  }
  const precision = Math.max(0, tickSize.toString().split('.')[1]?.length || 0);
  return price.toFixed(precision);
};

const formatPercentage = (value: number | undefined | null, decimals: number = 2, displaySign: boolean = false): string => {
  if (value === undefined || value === null || typeof value !== 'number' || isNaN(value)) return '-.--%';
  const sign = displaySign && value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(decimals)}%`;
};

const formatBigNumber = (value: number | string | undefined | null, defaultDisplay: string = 'N/A'): string => {
    if (value === undefined || value === null || value === "N/A") return defaultDisplay;
    const numValue = Number(value);
    if (isNaN(numValue)) return defaultDisplay;
    if (numValue >= 1_000_000_000) return `${(numValue / 1_000_000_000).toFixed(2)}B`;
    if (numValue >= 1_000_000) return `${(numValue / 1_000_000).toFixed(2)}M`;
    if (numValue >= 1_000) return `${(numValue / 1_000).toFixed(1)}K`;
    if (numValue % 1 !== 0 && Math.abs(numValue) < 1000) return numValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    return numValue.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const formatTimeToExpiry = (expiryTs?: number): string | null => {
    if (!expiryTs || typeof expiryTs !== 'number') return null;
    const now = Date.now();
    const diffMs = expiryTs - now;
    if (diffMs <= 0) return "Expired";
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 365) return `>1y`;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return "<1m";
};

const MarketInfoBar: React.FC = () => {
  const { selectedUnderlying, activeInstrumentSymbol, isLoadingUnderlyings, instrumentsForSelectedUnderlying } = useMarketContext();
  const { currentMode } = useTradingMode();
  const { marketSpecificData, connectionStatus } = useWebSocket();

  const isWsConnected = connectionStatus === 'OPEN';

  const displayMarketDefinition: MarketMeta | null = useMemo(() => {
    if (!selectedUnderlying) return null;
    if (!activeInstrumentSymbol) return selectedUnderlying; // Default to underlying if no specific instrument active

    if (activeInstrumentSymbol === selectedUnderlying.symbol && selectedUnderlying.type === "SPOT") {
        return selectedUnderlying;
    }

    if (instrumentsForSelectedUnderlying) {
        if (instrumentsForSelectedUnderlying.perp?.symbol === activeInstrumentSymbol) {
            return instrumentsForSelectedUnderlying.perp;
        }
        
        const findInstrument = (data?: ExpiryData[]): InstrumentMarketMeta | null => {
            if (!data) return null;
            for (const expiry of data) {
                if (expiry.futureInstrument?.instrumentSymbol === activeInstrumentSymbol) {
                    return {
                        pk: pkMarketKey(expiry.futureInstrument.instrumentSymbol, currentMode), // Construct PK
                        sk: "META",
                        symbol: expiry.futureInstrument.instrumentSymbol,
                        type: "FUTURE",
                        underlyingPairSymbol: selectedUnderlying.symbol, // <<< FIX: Add underlyingPairSymbol
                        baseAsset: selectedUnderlying.baseAsset,
                        quoteAsset: selectedUnderlying.quoteAsset,
                        status: "ACTIVE", // Assuming active if selectable
                        mode: currentMode,
                        tickSize: selectedUnderlying.defaultFutureTickSize,
                        lotSize: selectedUnderlying.defaultFutureLotSize,
                        expiryTs: expiry.expiryTs,
                        createdAt: 0, // Placeholder, actual meta would have this
                        updatedAt: Date.now(),
                    };
                }
                const call = expiry.callStrikes?.find(s => s.instrumentSymbol === activeInstrumentSymbol);
                if (call) return {
                    pk: pkMarketKey(call.instrumentSymbol, currentMode), sk: "META", symbol: call.instrumentSymbol, type: "OPTION",
                    underlyingPairSymbol: selectedUnderlying.symbol, // <<< FIX: Add underlyingPairSymbol
                    baseAsset: selectedUnderlying.baseAsset, quoteAsset: selectedUnderlying.quoteAsset,
                    status: "ACTIVE", mode: currentMode, tickSize: selectedUnderlying.defaultOptionTickSize, lotSize: selectedUnderlying.defaultOptionLotSize,
                    expiryTs: expiry.expiryTs, strikePrice: call.strikePrice, optionType: "CALL", createdAt: 0, updatedAt: Date.now(),
                };
                const put = expiry.putStrikes?.find(s => s.instrumentSymbol === activeInstrumentSymbol);
                if (put) return {
                    pk: pkMarketKey(put.instrumentSymbol, currentMode), sk: "META", symbol: put.instrumentSymbol, type: "OPTION",
                    underlyingPairSymbol: selectedUnderlying.symbol, // <<< FIX: Add underlyingPairSymbol
                    baseAsset: selectedUnderlying.baseAsset, quoteAsset: selectedUnderlying.quoteAsset,
                    status: "ACTIVE", mode: currentMode, tickSize: selectedUnderlying.defaultOptionTickSize, lotSize: selectedUnderlying.defaultOptionLotSize,
                    expiryTs: expiry.expiryTs, strikePrice: put.strikePrice, optionType: "PUT", createdAt: 0, updatedAt: Date.now(),
                };
            }
            return null;
        };
        // Search in options first, then futures
        const foundInstrument = findInstrument(instrumentsForSelectedUnderlying.options) || findInstrument(instrumentsForSelectedUnderlying.futures);
        if (foundInstrument) return foundInstrument;
    }
    // If activeInstrumentSymbol is set but not found in the loaded instruments (e.g. stale context), fallback to underlying
    // or ideally, activeInstrumentSymbol should be cleared if its details are not found.
    // For now, returning selectedUnderlying.
    console.warn(`MarketInfoBar: activeInstrumentSymbol '${activeInstrumentSymbol}' not found in fetched instruments for ${selectedUnderlying.symbol}. Falling back to underlying.`);
    return selectedUnderlying;
  }, [activeInstrumentSymbol, selectedUnderlying, instrumentsForSelectedUnderlying, currentMode]);


  const liveDataForActiveInstrument = useMemo(() => {
    const emptyData = { markPrice: null, lastTrade: null, fundingRate: null, summary: null };
    if (!activeInstrumentSymbol || !isWsConnected) return emptyData;
    
    const isCorrectMarket = (data: any) => data && data.market === activeInstrumentSymbol && data.mode === currentMode;

    return {
      markPrice: isCorrectMarket(marketSpecificData.markPrice) ? marketSpecificData.markPrice : null,
      lastTrade: isCorrectMarket(marketSpecificData.lastTrade) ? marketSpecificData.lastTrade : null,
      fundingRate: isCorrectMarket(marketSpecificData.fundingRate) ? marketSpecificData.fundingRate : null,
      summary: isCorrectMarket(marketSpecificData.summary) ? marketSpecificData.summary : null,
    };
  }, [activeInstrumentSymbol, currentMode, marketSpecificData, isWsConnected]);


  const displayValues = useMemo(() => {
    const base = {
      symbol: activeInstrumentSymbol || selectedUnderlying?.symbol || 'N/A',
      type: displayMarketDefinition?.type,
      tickSize: displayMarketDefinition ? ('tickSize' in displayMarketDefinition ? displayMarketDefinition.tickSize : displayMarketDefinition.tickSizeSpot) : undefined,
      lotSize: displayMarketDefinition ? ('lotSize' in displayMarketDefinition ? displayMarketDefinition.lotSize : displayMarketDefinition.lotSizeSpot) : undefined,
      markPrice: liveDataForActiveInstrument.markPrice?.price ?? liveDataForActiveInstrument.summary?.markPrice,
      lastTradePrice: liveDataForActiveInstrument.lastTrade?.price,
      prevTradePrice: liveDataForActiveInstrument.lastTrade?.prevPrice,
      change24h: liveDataForActiveInstrument.summary?.change24h,
      volume24h: liveDataForActiveInstrument.summary?.volume24h,
      openInterest: liveDataForActiveInstrument.summary?.openInterest,
      indexPrice: liveDataForActiveInstrument.summary?.indexPrice,
      fundingRate: liveDataForActiveInstrument.fundingRate?.fundingRate ?? liveDataForActiveInstrument.summary?.fundingRate,
      timeToExpiry: displayMarketDefinition && 'expiryTs' in displayMarketDefinition && displayMarketDefinition.expiryTs ? formatTimeToExpiry(displayMarketDefinition.expiryTs) : null,
      isDerivativeActive: !!activeInstrumentSymbol && activeInstrumentSymbol !== selectedUnderlying?.symbol,
      quoteAsset: displayMarketDefinition?.quoteAsset || "USDC", // Fallback for quote asset
      underlyingForIndex: displayMarketDefinition?.type !== "SPOT" && displayMarketDefinition?.underlyingPairSymbol ? displayMarketDefinition.underlyingPairSymbol.split('/')[0] : displayMarketDefinition?.baseAsset
    };
    return base;
  }, [activeInstrumentSymbol, selectedUnderlying, displayMarketDefinition, liveDataForActiveInstrument]);


  if (isLoadingUnderlyings && !selectedUnderlying) {
    // ... skeleton loader as before ...
    return (
      <div className={styles.infoBar}>
        <SkeletonLoader type="text" width="150px" height="28px" className={styles.skeletonTitle} />
        <div className={styles.infoGrid}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`skel-item-bar-${i}`} className={styles.infoItem}>
              <SkeletonLoader type="text" width="80px" height="14px" className={styles.skeletonLabel}/>
              <SkeletonLoader type="text" width="60px" height="18px" className={styles.skeletonValue}/>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedUnderlying) {
    return (
      <div className={styles.infoBar}>
        <h2 className={styles.marketSymbolDisplay}>Select Underlying Pair</h2>
      </div>
    );
  }
  
  const primaryPriceToDisplay = displayValues.lastTradePrice ?? displayValues.markPrice;
  let priceColorClass = styles.priceNeutral;
  if (displayValues.lastTradePrice !== null && displayValues.lastTradePrice !== undefined &&
      displayValues.prevTradePrice !== null && displayValues.prevTradePrice !== undefined) {
      if (displayValues.lastTradePrice > displayValues.prevTradePrice) priceColorClass = styles.priceUp;
      else if (displayValues.lastTradePrice < displayValues.prevTradePrice) priceColorClass = styles.priceDown;
  }

  return (
    <div className={styles.infoBar}>
      <div className={styles.marketTitleSection}>
        <div title={selectedUnderlying.symbol}>
          <Layers size={18} className={styles.mainIcon} />
        </div>
        <h2 className={styles.marketSymbolDisplay} title={activeInstrumentSymbol || selectedUnderlying.symbol}>
            {activeInstrumentSymbol ? activeInstrumentSymbol : selectedUnderlying.symbol}
        </h2>
        <div className={`${styles.priceDisplay} ${priceColorClass}`}>
          {isWsConnected && primaryPriceToDisplay !== null && primaryPriceToDisplay !== undefined ? 
            formatPrice(primaryPriceToDisplay, displayValues.tickSize) : 
            <SkeletonLoader width="90px" height="24px" />
          }
        </div>
        {isWsConnected && displayValues.change24h !== null && displayValues.change24h !== undefined ? (
            <span className={`${styles.change24h} ${displayValues.change24h >= 0 ? styles.priceUp : styles.priceDown}`}>
                <TrendingUp size={14} style={{ transform: displayValues.change24h < 0 ? 'rotate(180deg)' : 'none' }} />
                {formatPercentage(displayValues.change24h, 2, true)}
            </span>
        ) : isWsConnected ? (
            <span className={styles.change24h}><SkeletonLoader width="60px" height="18px" /></span>
        ) : null }
      </div>

      <div className={styles.infoGrid}>
        <Tooltip content="Mark Price: Estimated fair value, used for PnL & liquidations.">
          <div className={styles.infoItem}>
            <span className={styles.label}>Mark <Activity size={12}/></span>
            <span className={styles.value}>
              {isWsConnected && displayValues.markPrice !== null && displayValues.markPrice !== undefined ? formatPrice(displayValues.markPrice, displayValues.tickSize) : <SkeletonLoader width="70px" />}
            </span>
          </div>
        </Tooltip>

        {(displayValues.type === 'PERP' || displayValues.type === 'FUTURE') && (
            <Tooltip content={`Index Price: Oracle-based price of the underlying ${displayValues.underlyingForIndex || 'asset'}.`}>
                <div className={styles.infoItem}>
                    <span className={styles.label}>Index <Info size={12} /></span>
                    <span className={styles.value}>
                        {isWsConnected && displayValues.indexPrice !== null && displayValues.indexPrice !== undefined ? formatPrice(displayValues.indexPrice, selectedUnderlying.tickSizeSpot) : <SkeletonLoader width="70px" />}
                    </span>
                </div>
            </Tooltip>
        )}

        {displayValues.type === 'PERP' && displayValues.fundingRate !== null && displayValues.fundingRate !== undefined && (
          <Tooltip content="Funding Rate / Next: Periodic payment. Positive: longs pay shorts. Displayed as an 8-hour rate.">
            <div className={styles.infoItem}>
              <span className={styles.label}>Funding / 8h <Percent size={12} /></span>
              <span className={`${styles.value} ${displayValues.fundingRate > 0 ? styles.priceUpStrong : displayValues.fundingRate < 0 ? styles.priceDownStrong : ''}`}>
                {isWsConnected ? formatPercentage(displayValues.fundingRate, 4) : <SkeletonLoader width="60px" />}
              </span>
            </div>
          </Tooltip>
        )}

        {(displayValues.type === 'FUTURE' || displayValues.type === 'OPTION') && displayValues.timeToExpiry && (
          <Tooltip content="Time remaining until contract expiry.">
            <div className={styles.infoItem}>
              <span className={styles.label}>Expires In <Clock size={12} /></span>
              <span className={styles.value}>{displayValues.timeToExpiry}</span>
            </div>
          </Tooltip>
        )}
        
        <Tooltip content="Open Interest: Total number of outstanding contracts (in base asset units or number of contracts).">
            <div className={styles.infoItem}>
                <span className={styles.label}>Open Interest <Zap size={12} /></span>
                <span className={styles.value}>{isWsConnected ? formatBigNumber(displayValues.openInterest) : <SkeletonLoader width="80px" />}</span>
            </div>
        </Tooltip>

        <Tooltip content="24h Volume: Total value traded in the last 24 hours (in quote currency).">
            <div className={styles.infoItem}>
                <span className={styles.label}>24h Volume</span>
                <span className={styles.value}>{isWsConnected ? formatBigNumber(displayValues.volume24h, '0') : <SkeletonLoader width="70px" />}</span>
            </div>
        </Tooltip>
      </div>
    </div>
  );
};

// Helper to construct PK for market key, assuming it's needed for some meta construction
// This might not be needed if all data comes from context that already has full objects.
const pkMarketKey = (marketSymbol: string, mode: TradingMode) => `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`;


export default MarketInfoBar;