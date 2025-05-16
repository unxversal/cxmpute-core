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
import type { InstrumentMarketMeta, MarketMeta, ExpiryData, TradingMode, DerivativeType, OptionType } from '@/lib/interfaces';

// Formatting helpers
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

const constructGsi1pk = (underlyingPairSymbol: string, mode: TradingMode, type: DerivativeType | "PERP" | "SPOT") => {
    return `${underlyingPairSymbol}#${mode}#${type}`;
};
const constructGsi1sk = (status: string, instrumentSymbol: string, expiryTs?: number, strikePrice?: number, optionType?: OptionType) => {
    return `${status}#${expiryTs || 0}#${strikePrice || 0}#${optionType || 'NONE'}#${instrumentSymbol}`;
};
const pkMarketKey = (marketSymbol: string, mode: TradingMode) => `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`;


const MarketInfoBar: React.FC = () => {
  const { selectedUnderlying, activeInstrumentSymbol, isLoadingUnderlyings, instrumentsForSelectedUnderlying } = useMarketContext();
  const { currentMode } = useTradingMode();
  const { marketSpecificData, connectionStatus } = useWebSocket();

  const isWsConnected = connectionStatus === 'OPEN';

  const displayMarketDefinition: MarketMeta | null = useMemo(() => {
    if (!selectedUnderlying) return null;
    if (!activeInstrumentSymbol || (activeInstrumentSymbol === selectedUnderlying.symbol && selectedUnderlying.type === "SPOT")) {
        return selectedUnderlying;
    }
    if (instrumentsForSelectedUnderlying && activeInstrumentSymbol) {
        if (instrumentsForSelectedUnderlying.perp?.symbol === activeInstrumentSymbol) {
            return instrumentsForSelectedUnderlying.perp;
        }
        const findInstrument = (data?: ExpiryData[], derivType?: "OPTION" | "FUTURE"): InstrumentMarketMeta | null => {
            if (!data || !derivType) return null;
            for (const expiry of data) {
                let instrumentDetail = null;
                let specificType: DerivativeType | null = null;
                let specificOptionType: OptionType | undefined = undefined;
                let specificStrike: number | undefined = undefined;
                if (derivType === "FUTURE" && expiry.futureInstrument?.instrumentSymbol === activeInstrumentSymbol) {
                    instrumentDetail = expiry.futureInstrument; specificType = "FUTURE";
                } else if (derivType === "OPTION") {
                    const call = expiry.callStrikes?.find(s => s.instrumentSymbol === activeInstrumentSymbol);
                    if (call) { instrumentDetail = call; specificType = "OPTION"; specificOptionType = "CALL"; specificStrike = call.strikePrice; }
                    else { const put = expiry.putStrikes?.find(s => s.instrumentSymbol === activeInstrumentSymbol);
                        if (put) { instrumentDetail = put; specificType = "OPTION"; specificOptionType = "PUT"; specificStrike = put.strikePrice; }
                    }
                }
                if (instrumentDetail && specificType) {
                    const defaultTick = specificType === "OPTION" ? selectedUnderlying.defaultOptionTickSize : selectedUnderlying.defaultFutureTickSize;
                    const defaultLot = specificType === "OPTION" ? selectedUnderlying.defaultOptionLotSize : selectedUnderlying.defaultFutureLotSize;
                    return {
                        pk: pkMarketKey(instrumentDetail.instrumentSymbol, currentMode), sk: "META",
                        symbol: instrumentDetail.instrumentSymbol, type: specificType,
                        underlyingPairSymbol: selectedUnderlying.symbol,
                        baseAsset: selectedUnderlying.baseAsset, quoteAsset: selectedUnderlying.quoteAsset,
                        status: "ACTIVE", mode: currentMode,
                        tickSize: defaultTick, lotSize: defaultLot,
                        expiryTs: expiry.expiryTs, strikePrice: specificStrike, optionType: specificOptionType,
                        createdAt: 0, updatedAt: Date.now(),
                        gsi1pk: constructGsi1pk(selectedUnderlying.symbol, currentMode, specificType),
                        gsi1sk: constructGsi1sk("ACTIVE", instrumentDetail.instrumentSymbol, expiry.expiryTs, specificStrike, specificOptionType),
                    };
                }
            }
            return null;
        };
        const foundInstrument = findInstrument(instrumentsForSelectedUnderlying.options, "OPTION") || findInstrument(instrumentsForSelectedUnderlying.futures, "FUTURE");
        if (foundInstrument) return foundInstrument;
    }
    console.warn(`MarketInfoBar: activeInstrumentSymbol '${activeInstrumentSymbol}' details not fully resolved. Falling back to selectedUnderlying.`);
    return selectedUnderlying;
  }, [activeInstrumentSymbol, selectedUnderlying, instrumentsForSelectedUnderlying, currentMode]);


  const liveDataForActiveInstrument = useMemo(() => { /* ... same as before ... */
    const emptyData = { markPrice: null, lastTrade: null, fundingRate: null, summary: null };
    if (!activeInstrumentSymbol || !isWsConnected) return emptyData;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isCorrectMarket = (data: any) => data && data.market === activeInstrumentSymbol && data.mode === currentMode;
    return {
      markPrice: isCorrectMarket(marketSpecificData.markPrice) ? marketSpecificData.markPrice : null,
      lastTrade: isCorrectMarket(marketSpecificData.lastTrade) ? marketSpecificData.lastTrade : null,
      fundingRate: isCorrectMarket(marketSpecificData.fundingRate) ? marketSpecificData.fundingRate : null,
      summary: isCorrectMarket(marketSpecificData.summary) ? marketSpecificData.summary : null,
    };
  }, [activeInstrumentSymbol, currentMode, marketSpecificData, isWsConnected]);


  const displayValues = useMemo(() => {
    // Define base values if displayMarketDefinition is null
    const defaultBaseValues = {
        symbol: selectedUnderlying?.symbol || 'N/A',
        type: selectedUnderlying?.type,
        tickSize: selectedUnderlying?.tickSizeSpot,
        lotSize: selectedUnderlying?.lotSizeSpot,
        quoteAsset: selectedUnderlying?.quoteAsset || "USDC",
        baseAssetForIndex: selectedUnderlying?.baseAsset, // For index price if only underlying is selected
        tickSizeForIndex: selectedUnderlying?.tickSizeSpot,
        isDerivativeView: false,
        timeToExpiry: null,
        // Live data will be from emptyData if no activeInstrumentSymbol
        markPrice: null, lastTradePrice: null, prevTradePrice: null,
        change24h: null, volume24h: 'N/A', openInterest: 'N/A',
        indexPrice: null, fundingRate: null,
    };

    if (!displayMarketDefinition) { // Handles case where selectedUnderlying might also be null initially
        return {
            ...defaultBaseValues,
            symbol: activeInstrumentSymbol || 'N/A', // Show activeInstrumentSymbol if available
            markPrice: liveDataForActiveInstrument.markPrice?.price,
            lastTradePrice: liveDataForActiveInstrument.lastTrade?.price,
            prevTradePrice: liveDataForActiveInstrument.lastTrade?.prevPrice,
            change24h: liveDataForActiveInstrument.summary?.change24h,
            volume24h: liveDataForActiveInstrument.summary?.volume24h,
            openInterest: liveDataForActiveInstrument.summary?.openInterest,
            indexPrice: liveDataForActiveInstrument.summary?.indexPrice,
            fundingRate: liveDataForActiveInstrument.fundingRate?.fundingRate ?? liveDataForActiveInstrument.summary?.fundingRate,
        };
    }

    // Determine the base asset for index price context
    let baseAssetForIndexContext = displayMarketDefinition.baseAsset;
    if ('underlyingPairSymbol' in displayMarketDefinition && displayMarketDefinition.underlyingPairSymbol) {
        baseAssetForIndexContext = displayMarketDefinition.underlyingPairSymbol.split('/')[0];
    }
    
    // Determine tick size for index price (should be from the underlying spot market)
    const tickSizeForIndexPrice = selectedUnderlying?.tickSizeSpot;


    return {
      symbol: displayMarketDefinition.symbol, // This is now the specific instrument or underlying spot
      type: displayMarketDefinition.type,
      tickSize: 'tickSize' in displayMarketDefinition ? displayMarketDefinition.tickSize : displayMarketDefinition.tickSizeSpot,
      lotSize: 'lotSize' in displayMarketDefinition ? displayMarketDefinition.lotSize : displayMarketDefinition.lotSizeSpot,
      markPrice: liveDataForActiveInstrument.markPrice?.price ?? liveDataForActiveInstrument.summary?.markPrice,
      lastTradePrice: liveDataForActiveInstrument.lastTrade?.price,
      prevTradePrice: liveDataForActiveInstrument.lastTrade?.prevPrice,
      change24h: liveDataForActiveInstrument.summary?.change24h,
      volume24h: liveDataForActiveInstrument.summary?.volume24h,
      openInterest: liveDataForActiveInstrument.summary?.openInterest,
      indexPrice: liveDataForActiveInstrument.summary?.indexPrice,
      fundingRate: liveDataForActiveInstrument.fundingRate?.fundingRate ?? liveDataForActiveInstrument.summary?.fundingRate,
      timeToExpiry: 'expiryTs' in displayMarketDefinition && displayMarketDefinition.expiryTs ? formatTimeToExpiry(displayMarketDefinition.expiryTs) : null,
      isDerivativeView: !!activeInstrumentSymbol && activeInstrumentSymbol !== selectedUnderlying?.symbol,
      quoteAsset: displayMarketDefinition.quoteAsset || "USDC",
      baseAssetForIndexDisplay: baseAssetForIndexContext, // Corrected: Use determined base asset
      tickSizeForIndex: tickSizeForIndexPrice, // Corrected: Use underlying's spot tick size
    };
  }, [selectedUnderlying, displayMarketDefinition, liveDataForActiveInstrument, activeInstrumentSymbol]);


  // ... (Skeleton loading and No Market Selected JSX as before) ...
  if (isLoadingUnderlyings && !selectedUnderlying) {
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

  if (!selectedUnderlying) { // This implies displayMarketDefinition will also be null
    return (
      <div className={styles.infoBar}>
        <div className={styles.marketTitleSection}>
            <Tooltip content="No Underlying Selected">
              <Layers size={18} className={styles.mainIcon} />
            </Tooltip>
             <h2 className={styles.marketSymbolDisplay}>Select Pair</h2>
        </div>
        {/* Optionally show a minimal set of empty info items or a message */}
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
        <Tooltip content={`Underlying Pair: ${selectedUnderlying.symbol}`}>
            <div className={styles.underlyingPairDisplay}>
                <Layers size={16} className={styles.mainIcon} />
                <span>{selectedUnderlying.symbol}</span>
            </div>
        </Tooltip>

        {displayValues.isDerivativeView && displayValues.symbol !== selectedUnderlying.symbol && (
            <>
                <span className={styles.separator}>›</span>
                <h2 className={styles.marketSymbolDisplay} title={displayValues.symbol}>
                    {displayValues.symbol.replace(selectedUnderlying.symbol + "-", "")}
                </h2>
            </>
        )}
        
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
        ) : isWsConnected && activeInstrumentSymbol ? ( // Show skeleton only if an instrument is active
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
            <Tooltip content={`Index Price: Oracle-based price of the underlying ${displayValues.baseAssetForIndexDisplay || 'asset'}.`}>
                <div className={styles.infoItem}>
                    <span className={styles.label}>Index <Info size={12} /></span>
                    <span className={styles.value}>
                        {isWsConnected && displayValues.indexPrice !== null && displayValues.indexPrice !== undefined ? formatPrice(displayValues.indexPrice, displayValues.tickSizeForIndex) : <SkeletonLoader width="70px" />}
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
                <span className={styles.value}>{isWsConnected && displayValues.openInterest !== "N/A" ? formatBigNumber(displayValues.openInterest) : (isWsConnected ? "N/A" : <SkeletonLoader width="80px" />)}</span>
            </div>
        </Tooltip>

        <Tooltip content="24h Volume: Total value traded in the last 24 hours (in quote currency).">
            <div className={styles.infoItem}>
                <span className={styles.label}>24h Volume</span>
                <span className={styles.value}>{isWsConnected && displayValues.volume24h !== "N/A" ? formatBigNumber(displayValues.volume24h, '0') : (isWsConnected ? "0" :<SkeletonLoader width="70px" />)}</span>
            </div>
        </Tooltip>
      </div>
    </div>
  );
};

export default MarketInfoBar;