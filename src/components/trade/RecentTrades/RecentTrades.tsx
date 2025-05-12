/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/RecentTrades/RecentTrades.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './RecentTrades.module.css';
import { useWebSocket } from '@/contexts/WebsocketContext';
import { useMarketContext } from '@/contexts/MarketContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import type { WsTrade, UnderlyingPairMeta, ExpiryData } from '@/lib/interfaces';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';

const MAX_TRADES_TO_DISPLAY = 30; // Max number of recent trades to show
const INITIAL_HISTORICAL_FETCH_LIMIT = 30; // How many trades to fetch on initial load

// Formatting helpers
const formatTradePrice = (price: number, tickSize: number | undefined): string => {
  if (tickSize === undefined || typeof tickSize !== 'number' || isNaN(tickSize) || tickSize <= 0) {
    return price.toFixed(2);
  }
  const precision = Math.max(0, tickSize.toString().split('.')[1]?.length || 0);
  return price.toFixed(precision);
};

const formatTradeQuantity = (quantity: number, lotSize: number | undefined): string => {
  if (lotSize === undefined || typeof lotSize !== 'number' || isNaN(lotSize) || lotSize <= 0) {
    if (Math.abs(quantity) < 0.0001 && quantity !== 0) return quantity.toExponential(2);
    if (Math.abs(quantity) < 1) return quantity.toFixed(4);
    return quantity.toFixed(2);
  }
  const precision = Math.max(0, lotSize.toString().split('.')[1]?.length || 0);
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

// Helper to determine current tick/lot size for the active instrument
const getCurrentInstrumentParameters = (
    activeSymbol: string | null,
    underlying: UnderlyingPairMeta | null,
    instrumentsBundle: ReturnType<typeof useMarketContext>['instrumentsForSelectedUnderlying']
): { tickSize?: number; lotSize?: number; baseAsset?: string; quoteAsset?: string } => {
    if (!activeSymbol || !underlying) return {};

    if (activeSymbol === underlying.symbol && underlying.type === "SPOT") {
        return { tickSize: underlying.tickSizeSpot, lotSize: underlying.lotSizeSpot, baseAsset: underlying.baseAsset, quoteAsset: underlying.quoteAsset };
    }
    if (instrumentsBundle?.perp?.symbol === activeSymbol) {
        return { tickSize: instrumentsBundle.perp.tickSize, lotSize: instrumentsBundle.perp.lotSize, baseAsset: instrumentsBundle.perp.baseAsset, quoteAsset: instrumentsBundle.perp.quoteAsset };
    }
    const findInExpiryData = (data?: ExpiryData[]) => {
        if (!data) return null;
        for (const expiry of data) {
            if (expiry.futureInstrument?.instrumentSymbol === activeSymbol) return { tickSize: underlying.defaultFutureTickSize, lotSize: underlying.defaultFutureLotSize, baseAsset: underlying.baseAsset, quoteAsset: underlying.quoteAsset };
            const call = expiry.callStrikes?.find(s => s.instrumentSymbol === activeSymbol);
            if (call) return { tickSize: underlying.defaultOptionTickSize, lotSize: underlying.defaultOptionLotSize, baseAsset: underlying.baseAsset, quoteAsset: underlying.quoteAsset };
            const put = expiry.putStrikes?.find(s => s.instrumentSymbol === activeSymbol);
            if (put) return { tickSize: underlying.defaultOptionTickSize, lotSize: underlying.defaultOptionLotSize, baseAsset: underlying.baseAsset, quoteAsset: underlying.quoteAsset };
        }
        return null;
    };
    return findInExpiryData(instrumentsBundle?.options) || findInExpiryData(instrumentsBundle?.futures) || 
           { tickSize: underlying.tickSizeSpot, lotSize: underlying.lotSizeSpot, baseAsset: underlying.baseAsset, quoteAsset: underlying.quoteAsset }; // Fallback to underlying spot params
};


const RecentTrades: React.FC = () => {
  const { marketSpecificData, connectionStatus } = useWebSocket();
  const { activeInstrumentSymbol, selectedUnderlying, instrumentsForSelectedUnderlying, isLoadingUnderlyings } = useMarketContext();
  const { currentMode } = useTradingMode();
  
  const [trades, setTrades] = useState<WsTrade[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const isWsConnected = connectionStatus === 'OPEN';

  const instrumentParams = useMemo(() => 
    getCurrentInstrumentParameters(activeInstrumentSymbol, selectedUnderlying, instrumentsForSelectedUnderlying),
    [activeInstrumentSymbol, selectedUnderlying, instrumentsForSelectedUnderlying]
  );

  // Fetch initial historical trades when activeInstrumentSymbol or mode changes
  const fetchInitialTrades = useCallback(async () => {
    if (!activeInstrumentSymbol || !currentMode) {
      setTrades([]);
      return;
    }
    setIsLoadingHistory(true);
    setTrades([]); // Clear existing trades before fetching new history
    try {
      const params = new URLSearchParams({
        market: activeInstrumentSymbol,
        mode: currentMode,
        limit: String(INITIAL_HISTORICAL_FETCH_LIMIT),
        // We want most recent, so no startTime/endTime, API should provide latest
      });
      const response = await fetch(`/api/trades/history?${params.toString()}`);
      if (!response.ok) {
        const errData = await response.json().catch(()=>({error: "Failed to parse error"}));
        throw new Error(errData.error || 'Failed to fetch recent trades history.');
      }
      const data: { items: WsTrade[]; nextToken: string | null } = await response.json();
      // API returns oldest first if paginating from start, but for recent trades we want newest first.
      // The /api/trades/history GET handler sorts ScanIndexForward: false
      setTrades(data.items || []); 
    } catch (error: any) {
      console.error("Error fetching initial trades:", error);
      notify.error(error.message || "Could not load recent trades.");
      setTrades([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [activeInstrumentSymbol, currentMode]);

  useEffect(() => {
    fetchInitialTrades();
  }, [fetchInitialTrades]); // Runs when activeInstrumentSymbol or currentMode changes


  // Effect to accumulate new trades from WebSocket
  useEffect(() => {
    if ( isWsConnected && marketSpecificData.lastTrade && activeInstrumentSymbol &&
         marketSpecificData.lastTrade.market === activeInstrumentSymbol &&
         marketSpecificData.lastTrade.mode === currentMode ) {
      
      const newTrade = marketSpecificData.lastTrade;
      setTrades((prevTrades) => {
        // Prevent duplicates and ensure we're adding to the correct market's list
        if (prevTrades.find(t => t.tradeId === newTrade.tradeId)) {
          return prevTrades;
        }
        const updatedTrades = [newTrade, ...prevTrades];
        return updatedTrades.slice(0, MAX_TRADES_TO_DISPLAY);
      });
    }
  }, [marketSpecificData.lastTrade, activeInstrumentSymbol, currentMode, isWsConnected]);


  const memoizedTrades = useMemo(() => trades, [trades]);

  const renderSkeletonRows = (rowCount: number) => (
    <>
      {Array.from({ length: rowCount }).map((_, index) => (
        <tr key={`skeleton-trade-${index}`} className={styles.tradeRow}>
          <td className={styles.priceCell}><SkeletonLoader width="60px" height="14px" /></td>
          <td className={styles.quantityCell}><SkeletonLoader width="50px" height="14px" /></td>
          <td className={styles.timeCell}><SkeletonLoader width="70px" height="14px" /></td>
        </tr>
      ))}
    </>
  );

  const showInitialLoadingSkeletons = (isLoadingUnderlyings || isLoadingHistory) && memoizedTrades.length === 0;

  return (
    <div className={styles.recentTradesContainer}>
      <h3 className={styles.title}>Recent Trades</h3>
      <div className={styles.tableWrapper}>
        <table className={styles.tradesTable}>
          <thead>
            <tr>
              <th className={styles.priceHeader}>Price ({instrumentParams.quoteAsset || 'QUOTE'})</th>
              <th className={styles.quantityHeader}>Amount ({instrumentParams.baseAsset || 'BASE'})</th>
              <th className={styles.timeHeader}>Time</th>
            </tr>
          </thead>
          <tbody>
            {showInitialLoadingSkeletons && renderSkeletonRows(10)}

            {!showInitialLoadingSkeletons && !isWsConnected && memoizedTrades.length === 0 && (
                <tr><td colSpan={3} className={styles.statusMessage}>Feed disconnected.</td></tr>
            )}
            {!showInitialLoadingSkeletons && isWsConnected && memoizedTrades.length === 0 && (
                <tr><td colSpan={3} className={styles.statusMessage}>No recent trades.</td></tr>
            )}

            {!showInitialLoadingSkeletons && memoizedTrades.length > 0 &&
              memoizedTrades.map((trade) => {
                let priceClass = styles.priceNeutral;
                if (trade.prevPrice !== undefined && trade.prevPrice !== null) {
                    if (trade.price > trade.prevPrice) priceClass = styles.priceUp;
                    else if (trade.price < trade.prevPrice) priceClass = styles.priceDown;
                } else { // Fallback to side if prevPrice not available
                    if (trade.side === 'BUY') priceClass = styles.priceUp;
                    else if (trade.side === 'SELL') priceClass = styles.priceDown;
                }

                return (
                  <tr key={trade.tradeId} className={styles.tradeRow}>
                    <td className={`${styles.priceCell} ${priceClass}`}>
                      {formatTradePrice(trade.price, instrumentParams.tickSize)}
                    </td>
                    <td className={styles.quantityCell}>
                      {formatTradeQuantity(trade.qty, instrumentParams.lotSize)}
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