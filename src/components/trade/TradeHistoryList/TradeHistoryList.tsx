/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/TradeHistoryList/TradeHistoryList.tsx
"use client";

import React, { useMemo, useCallback } from 'react'; // Removed useState as it's not used directly here for loading
import styles from './TradeHistoryList.module.css';
import { useAccountContext } from '@/contexts/AccountContext';
import { useMarketContext } from '@/contexts/MarketContext';
import DataTable, { ColumnDefinition } from '@/components/ui/DataTable/DataTable';
import Button from '@/components/ui/Button/Button';
import type { Trade, MarketMeta } from '@/lib/interfaces';
import { RefreshCw } from 'lucide-react';

// Formatting helpers
const formatTradePrice = (price: number | undefined, tickSize: number | undefined): string => {
  if (price === undefined || typeof price !== 'number' || isNaN(price)) return '-.--';
  if (tickSize === undefined || typeof tickSize !== 'number' || isNaN(tickSize) || tickSize <= 0) {
    return price.toFixed(2);
  }
  const precision = Math.max(0, tickSize.toString().split('.')[1]?.length || 0);
  return price.toFixed(precision);
};

const formatTradeQuantity = (quantity: number | undefined, lotSize: number | undefined): string => {
  if (quantity === undefined || typeof quantity !== 'number' || isNaN(quantity)) return '0.00';
  if (lotSize === undefined || typeof lotSize !== 'number' || isNaN(lotSize) || lotSize <= 0) {
    if (Math.abs(quantity) < 0.0001 && quantity !== 0) return quantity.toExponential(2);
    if (Math.abs(quantity) < 1) return quantity.toFixed(4);
    return quantity.toFixed(2);
  }
  const precision = Math.max(0, lotSize.toString().split('.')[1]?.length || 0);
  return quantity.toFixed(precision);
};

const formatFee = (fee: number | undefined, quoteDecimals: number = 2): string => {
  if (fee === undefined || typeof fee !== 'number' || isNaN(fee)) return '-.--';
  return fee.toFixed(Math.max(quoteDecimals, 4));
};

const formatTradeTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString(undefined, {
    year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
};

interface DisplayTrade extends Trade {
    marketMeta?: MarketMeta | null;
}

const TradeHistoryList: React.FC = () => {
  const {
    tradeHistory,
    tradeHistoryNextToken,
    isLoading, // This is the global loading state for the AccountContext
    error,
    loadMoreTradeHistory,
    refreshAllAccountData, // <<< FIX: Use this for refreshing all account data, including history
  } = useAccountContext();
  const { availableMarkets } = useMarketContext();

  const getMarketMeta = useCallback((marketSymbol: string): MarketMeta | null => {
    return availableMarkets.find(m => m.symbol === marketSymbol) || null;
  }, [availableMarkets]);

  const displayTrades: DisplayTrade[] = useMemo(() => {
    return tradeHistory.map(trade => ({
        ...trade,
        marketMeta: getMarketMeta(trade.market),
    }));
  }, [tradeHistory, getMarketMeta]);

  const columns: ColumnDefinition<DisplayTrade>[] = [
    {
      key: 'timestamp',
      header: 'Date',
      render: (trade) => formatTradeTimestamp(trade.timestamp),
      accessor: (trade) => trade.timestamp,
      sortable: true,
      width: '140px',
    },
    {
      key: 'market',
      header: 'Market',
      render: (trade) => <span className={styles.marketCell}>{trade.market}</span>,
      sortable: true,
      filterable: true,
      width: '120px',
    },
    {
      key: 'side',
      header: 'Side',
      render: (trade) => (
        <span className={trade.side === 'BUY' ? styles.buySide : styles.sellSide}>
          {trade.side}
        </span>
      ),
      sortable: true,
      filterable: true,
      filterKey: (trade) => trade.side,
    },
    {
      key: 'price',
      header: 'Price',
      render: (trade) => formatTradePrice(trade.price, trade.marketMeta?.tickSize),
      accessor: (trade) => trade.price,
      sortable: true,
    },
    {
      key: 'qty',
      header: 'Quantity',
      render: (trade) => formatTradeQuantity(trade.qty, trade.marketMeta?.lotSize),
      accessor: (trade) => trade.qty,
      sortable: true,
    },
    {
      key: 'takerFee', // Adapt based on your Trade interface's fee field(s)
      header: 'Fee',
      render: (trade) => {
        // Ensure 'fee' or 'takerFee' exists on the trade object
        const feeValue = trade.takerFee ?? (trade as any).fee; // Fallback to 'fee' if 'takerFee' is not present
        const quoteAsset = trade.marketMeta?.symbol.split(/[-/]/)[1] || 'USD';
        const quoteDecimals = (quoteAsset === 'USDC' || quoteAsset === 'USDT') ? 6 : 2;
        return formatFee(feeValue, quoteDecimals);
      },
      accessor: (trade) => trade.takerFee ?? (trade as any).fee,
      sortable: true,
    },
     {
      key: 'tradeId',
      header: 'Trade ID',
      render: (trade) => <span className={styles.tradeIdCell} title={trade.tradeId}>{trade.tradeId.substring(0, 8)}...</span>,
      filterable: true,
    },
  ];

  const handleRefresh = () => {
    // Call the main refresh function from AccountContext
    // This will re-fetch all account data, including the first page of trade history.
    refreshAllAccountData();
  };

  return (
    <div className={styles.tradeHistoryContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Trade History</h3>
        <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading.history || isLoading.orders || isLoading.positions || isLoading.balances} // Disable if any part of account data is loading
            iconLeft={<RefreshCw size={14} className={(isLoading.history && tradeHistory.length === 0) ? styles.spin : ''} />} // Spin only on initial history load
            title="Refresh account data"
        >
            Refresh
        </Button>
      </div>

      <DataTable<DisplayTrade>
        columns={columns}
        data={displayTrades}
        isLoading={isLoading.history && tradeHistory.length === 0}
        error={error.history}
        emptyStateMessage="No trades found in your history."
        rowKey={(trade) => trade.tradeId}
        showGlobalFilter
        globalFilterPlaceholder="Search trade history..."
        skeletonRowCount={10}
      />

      {tradeHistoryNextToken && !isLoading.history && (
        <div className={styles.loadMoreContainer}>
          <Button
            onClick={loadMoreTradeHistory}
            variant="secondary"
            // To show loading specifically for "load more", AccountContext would need a separate loading flag.
            // For now, using the general isLoading.history.
            isLoading={isLoading.history && tradeHistory.length > 0}
          >
            Load More Trades
          </Button>
        </div>
      )}
       {isLoading.history && tradeHistory.length > 0 && (
        <div className={styles.loadMoreContainer}>
            <Button isLoading={true} variant="secondary" disabled>Loading...</Button>
        </div>
      )}
    </div>
  );
};

export default TradeHistoryList;