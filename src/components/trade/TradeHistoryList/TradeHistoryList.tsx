/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/TradeHistoryList/TradeHistoryList.tsx
"use client";

import React, { useMemo } from 'react';
import styles from './TradeHistoryList.module.css';
import { useAccountContext } from '@/contexts/AccountContext';
// MarketContext is not needed if Trade objects are fully enriched by the API
import DataTable, { ColumnDefinition } from '@/components/ui/DataTable/DataTable';
import Button from '@/components/ui/Button/Button';
import type { Trade } from '@/lib/interfaces'; // Trade interface now includes optional tickSize, lotSize, etc.
import { RefreshCw } from 'lucide-react';

// Formatting helpers
const formatTradePrice = (price: number | undefined, tickSize: number | undefined): string => {
  if (price === undefined || typeof price !== 'number' || isNaN(price)) return '-.--';
  const ts = tickSize !== undefined && tickSize > 0 ? tickSize : 0.01; // Fallback tickSize
  const precision = Math.max(0, ts.toString().split('.')[1]?.length || 0);
  return price.toFixed(precision);
};

const formatTradeQuantity = (quantity: number | undefined, lotSize: number | undefined, baseAsset?: string): string => {
  if (quantity === undefined || typeof quantity !== 'number' || isNaN(quantity)) return '0.00';
  const ls = lotSize !== undefined && lotSize > 0 ? lotSize : 0.0001; // Fallback lotSize
  const precision = Math.max(0, ls.toString().split('.')[1]?.length || 0);
  const formattedQty = quantity.toFixed(precision);
  return `${formattedQty}${baseAsset ? ' ' + baseAsset.replace(/^s/, '') : ''}`;
};

const formatFee = (fee: number | undefined, quoteAsset?: string, quoteDecimalsDefault: number = 2): string => {
  if (fee === undefined || typeof fee !== 'number' || isNaN(fee)) return '-.--';
  const decimals = quoteAsset === "USDC" || quoteAsset === "USDT" ? 6 : quoteDecimalsDefault;
  return `${fee.toFixed(Math.max(decimals, 4))}${quoteAsset ? ' ' + quoteAsset : ''}`;
};

const formatTradeTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString(undefined, {
    year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
};

// DisplayTrade is now just Trade, as Trade is enriched
type DisplayTrade = Trade;

const TradeHistoryList: React.FC = () => {
  const {
    tradeHistory, // This is now Trade[] where each Trade can have tickSize, lotSize, etc.
    tradeHistoryNextToken,
    isLoading,
    error,
    loadMoreTradeHistory,
    refreshAllAccountData,
  } = useAccountContext();
  // No longer need useMarketContext for availableMarkets if trades are enriched

  // displayTrades is now directly tradeHistory as enrichment happens in API/AccountContext
  const displayTrades: DisplayTrade[] = useMemo(() => tradeHistory, [tradeHistory]);

  const columns: ColumnDefinition<DisplayTrade>[] = [
    {
      key: 'timestamp', header: 'Date',
      render: (trade) => formatTradeTimestamp(trade.timestamp),
      accessor: (trade) => trade.timestamp, sortable: true, width: '140px',
    },
    {
      key: 'market', header: 'Market',
      render: (trade) => <span className={styles.marketCell}>{trade.market}</span>,
      sortable: true, filterable: true, width: '180px',
    },
    {
      key: 'side', header: 'Side',
      render: (trade) => <span className={trade.side === 'BUY' ? styles.buySide : styles.sellSide}>{trade.side}</span>,
      sortable: true, filterable: true, filterKey: (trade) => trade.side,
    },
    {
      key: 'price', header: 'Price',
      render: (trade) => formatTradePrice(trade.price, trade.tickSize), // Use trade.tickSize
      accessor: (trade) => trade.price, sortable: true,
    },
    {
      key: 'qty', header: 'Quantity',
      render: (trade) => formatTradeQuantity(trade.qty, trade.lotSize, trade.baseAsset), // Use trade.lotSize, trade.baseAsset
      accessor: (trade) => trade.qty, sortable: true,
    },
    {
      key: 'takerFee', header: 'Fee', // Assuming Trade interface has takerFee and quoteAsset
      render: (trade) => {
        const feeValue = trade.takerFee !== undefined ? trade.takerFee : (trade as any).fee;
        return formatFee(feeValue, trade.quoteAsset); // Use trade.quoteAsset
      },
      accessor: (trade) => trade.takerFee !== undefined ? trade.takerFee : (trade as any).fee,
      sortable: true,
    },
     {
      key: 'tradeId', header: 'Trade ID',
      render: (trade) => <span className={styles.tradeIdCell} title={trade.tradeId}>{trade.tradeId.substring(0, 8)}...</span>,
      filterable: true,
    },
  ];

  const handleRefresh = () => {
    refreshAllAccountData(); // This refreshes orders, positions, balances, AND first page of trade history
  };

  return (
    <div className={styles.tradeHistoryContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Trade History</h3>
        <Button
            variant="ghost" size="sm" onClick={handleRefresh}
            disabled={isLoading.history || isLoading.orders || isLoading.positions || isLoading.balances}
            iconLeft={<RefreshCw size={14} className={(isLoading.history && tradeHistory.length === 0) ? styles.spin : ''} />}
            title="Refresh account data (including trade history)"
        >
            Refresh
        </Button>
      </div>

      <DataTable<DisplayTrade>
        columns={columns}
        data={displayTrades} // This is now directly the enriched tradeHistory
        isLoading={isLoading.history && tradeHistory.length === 0}
        error={error.history}
        emptyStateMessage="No trades found in your history."
        rowKey={(trade) => trade.tradeId}
        showGlobalFilter globalFilterPlaceholder="Search trade history..."
        skeletonRowCount={10}
      />

      {tradeHistoryNextToken && !isLoading.history && (
        <div className={styles.loadMoreContainer}>
          <Button onClick={loadMoreTradeHistory} variant="secondary"
            isLoading={isLoading.history && tradeHistory.length > 0} // Show loading on button if loading more
          >
            Load More Trades
          </Button>
        </div>
      )}
       {isLoading.history && tradeHistory.length > 0 && ( // Show button in loading state if loading more
        <div className={styles.loadMoreContainer}>
            <Button isLoading={true} variant="secondary" disabled>Loading...</Button>
        </div>
      )}
    </div>
  );
};

export default TradeHistoryList;