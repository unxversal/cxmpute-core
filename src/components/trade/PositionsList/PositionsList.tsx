// src/components/trade/PositionsList/PositionsList.tsx
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import styles from './PositionsList.module.css';
import { useAccountContext } from '@/contexts/AccountContext';
import { useMarketContext } from '@/contexts/MarketContext';
import { useWebSocket } from '@/contexts/WebsocketContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { useAuth } from '@/contexts/AuthContext'; // <<< FIX: Import useAuth
import DataTable, { ColumnDefinition } from '@/components/ui/DataTable/DataTable';
import Button from '@/components/ui/Button/Button';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { Position, MarketMeta } from '@/lib/interfaces';
import { XOctagon } from 'lucide-react';
import Modal from '@/components/ui/Modal/Modal';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader'; // Ensure this is imported

// Formatting helpers
const formatPositionPrice = (price: number | undefined | null, tickSize: number | undefined): string => {
  if (price === undefined || price === null || typeof price !== 'number' || isNaN(price)) return '-.--';
  if (tickSize === undefined || typeof tickSize !== 'number' || isNaN(tickSize) || tickSize <= 0) {
    return price.toFixed(2);
  }
  const precision = Math.max(0, tickSize.toString().split('.')[1]?.length || 0);
  return price.toFixed(precision);
};

const formatPositionSize = (size: number | undefined | null, lotSize: number | undefined): string => {
  if (size === undefined || size === null || typeof size !== 'number' || isNaN(size)) return '0.00';
  const absSize = Math.abs(size);
  const sign = size > 0 ? '+' : size < 0 ? '-' : ''; // No sign for zero

  if (lotSize === undefined || typeof lotSize !== 'number' || isNaN(lotSize) || lotSize <= 0) {
    let formattedSize: string;
    if (Math.abs(absSize) < 0.0001 && absSize !== 0) formattedSize = absSize.toExponential(2);
    else if (Math.abs(absSize) < 1) formattedSize = absSize.toFixed(4);
    else formattedSize = absSize.toFixed(2);
    return `${sign}${formattedSize}`;
  }
  const precision = Math.max(0, lotSize.toString().split('.')[1]?.length || 0);
  return `${sign}${absSize.toFixed(precision)}`;
};

const formatPnl = (pnl: number | undefined | null, decimals: number = 2): string => {
  if (pnl === undefined || pnl === null || typeof pnl !== 'number' || isNaN(pnl)) return '-.--';
  const displayDecimals = Math.min(decimals, 4);
  return pnl.toFixed(displayDecimals);
};

interface DisplayPosition extends Position {
  liveMarkPrice?: number | null;
  liveUnrealizedPnl?: number | null;
  marketMeta?: MarketMeta | null;
}

