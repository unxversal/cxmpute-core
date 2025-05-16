// src/components/trade/PositionsList/PositionsList.tsx
"use client";

import React, { useState, useMemo } from 'react';
import styles from './PositionsList.module.css';
import { useAccountContext } from '@/contexts/AccountContext';
import { useWebSocket } from '@/contexts/WebsocketContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { useAuth } from '@/contexts/AuthContext';
import DataTable, { ColumnDefinition } from '@/components/ui/DataTable/DataTable';
import Button from '@/components/ui/Button/Button';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { Position } from '@/lib/interfaces'; // Position from interfaces
import { XOctagon } from 'lucide-react';
import Modal from '@/components/ui/Modal/Modal';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';

// Formatting helpers
const formatPositionPrice = (price: number | undefined | null, tickSize: number | undefined): string => {
  if (price === undefined || price === null || typeof price !== 'number' || isNaN(price)) return '-.--';
  const ts = tickSize !== undefined && tickSize > 0 ? tickSize : 0.01;
  const precision = Math.max(0, ts.toString().split('.')[1]?.length || 0);
  return price.toFixed(precision);
};

const formatPositionSize = (size: number | undefined | null, lotSize: number | undefined, baseAsset?: string): string => {
  if (size === undefined || size === null || typeof size !== 'number' || isNaN(size)) return '0.00';
  const absSize = Math.abs(size);
  const sign = size > 0 ? '+' : size < 0 ? '-' : '';
  const ls = lotSize !== undefined && lotSize > 0 ? lotSize : 0.0001;
  const precision = Math.max(0, ls.toString().split('.')[1]?.length || 0);
  const formattedSize = absSize.toFixed(precision);
  return `${sign}${formattedSize}${baseAsset ? ' ' + baseAsset.replace(/^s/, '') : ''}`;
};

const formatPnl = (pnl: number | undefined | null, quoteAsset?: string, decimals: number = 2): string => {
  if (pnl === undefined || pnl === null || typeof pnl !== 'number' || isNaN(pnl)) return '-.--';
  const displayDecimals = Math.min(decimals, 4);
  return `${pnl.toFixed(displayDecimals)}${quoteAsset ? ' ' + quoteAsset : ''}`;
};

// This type is for items that will be rendered in the DataTable.
// It includes the base Position fields and the client-side calculated live fields.
interface DisplayPosition extends Position {
  liveMarkPrice?: number | null;       // Calculated from WebSocket
  liveUnrealizedPnl?: number | null;   // Calculated from WebSocket
  // Note: tickSize, lotSize, baseAsset, quoteAsset are now expected on the base Position object from context
}

const PositionsList: React.FC = () => {
  const { positions, isLoading, error, refreshPositions } = useAccountContext(); // `positions` are `Position[]`
  const { marketSpecificData } = useWebSocket();
  const { currentMode } = useTradingMode();
  const { user } = useAuth();

  const [isClosingPosition, setIsClosingPosition] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState<DisplayPosition | null>(null);

  const displayPositions: DisplayPosition[] = useMemo(() => {
    return positions.map((pos: Position): DisplayPosition => { // Explicitly type pos as Position
      let liveMarkPrice: number | null = null;
      let liveUnrealizedPnl: number | null = (typeof pos.unrealizedPnl === 'number') ? pos.unrealizedPnl : null;

      const directMark = marketSpecificData.markPrice?.market === pos.market &&
                         marketSpecificData.markPrice?.mode === pos.mode
                       ? marketSpecificData.markPrice : null;
      const summary = marketSpecificData.summary?.market === pos.market &&
                      marketSpecificData.summary?.mode === pos.mode
                    ? marketSpecificData.summary : null;

      if (directMark && (!summary?.markPrice || (summary && directMark.timestamp >= summary.timestamp))) {
        liveMarkPrice = directMark.price;
      } else if (summary?.markPrice !== null && summary?.markPrice !== undefined) {
        liveMarkPrice = summary.markPrice;
      }
      
      if (liveMarkPrice !== null && typeof pos.avgEntryPrice === 'number' && typeof pos.size === 'number') {
        let pnlMultiplier = 1;
        // The `pos.instrumentType` and `pos.lotSize` are now expected to be on the `Position` object
        // coming from the backend enrichment via AccountContext.
        if ((pos.instrumentType === "OPTION" || pos.instrumentType === "FUTURE") && pos.lotSize && pos.lotSize > 0) {
            pnlMultiplier = pos.lotSize;
        }
        liveUnrealizedPnl = (liveMarkPrice - pos.avgEntryPrice) * pos.size * pnlMultiplier;
      }

      return {
        ...pos, // Spread all properties of the original Position object
        liveMarkPrice,
        liveUnrealizedPnl,
        // No need to add marketMeta here if base Position object has tickSize, lotSize etc.
      };
    });
  }, [positions, marketSpecificData]);

  const handleInitiateClosePosition = (position: DisplayPosition) => {
    if (position.size !== 0) setShowCloseConfirm(position);
    else notify.error("Position size is zero, cannot close.");
  };

  const handleConfirmClosePosition = async () => { /* ... same as before ... */
    if (!showCloseConfirm) return;
    const positionToClose = showCloseConfirm;
    if (!user?.properties.traderId) {
      notify.error("User not identified."); setShowCloseConfirm(null); return;
    }
    setShowCloseConfirm(null);
    setIsClosingPosition(positionToClose.market);
    const loadingToastId = notify.loading(`Closing ${positionToClose.market}...`);
    try {
      const marketOrderPayload = {
        traderId: user.properties.traderId, market: positionToClose.market,
        side: positionToClose.size > 0 ? 'SELL' : 'BUY',
        qty: Math.abs(positionToClose.size), orderType: 'MARKET', mode: currentMode,
      };
      const response = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marketOrderPayload),
      });
      notify.dismiss(loadingToastId);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Failed to close ${positionToClose.market}`);
      notify.success(`Market order placed to close ${positionToClose.market}.`);
      setTimeout(() => refreshPositions(), 2500);
    } catch (err: unknown) {
      notify.dismiss(loadingToastId); console.error('Error closing position:', err);
      notify.error(err instanceof Error ? err.message : 'Failed to close position.');
    } finally { setIsClosingPosition(null); }
  };


  const columns: ColumnDefinition<DisplayPosition>[] = [
    { key: 'market', header: 'Market', render: (pos) => <span className={styles.marketCell}>{pos.market}</span>, sortable: true, filterable: true },
    { key: 'size', header: 'Size',
      render: (pos: DisplayPosition) => <span className={pos.size > 0 ? styles.longSize : pos.size < 0 ? styles.shortSize : styles.neutralSize}>
          {formatPositionSize(pos.size, pos.lotSize, pos.baseAsset)} {/* Use pos.lotSize & pos.baseAsset directly */}
        </span>,
      accessor: (pos) => pos.size, sortable: true,
    },
    { key: 'avgEntryPrice', header: 'Avg. Entry', 
      render: (pos: DisplayPosition) => formatPositionPrice(pos.avgEntryPrice, pos.tickSize), // Use pos.tickSize
      accessor: (pos) => pos.avgEntryPrice, sortable: true,
    },
    { key: 'liveMarkPrice', header: 'Mark Price',
      render: (pos: DisplayPosition) => pos.liveMarkPrice !== null && pos.liveMarkPrice !== undefined ? 
                formatPositionPrice(pos.liveMarkPrice, pos.tickSize) : // Use pos.tickSize
                <SkeletonLoader width="60px" height="14px"/>,
      accessor: (pos) => pos.liveMarkPrice, sortable: true,
    },
    { key: 'unrealizedPnl', header: 'Unrealized P&L',
      render: (pos: DisplayPosition) => <span className={ pos.liveUnrealizedPnl === null || pos.liveUnrealizedPnl === undefined ? '' : (pos.liveUnrealizedPnl > 0 ? styles.pnlPositive : pos.liveUnrealizedPnl < 0 ? styles.pnlNegative : styles.pnlNeutral)}>
          {pos.liveUnrealizedPnl !== null && pos.liveUnrealizedPnl !== undefined ? formatPnl(pos.liveUnrealizedPnl, pos.quoteAsset) : <SkeletonLoader width="70px" height="14px"/>}
        </span>,
      accessor: (pos) => pos.liveUnrealizedPnl, sortable: true,
    },
    { key: 'realizedPnl', header: 'Realized P&L', 
      render: (pos: DisplayPosition) => formatPnl(pos.realizedPnl, pos.quoteAsset), // Use pos.quoteAsset
      accessor: (pos) => pos.realizedPnl, sortable: true, 
    },
    { key: 'actions', header: ' ',
      render: (pos: DisplayPosition) => (pos.size !== 0 ? (
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleInitiateClosePosition(pos); }}
            isLoading={isClosingPosition === pos.market} disabled={!!isClosingPosition} className={styles.closeButton}
            title={`Close position in ${pos.market}`} iconLeft={<XOctagon size={14}/>}>Close</Button>
        ) : null ),
    },
  ];

  const activePositions = useMemo(() => displayPositions.filter(p => typeof p.size === 'number' && p.size !== 0), [displayPositions]);

  return (
    <div className={styles.positionsContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Positions ({activePositions.length})</h3>
      </div>
      <DataTable<DisplayPosition> 
        columns={columns}
        data={activePositions} 
        isLoading={isLoading.positions && positions.length === 0}
        error={error.positions}
        emptyStateMessage="No open positions."
        rowKey={(pos, index) => `${pos.market}-${pos.traderId || index}`}
        pagination={true} itemsPerPage={5} // Add an ellipsis (...) or a value
        showGlobalFilter globalFilterPlaceholder="Search positions..."
        skeletonRowCount={3}
      />
      {showCloseConfirm && ( // showCloseConfirm is DisplayPosition | null
        <Modal isOpen={!!showCloseConfirm} onClose={() => setShowCloseConfirm(null)}
            title={`Confirm Close Position: ${showCloseConfirm.market}`} size="md">
            <p>
                You are about to close your position of 
                <strong className={showCloseConfirm.size > 0 ? styles.longSizeModal : styles.shortSizeModal}>
                    {`${formatPositionSize(showCloseConfirm.size, showCloseConfirm.lotSize, showCloseConfirm.baseAsset)}`}
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