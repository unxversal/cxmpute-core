/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/OpenOrdersList/OpenOrdersList.tsx
"use client";

import React, { useState, useMemo } from 'react';
import styles from './OpenOrdersList.module.css';
import { useAccountContext } from '@/contexts/AccountContext';
import { useMarketContext } from '@/contexts/MarketContext'; // For selectedUnderlying and activeInstrumentSymbol filters
import DataTable, { ColumnDefinition } from '@/components/ui/DataTable/DataTable';
import Button from '@/components/ui/Button/Button';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { Order } from '@/lib/interfaces'; // Order interface now includes optional tickSize, lotSize, etc.
import { XCircle, ListFilter, Trash2 } from 'lucide-react'; // Changed Filter to ListFilter
import Modal from '@/components/ui/Modal/Modal';

// Formatting helpers
const formatOrderPrice = (price: number | undefined, tickSize: number | undefined): string => {
  if (price === undefined) return '-.--';
  if (tickSize === undefined || typeof tickSize !== 'number' || isNaN(tickSize) || tickSize <= 0) {
    return price.toFixed(2); // Default if tickSize not available on order object
  }
  const precision = Math.max(0, tickSize.toString().split('.')[1]?.length || 0);
  return price.toFixed(precision);
};

const formatOrderQuantity = (quantity: number, lotSize: number | undefined): string => {
  if (lotSize === undefined || typeof lotSize !== 'number' || isNaN(lotSize) || lotSize <= 0) {
    if (Math.abs(quantity) < 0.0001 && quantity !== 0) return quantity.toExponential(2);
    if (Math.abs(quantity) < 1) return quantity.toFixed(4);
    return quantity.toFixed(2); // Default if lotSize not available
  }
  const precision = Math.max(0, lotSize.toString().split('.')[1]?.length || 0);
  return quantity.toFixed(precision);
};

const formatOrderTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString(undefined, {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
};

type FilterMode = "ALL_OPEN" | "UNDERLYING" | "ACTIVE_INSTRUMENT";

const OpenOrdersList: React.FC = () => {
  const { openOrders, isLoading, error, refreshOpenOrders } = useAccountContext();
  const { selectedUnderlying, activeInstrumentSymbol } = useMarketContext();

  const [filterMode, setFilterMode] = useState<FilterMode>("ACTIVE_INSTRUMENT");
  const [isCancelling, setIsCancelling] = useState<string | null | 'all_displayed'>(null);
  const [showCancelAllConfirm, setShowCancelAllConfirm] = useState(false);

  const handleCancelOrder = async (orderId: string) => {
    setIsCancelling(orderId);
    const loadingToastId = notify.loading(`Cancelling order ${orderId.substring(0,6)}...`);
    try {
      const response = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      notify.dismiss(loadingToastId);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Failed to cancel order`);
      notify.success(`Order ${orderId.substring(0,6)} cancelled.`);
      refreshOpenOrders(); 
    } catch (err: any) {
      notify.dismiss(loadingToastId);
      notify.error(err.message || 'Cancellation failed.');
    } finally {
      setIsCancelling(null);
    }
  };

  const displayedOrders = useMemo(() => {
    let filtered = openOrders; // openOrders from context are already status: OPEN or PARTIAL
    if (filterMode === "UNDERLYING" && selectedUnderlying) {
      filtered = openOrders.filter(order => 
        order.market === selectedUnderlying.symbol || // Spot orders on the underlying
        order.underlyingPairSymbol === selectedUnderlying.symbol || // Derivatives based on this underlying
        (order.market.startsWith(selectedUnderlying.symbol + "-")) // General check for derivatives
      );
    } else if (filterMode === "ACTIVE_INSTRUMENT" && activeInstrumentSymbol) {
      filtered = openOrders.filter(order => order.market === activeInstrumentSymbol);
    }
    return filtered;
  }, [openOrders, filterMode, selectedUnderlying, activeInstrumentSymbol]);

  const handleCancelAllDisplayedOrders = async () => {
    setShowCancelAllConfirm(false);
    if (displayedOrders.length === 0) {
      notify.error('No orders to cancel for the current filter.'); return;
    }
    setIsCancelling('all_displayed');
    const loadingToastId = notify.loading(`Cancelling ${displayedOrders.length} order(s)...`);
    let successCount = 0, failCount = 0;

    for (const order of displayedOrders) {
      try {
        const response = await fetch(`/api/orders/${order.orderId}`, { method: 'DELETE' });
        if (response.ok) successCount++;
        else { failCount++; console.warn(`Failed to cancel order ${order.orderId}: ${await response.text()}`); }
      } catch (err) { failCount++; console.warn(`Error cancelling ${order.orderId}:`, err); }
    }
    notify.dismiss(loadingToastId);
    if (successCount > 0) notify.success(`${successCount} order(s) cancelled.`);
    if (failCount > 0) notify.error(`${failCount} order(s) failed to cancel.`);
    refreshOpenOrders();
    setIsCancelling(null);
  };

  const columns: ColumnDefinition<Order>[] = [
    { key: 'createdAt', header: 'Date', render: (o) => formatOrderTimestamp(o.createdAt), accessor: o => o.createdAt, sortable: true, width: '110px' },
    { key: 'market', header: 'Market', render: (o) => <span className={styles.marketCell}>{o.market}</span>, sortable: true, filterable: true, width: '180px' },
    { key: 'side', header: 'Side', render: (o) => <span className={o.side === 'BUY' ? styles.buySide : styles.sellSide}>{o.side}</span>, sortable: true, filterable: true, filterKey: o => o.side },
    { key: 'orderType', header: 'Type', render: (o) => o.orderType, sortable: true, filterable: true },
    {
      key: 'price', header: 'Price',
      // Order object now directly contains its specific tickSize for formatting
      render: (o) => o.orderType === 'MARKET' ? 'Market' : formatOrderPrice(o.price, o.tickSize),
      accessor: (o) => o.price, sortable: true,
    },
    {
      key: 'qty', header: 'Amount',
      // Order object now directly contains its specific lotSize for formatting
      render: (o) => formatOrderQuantity(o.qty, o.lotSize),
      accessor: (o) => o.qty, sortable: true,
    },
    {
      key: 'filledQty', header: 'Filled',
      render: (o) => {
         const filled = formatOrderQuantity(o.filledQty, o.lotSize); // Use order's own lotSize
         const total = formatOrderQuantity(o.qty, o.lotSize);
         const percentage = o.qty > 0 ? ((o.filledQty / o.qty) * 100).toFixed(0) : "0";
         return <div className={styles.filledCell}><span>{filled} / {total}</span> <span className={styles.filledPercentage}>({percentage}%)</span></div>;
      },
      accessor: (o) => o.qty > 0 ? o.filledQty / o.qty : 0, sortable: true,
    },
    { key: 'status', header: 'Status', render: (o) => <span className={`${styles.statusCell} ${styles[o.status.toLowerCase()]}`}>{o.status}</span>, sortable: true, filterable: true },
    {
      key: 'actions', header: ' ',
      render: (order) => (
        <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); handleCancelOrder(order.orderId); }}
          isLoading={isCancelling === order.orderId} disabled={!!isCancelling} className={styles.cancelButton} title={`Cancel order`}>
          <XCircle size={14} />
        </Button>
      ),
    },
  ];

  const getFilterButtonText = () => {
    if (filterMode === "ACTIVE_INSTRUMENT") return activeInstrumentSymbol || "Active Instrument";
    if (filterMode === "UNDERLYING") return selectedUnderlying?.symbol || "Selected Underlying";
    return "All Open";
  };

  return (
    <div className={styles.openOrdersContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Open Orders ({displayedOrders.length})</h3>
        <div className={styles.controls}>
          <div className={styles.filterDropdownWrapper}>
            <Button variant="ghost" size="sm" iconLeft={<ListFilter size={14} />} className={styles.filterToggleButton} aria-haspopup="true">
                {getFilterButtonText()}
            </Button>
            <div className={styles.filterDropdownContent} role="menu">
                <button role="menuitem" onClick={() => setFilterMode("ALL_OPEN")} className={filterMode === "ALL_OPEN" ? styles.activeFilter : ""}>All Open Orders</button>
                <button role="menuitem" onClick={() => setFilterMode("UNDERLYING")} disabled={!selectedUnderlying} className={filterMode === "UNDERLYING" ? styles.activeFilter : ""}>
                    {selectedUnderlying ? `Pair: ${selectedUnderlying.symbol}` : "Pair (select one)"}
                </button>
                <button role="menuitem" onClick={() => setFilterMode("ACTIVE_INSTRUMENT")} disabled={!activeInstrumentSymbol} className={filterMode === "ACTIVE_INSTRUMENT" ? styles.activeFilter : ""}>
                    {activeInstrumentSymbol ? `Instrument: ${activeInstrumentSymbol.split('#')[0]}` : "Instrument (active)"} 
                </button>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={() => setShowCancelAllConfirm(true)}
            disabled={isCancelling === 'all_displayed' || displayedOrders.length === 0}
            isLoading={isCancelling === 'all_displayed'} iconLeft={<Trash2 size={14} />}>
            Cancel Displayed ({displayedOrders.length})
          </Button>
        </div>
      </div>

      <DataTable<Order>
        columns={columns}
        data={displayedOrders}
        isLoading={isLoading.orders && openOrders.length === 0}
        error={error.orders}
        emptyStateMessage={filterMode === "ALL_OPEN" ? "No open orders." : `No open orders match filter: ${getFilterButtonText()}.`}
        rowKey={(order) => order.orderId}
        pagination itemsPerPage={7}
        showGlobalFilter globalFilterPlaceholder="Search by market, side, type..."
        initialSortKey="createdAt" initialSortDirection="desc"
        skeletonRowCount={5}
      />

      <Modal isOpen={showCancelAllConfirm} onClose={() => setShowCancelAllConfirm(false)} title="Confirm Cancel All Displayed Orders" size="sm">
        <p>Cancel {displayedOrders.length} order(s)? This action cannot be undone.</p>
        <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setShowCancelAllConfirm(false)}>Back</Button>
            <Button variant="danger" onClick={handleCancelAllDisplayedOrders}>Confirm Cancel</Button>
        </div>
      </Modal>
    </div>
  );
};

export default OpenOrdersList;