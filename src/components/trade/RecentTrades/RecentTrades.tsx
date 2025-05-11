// src/components/trade/RecentTrades/RecentTrades.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import styles from './RecentTrades.module.css';
import { useWebSocket } from '@/contexts/WebsocketContext';
import { useMarketContext } from '@/contexts/MarketContext';
import type { WsTrade } from '@/lib/interfaces'; // Ensure WsTrade interface is correct
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';

const MAX_TRADES_TO_DISPLAY = 30;

const formatTradePrice = (price: number, tickSize: number | undefined): string => {
  if (tickSize === undefined || typeof tickSize !== 'number' || isNaN(tickSize) || tickSize <= 0) {
    return price.toFixed(2);
  }
  const precision = tickSize.toString().split('.')[1]?.length || 0;
  return price.toFixed(precision);
};

const formatTradeQuantity = (quantity: number, lotSize: number | undefined): string => {
   if (lotSize === undefined || typeof lotSize !== 'number' || isNaN(lotSize) || lotSize <= 0) {
      if (Math.abs(quantity) < 0.0001 && quantity !== 0) return quantity.toExponential(2);
      if (Math.abs(quantity) < 1) return quantity.toFixed(4);
      if (Math.abs(quantity) < 100) return quantity.toFixed(2);
      return quantity.toFixed(0);
  }
  const precision = lotSize.toString().split('.')[1]?.length || 0;
  return quantity.toFixed(precision);
};

const formatTradeTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const RecentTrades: React.FC = () => {
  const { marketData, connectionStatus } = useWebSocket();
  const { selectedMarket, isLoadingMarkets } = useMarketContext(); // isLoadingMarkets is correctly destructured here
  const [trades, setTrades] = useState<WsTrade[]>([]);

  const isWsConnected = connectionStatus === 'OPEN';

  useEffect(() => {
    if (
      marketData.lastTrade &&
      selectedMarket &&
      marketData.lastTrade.market === selectedMarket.symbol &&
      marketData.lastTrade.mode === selectedMarket.mode
    ) {
      setTrades((prevTrades) => {
        if (prevTrades.find(t => t.tradeId === marketData.lastTrade!.tradeId)) {
          return prevTrades;
        }
        const newTrades = [marketData.lastTrade!, ...prevTrades];
        return newTrades.slice(0, MAX_TRADES_TO_DISPLAY);
      });
    }
  }, [marketData.lastTrade, selectedMarket]);

  useEffect(() => {
    setTrades([]);
  }, [selectedMarket]);

  const memoizedTrades = useMemo(() => trades, [trades]);

  // Derive base and quote assets from symbol
  const [baseAsset, quoteAsset] = useMemo(() => {
    if (selectedMarket?.symbol) {
      const parts = selectedMarket.symbol.split(/[-/]/); // Split by hyphen or slash
      if (parts.length >= 2) {
        return [parts[0], parts[1]]; // e.g., BTC, USDC or BTC, PERP
      }
      return [selectedMarket.symbol, 'QUOTE']; // Fallback if format is unexpected
    }
    return ['BASE', 'QUOTE'];
  }, [selectedMarket?.symbol]);


  const renderSkeletonRows = (rowCount: number) => (
    <>
      {Array.from({ length: rowCount }).map((_, index) => (
        <tr key={`skeleton-trade-${index}`} className={styles.tradeRow}>
          <td className={styles.priceCell}><SkeletonLoader width="60px" height="16px" /></td>
          <td className={styles.quantityCell}><SkeletonLoader width="50px" height="16px" /></td>
          <td className={styles.timeCell}><SkeletonLoader width="70px" height="16px" /></td>
        </tr>
      ))}
    </>
  );

  return (
    <div className={styles.recentTradesContainer}>
      <h3 className={styles.title}>Recent Trades</h3>
      <div className={styles.tableWrapper}>
        <table className={styles.tradesTable}>
          <thead>
            <tr>
              <th className={styles.priceHeader}>Price ({quoteAsset})</th>
              <th className={styles.quantityHeader}>Quantity ({baseAsset})</th>
              <th className={styles.timeHeader}>Time</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingMarkets && memoizedTrades.length === 0 && renderSkeletonRows(5)}

            {!isLoadingMarkets && !isWsConnected && memoizedTrades.length === 0 && (
                <tr>
                    <td colSpan={3} className={styles.statusMessage}>Connecting to feed...</td>
                </tr>
            )}

            {!isLoadingMarkets && isWsConnected && memoizedTrades.length === 0 && (
                <tr>
                    <td colSpan={3} className={styles.statusMessage}>No recent trades for this market.</td>
                </tr>
            )}

            {memoizedTrades.length > 0 &&
              memoizedTrades.map((trade) => {
                let priceClass = styles.priceNeutral;
                if (trade.prevPrice !== undefined && trade.prevPrice !== null) {
                    if (trade.price > trade.prevPrice) priceClass = styles.priceUp;
                    else if (trade.price < trade.prevPrice) priceClass = styles.priceDown;
                } else {
                    if (trade.side === 'BUY') priceClass = styles.priceUp;
                    else if (trade.side === 'SELL') priceClass = styles.priceDown;
                }

                return (
                  <tr key={trade.tradeId} className={styles.tradeRow}>
                    <td className={`${styles.priceCell} ${priceClass}`}>
                      {formatTradePrice(trade.price, selectedMarket?.tickSize)}
                    </td>
                    <td className={styles.quantityCell}>
                      {formatTradeQuantity(trade.qty, selectedMarket?.lotSize)}
                    </td>
                    <td className={styles.timeCell}>
                      {formatTradeTime(trade.timestamp)}
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentTrades;