// src/components/trade/MarketInfoBar/MarketInfoBar.tsx
"use client";

import React, { useMemo } from 'react';
import styles from './MarketInfoBar.module.css';
import { useMarketContext } from '@/contexts/MarketContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { useWebSocket } from '@/contexts/WebsocketContext';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
import Tooltip from '@/components/ui/Tooltip/Tooltip';
import { TrendingUp, Zap, Clock, Info, Percent, Activity } from 'lucide-react';

// Helper to format numbers with appropriate precision
const formatPrice = (price: number | undefined | null, tickSize: number | undefined): string => {
  if (price === undefined || price === null || typeof price !== 'number' || isNaN(price)) return '-.--';
  if (tickSize === undefined || typeof tickSize !== 'number' || isNaN(tickSize) || tickSize <= 0) return price.toFixed(2); // Default precision if tickSize is invalid
  
  // Calculate precision based on tickSize. Example: 0.01 -> 2, 0.0001 -> 4, 1 -> 0
  const tickStr = tickSize.toString();
  const decimalPart = tickStr.split('.')[1];
  const precision = decimalPart ? decimalPart.length : 0;
  
  return price.toFixed(precision);
};

const formatPercentage = (value: number | undefined | null, decimals: number = 2, displaySign: boolean = false): string => {
  if (value === undefined || value === null || typeof value !== 'number' || isNaN(value)) return '-.--%';
  const sign = displaySign && value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(decimals)}%`;
};

const formatVolume = (volume: number | string | undefined | null): string => {
  if (volume === undefined || volume === null || volume === "N/A") return 'N/A';
  const numVolume = Number(volume);
  if (isNaN(numVolume)) return 'N/A';

  if (numVolume >= 1_000_000_000) return `${(numVolume / 1_000_000_000).toFixed(2)}B`;
  if (numVolume >= 1_000_000) return `${(numVolume / 1_000_000).toFixed(2)}M`;
  if (numVolume >= 1_000) return `${(numVolume / 1_000).toFixed(1)}K`;
  return numVolume.toLocaleString(undefined, {maximumFractionDigits: 0}); // Add commas for numbers < 1000
};

const formatNumberDisplay = (value: number | string | undefined | null): string => {
    if (value === undefined || value === null || value === "N/A") return 'N/A';
    const numValue = Number(value);
    if (isNaN(numValue)) return 'N/A';
    // For open interest, which can be fractional (e.g., crypto contracts)
    if (numValue % 1 !== 0) { // has decimals
        return numValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return numValue.toLocaleString(undefined, { maximumFractionDigits: 0 });
}


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
  const { selectedMarket, isLoadingMarkets } = useMarketContext();
  const { currentMode } = useTradingMode();
  const { marketData, connectionStatus } = useWebSocket();

  const isWsConnected = connectionStatus === 'OPEN';

  const displayData = useMemo(() => {
    const baseData = {
        symbol: 'N/A',
        markPrice: null,
        lastTradePrice: null,
        lastTradePrevPrice: null,
        tickSize: undefined,
        fundingRate: null,
        timeToExpiry: null,
        type: undefined,
        openInterest: 'N/A',
        volume24h: 'N/A',
        change24h: null,
        indexPrice: null,
    };

    if (!selectedMarket) {
      return baseData;
    }

    const summary = marketData.summary?.market === selectedMarket.symbol && marketData.summary?.mode === currentMode
      ? marketData.summary
      : null;
    
    const liveMarkPriceData = marketData.markPrice?.market === selectedMarket.symbol && marketData.markPrice?.mode === currentMode
      ? marketData.markPrice
      : null;
    
    const liveLastTrade = marketData.lastTrade?.market === selectedMarket.symbol && marketData.lastTrade?.mode === currentMode
      ? marketData.lastTrade
      : null;
    
    const liveFundingRateData = marketData.fundingRate?.market === selectedMarket.symbol && marketData.fundingRate?.mode === currentMode
      ? marketData.fundingRate
      : null;

    return {
      symbol: selectedMarket.symbol,
      markPrice: liveMarkPriceData?.price ?? summary?.markPrice ?? null,
      lastTradePrice: liveLastTrade?.price,
      lastTradePrevPrice: liveLastTrade?.prevPrice,
      tickSize: selectedMarket.tickSize,
      fundingRate: liveFundingRateData?.fundingRate ?? summary?.fundingRate ?? null,
      timeToExpiry: formatTimeToExpiry(selectedMarket.expiryTs),
      type: selectedMarket.type,
      openInterest: summary?.openInterest ?? 'N/A',
      volume24h: summary?.volume24h ?? 'N/A',
      change24h: summary?.change24h ?? null,
      indexPrice: summary?.indexPrice ?? null,
    };
  }, [selectedMarket, currentMode, marketData]);

  if (isLoadingMarkets && !selectedMarket) {
    return (
      <div className={styles.infoBar}>
        <SkeletonLoader type="text" width="150px" height="28px" className={styles.skeletonTitle} />
        <div className={styles.infoGrid}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`skel-item-${i}`} className={styles.infoItem}>
              <SkeletonLoader type="text" width="80px" height="14px" className={styles.skeletonLabel}/>
              <SkeletonLoader type="text" width="60px" height="18px" className={styles.skeletonValue}/>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedMarket) {
    return (
      <div className={styles.infoBar}>
        <h2 className={styles.marketSymbolDisplay}>No Market Selected</h2>
      </div>
    );
  }
  
  const primaryPriceToDisplay = displayData.lastTradePrice ?? displayData.markPrice;
  let priceColorClass = styles.priceNeutral; // Default neutral color
  if (displayData.lastTradePrice !== null && displayData.lastTradePrice !== undefined &&
      displayData.lastTradePrevPrice !== null && displayData.lastTradePrevPrice !== undefined) {
      if (displayData.lastTradePrice > displayData.lastTradePrevPrice) priceColorClass = styles.priceUp;
      else if (displayData.lastTradePrice < displayData.lastTradePrevPrice) priceColorClass = styles.priceDown;
  }


  return (
    <div className={styles.infoBar}>
      <div className={styles.marketTitleSection}>
        <h2 className={styles.marketSymbolDisplay}>{displayData.symbol}</h2>
        <div className={`${styles.priceDisplay} ${priceColorClass}`}>
          {isWsConnected && primaryPriceToDisplay !== null ? formatPrice(primaryPriceToDisplay, displayData.tickSize) : <SkeletonLoader width="100px" height="28px" />}
        </div>
        {isWsConnected && displayData.change24h !== null ? (
            <span className={`${styles.change24h} ${displayData.change24h >= 0 ? styles.priceUp : styles.priceDown}`}>
                <TrendingUp size={14} style={{ marginRight: '4px', transform: displayData.change24h < 0 ? 'rotate(180deg)' : 'none' }} />
                {formatPercentage(displayData.change24h, 2, true)}
            </span>
        ) : isWsConnected ? (
            <span className={styles.change24h}><SkeletonLoader width="60px" height="18px" /></span>
        ) : (
            <SkeletonLoader width="70px" height="20px" className={styles.change24hSkeleton} />
        )}
      </div>

      <div className={styles.infoGrid}>
        <Tooltip content="Current estimated fair value of the contract. Used for PnL calculation and liquidations.">
          <div className={styles.infoItem}>
            <span className={styles.label}>Mark <Activity size={12}/></span>
            <span className={styles.value}>
              {isWsConnected && displayData.markPrice !== null ? formatPrice(displayData.markPrice, displayData.tickSize) : <SkeletonLoader width="70px" />}
            </span>
          </div>
        </Tooltip>

        {(displayData.type === 'PERP' || displayData.type === 'FUTURE') && (
            <Tooltip content="Price of the underlying asset from oracle sources.">
                <div className={styles.infoItem}>
                    <span className={styles.label}>Index <Info size={12} /></span>
                    <span className={styles.value}>
                        {isWsConnected && displayData.indexPrice !== null ? formatPrice(displayData.indexPrice, displayData.tickSize) : <SkeletonLoader width="70px" />}
                    </span>
                </div>
            </Tooltip>
        )}

        {(displayData.type === 'PERP') && displayData.fundingRate !== null && (
          <Tooltip content="Periodic payment exchanged between long and short positions, displayed as an 8-hour rate. Positive: longs pay shorts.">
            <div className={styles.infoItem}>
              <span className={styles.label}>Funding / 8h <Percent size={12} /></span>
              <span className={`${styles.value} ${displayData.fundingRate > 0 ? styles.priceUpStrong : displayData.fundingRate < 0 ? styles.priceDownStrong : ''}`}>
                {isWsConnected ? formatPercentage(displayData.fundingRate, 4) : <SkeletonLoader width="60px" />}
              </span>
            </div>
          </Tooltip>
        )}

        {(displayData.type === 'FUTURE' || displayData.type === 'OPTION') && displayData.timeToExpiry && (
          <Tooltip content="Time remaining until the contract expires.">
            <div className={styles.infoItem}>
              <span className={styles.label}>Expires In <Clock size={12} /></span>
              <span className={styles.value}>{displayData.timeToExpiry}</span>
            </div>
          </Tooltip>
        )}
        
        <Tooltip content="Total value of all open positions in this market (in base currency units).">
            <div className={styles.infoItem}>
                <span className={styles.label}>Open Interest <Zap size={12} /></span>
                <span className={styles.value}>{isWsConnected ? formatNumberDisplay(displayData.openInterest) : <SkeletonLoader width="80px" />}</span>
            </div>
        </Tooltip>

        <Tooltip content="Total trading volume in the last 24 hours (in quote currency units).">
            <div className={styles.infoItem}>
                <span className={styles.label}>24h Volume</span>
                <span className={styles.value}>{isWsConnected ? formatVolume(displayData.volume24h) : <SkeletonLoader width="70px" />}</span>
            </div>
        </Tooltip>
      </div>
    </div>
  );
};

export default MarketInfoBar;