const PositionsList: React.FC = () => {
  const { positions, isLoading, error, refreshPositions } = useAccountContext();
  const { availableMarkets } = useMarketContext(); // Removed unused currentMarketContextSelected
  const { marketData: wsMarketData } = useWebSocket();
  const { currentMode } = useTradingMode();
  const { user } = useAuth();

  const [isClosingPosition, setIsClosingPosition] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState<DisplayPosition | null>(null); // <<< FIX: State holds DisplayPosition

  const getMarketMeta = useCallback((marketSymbol: string): MarketMeta | null => {
    return availableMarkets.find(m => m.symbol === marketSymbol) || null;
  }, [availableMarkets]);

  const displayPositions: DisplayPosition[] = useMemo(() => {
    return positions.map(pos => {
      const marketMeta = getMarketMeta(pos.market);
      let liveMarkPrice: number | null = null;
      let liveUnrealizedPnl: number | null = (typeof pos.unrealizedPnl === 'number') ? pos.unrealizedPnl : null;

      const summary = wsMarketData.summary?.market === pos.market && wsMarketData.summary?.mode === currentMode
        ? wsMarketData.summary
        : null;
      const directMark = wsMarketData.markPrice?.market === pos.market && wsMarketData.markPrice?.mode === currentMode
        ? wsMarketData.markPrice
        : null;

      // Prioritize direct mark price if newer or summary mark price doesn't exist
      if (directMark && (!summary?.markPrice || (summary && directMark.timestamp >= summary.timestamp))) {
        liveMarkPrice = directMark.price;
      } else if (summary?.markPrice !== null && summary?.markPrice !== undefined) {
        liveMarkPrice = summary.markPrice;
      }
      
      if (liveMarkPrice !== null && typeof pos.avgEntryPrice === 'number' && typeof pos.size === 'number') {
        liveUnrealizedPnl = (liveMarkPrice - pos.avgEntryPrice) * pos.size;
      }

      return {
        ...pos,
        liveMarkPrice,
        liveUnrealizedPnl,
        marketMeta,
      };
    });
  }, [positions, getMarketMeta, wsMarketData, currentMode]);

  const handleInitiateClosePosition = (position: DisplayPosition) => {
    if (position.size !== 0) {
        setShowCloseConfirm(position);
    } else {
        notify.error("Position size is zero, cannot close.");
    }
  };

  const handleConfirmClosePosition = async () => {
    if (!showCloseConfirm) return;
    const positionToClose = showCloseConfirm;

    if (!user?.properties.traderId) {
        notify.error("User not identified. Cannot close position.");
        setShowCloseConfirm(null);
        return;
    }
    setShowCloseConfirm(null);
    setIsClosingPosition(positionToClose.market);
    const loadingToastId = notify.loading(`Closing position in ${positionToClose.market}...`);

    try {
      const marketOrderPayload = {
        traderId: user.properties.traderId,
        market: positionToClose.market,
        side: positionToClose.size > 0 ? 'SELL' : 'BUY',
        qty: Math.abs(positionToClose.size),
        orderType: 'MARKET',
        mode: currentMode,
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marketOrderPayload),
      });

      notify.dismiss(loadingToastId);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to place market order to close ${positionToClose.market}`);
      }
      notify.success(`Market order placed to close ${positionToClose.market}.`);
      setTimeout(() => refreshPositions(), 2000);
    } catch (err: unknown) { // <<< FIX: Type err as unknown
      notify.dismiss(loadingToastId);
      console.error('Error closing position:', err);
      if (err instanceof Error) {
        notify.error(err.message || 'Failed to close position.');
      } else {
        notify.error('An unknown error occurred while closing position.');
      }
    } finally {
      setIsClosingPosition(null);
    }
  };

  const columns: ColumnDefinition<DisplayPosition>[] = [
    {
      key: 'market',
      header: 'Market',
      render: (pos) => <span className={styles.marketCell}>{pos.market}</span>,
      sortable: true,
      filterable: true,
    },
    {
      key: 'size',
      header: 'Size',
      render: (pos) => (
        <span className={pos.size > 0 ? styles.longSize : pos.size < 0 ? styles.shortSize : styles.neutralSize}>
          {formatPositionSize(pos.size, pos.marketMeta?.lotSize)}
        </span>
      ),
      accessor: (pos) => pos.size,
      sortable: true,
    },
    {
      key: 'avgEntryPrice',
      header: 'Avg. Entry',
      render: (pos) => formatPositionPrice(pos.avgEntryPrice, pos.marketMeta?.tickSize),
      accessor: (pos) => pos.avgEntryPrice,
      sortable: true,
    },
    {
      key: 'liveMarkPrice',
      header: 'Mark Price',
      render: (pos) => pos.liveMarkPrice !== null ? formatPositionPrice(pos.liveMarkPrice, pos.marketMeta?.tickSize) : <SkeletonLoader width="60px" height="16px"/>,
      accessor: (pos) => pos.liveMarkPrice,
      sortable: true,
    },
    {
      key: 'unrealizedPnl',
      header: 'Unrealized PnL',
      render: (pos) => (
        <span className={
          pos.liveUnrealizedPnl === null || pos.liveUnrealizedPnl === undefined ? '' : // <<< FIX: Check for null/undefined
          (pos.liveUnrealizedPnl > 0 ? styles.pnlPositive : pos.liveUnrealizedPnl < 0 ? styles.pnlNegative : styles.pnlNeutral)
        }>
          {pos.liveUnrealizedPnl !== null && pos.liveUnrealizedPnl !== undefined ? formatPnl(pos.liveUnrealizedPnl) : <SkeletonLoader width="70px" height="16px"/>}
        </span>
      ),
      accessor: (pos) => pos.liveUnrealizedPnl,
      sortable: true,
    },
    {
      key: 'realizedPnl',
      header: 'Realized PnL',
      render: (pos) => formatPnl(pos.realizedPnl),
      accessor: (pos) => pos.realizedPnl,
      sortable: true,
    },
    {
      key: 'actions',
      header: ' ',
      render: (pos) => (
        pos.size !== 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleInitiateClosePosition(pos); }}
            isLoading={isClosingPosition === pos.market}
            disabled={!!isClosingPosition || pos.size === 0}
            className={styles.closeButton}
            title={`Close position in ${pos.market}`}
            iconLeft={<XOctagon size={14}/>}
          >
            Close
          </Button>
        ) : null
      ),
    },
  ];

  return (
    <div className={styles.positionsContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Positions ({displayPositions.filter(p => p.size !== 0).length})</h3>
      </div>

      <DataTable<DisplayPosition>
        columns={columns}
        data={displayPositions.filter(p => p.size !== 0)}
        isLoading={isLoading.positions && positions.length === 0}
        error={error.positions}
        emptyStateMessage="No open positions."
        rowKey={(pos, index) => `${pos.market}-${pos.traderId || index}`}
        pagination
        itemsPerPage={10}
        showGlobalFilter
        globalFilterPlaceholder="Search positions..."
        skeletonRowCount={3}
      />

      {showCloseConfirm && (
        <Modal
            isOpen={!!showCloseConfirm}
            onClose={() => setShowCloseConfirm(null)}
            title={`Confirm Close Position: ${showCloseConfirm.market}`}
            size="md"
        >
            <p>
                You are about to close your position of 
                <strong className={showCloseConfirm.size > 0 ? styles.longSizeModal : styles.shortSizeModal}>
                    {`${formatPositionSize(showCloseConfirm.size, showCloseConfirm.marketMeta?.lotSize)} ${showCloseConfirm.marketMeta?.symbol.split(/[-/]/)[0] || ''}`}
                </strong>
                 in {showCloseConfirm.market} by placing a market order.
            </p>
            <p>Are you sure?</p>
            <div className={styles.modalFooter}>
                <Button variant="secondary" onClick={() => setShowCloseConfirm(null)}>Cancel</Button>
                <Button variant="danger" onClick={handleConfirmClosePosition}>Confirm Close</Button>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default PositionsList;