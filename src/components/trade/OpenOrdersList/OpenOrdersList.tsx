/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/OpenOrdersList/OpenOrdersList.tsx
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import styles from './OpenOrdersList.module.css';
import { useAccountContext } from '@/contexts/AccountContext';
import { useMarketContext } from '@/contexts/MarketContext';
import DataTable, { ColumnDefinition } from '@/components/ui/DataTable/DataTable';
import Button from '@/components/ui/Button/Button';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { Order, UnderlyingPairMeta, InstrumentMarketMeta } from '@/lib/interfaces';
import { XCircle, Trash2, ListFilter } from 'lucide-react';
import Modal from '@/components/ui/Modal/Modal';

// Formatting helpers (ensure these are robust or imported from a shared util)
const formatOrderPrice = (price: number | undefined, marketMeta: UnderlyingPairMeta | InstrumentMarketMeta | null): string => {
  if (price === undefined) return '-.--';
  const tickSize = marketMeta ? ('tickSize' in marketMeta ? marketMeta.tickSize : marketMeta.tickSizeSpot) : undefined;
  if (tickSize === undefined || typeof tickSize !== 'number' || isNaN(tickSize) || tickSize <= 0) {
    return price.toFixed(2);
  }
  const precision = Math.max(0, tickSize.toString().split('.')[1]?.length || 0);
  return price.toFixed(precision);
};

const formatOrderQuantity = (quantity: number, marketMeta: UnderlyingPairMeta | InstrumentMarketMeta | null): string => {
  const lotSize = marketMeta ? ('lotSize' in marketMeta ? marketMeta.lotSize : marketMeta.lotSizeSpot) : undefined;
  if (lotSize === undefined || typeof lotSize !== 'number' || isNaN(lotSize) || lotSize <= 0) {
    if (Math.abs(quantity) < 0.0001 && quantity !== 0) return quantity.toExponential(2);
    if (Math.abs(quantity) < 1) return quantity.toFixed(4);
    return quantity.toFixed(2);
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
  const { availableUnderlyings, selectedUnderlying, activeInstrumentSymbol } = useMarketContext();

  const [filterMode, setFilterMode] = useState<FilterMode>("ACTIVE_INSTRUMENT"); // Default to active instrument
  const [isCancelling, setIsCancelling] = useState<string | null | 'all_displayed'>(null);
  const [showCancelAllConfirm, setShowCancelAllConfirm] = useState(false);

  const getMarketMetaForOrder = useCallback((orderMarketSymbol: string): UnderlyingPairMeta | InstrumentMarketMeta | null => {
    // First, check if it's a direct underlying (spot market)
    const underlyingMatch = availableUnderlyings.find(u => u.symbol === orderMarketSymbol && u.type === "SPOT");
    if (underlyingMatch) return underlyingMatch;

    // If not, it's a derivative. We need to find its definition.
    // This requires querying MarketsTable by the instrument symbol.
    // For simplicity in this UI component, we'll assume the necessary tick/lot for formatting
    // can be derived from its *underlyingPairSymbol* defaults if the specific InstrumentMarketMeta isn't readily available here.
    // A more robust solution would be for AccountContext.openOrders to potentially enrich orders with their full MarketMeta.
    
    // Attempt to find full InstrumentMarketMeta from a cached/global list if available
    // (This part is tricky without a central cache of all InstrumentMarketMetas)
    // For now, we find the *underlying* to get default derivative tick/lot sizes.
    const underlyingSymbolForDerivative = orderMarketSymbol.split('-')[0] + '/' + orderMarketSymbol.split('-')[1].substring(0, orderMarketSymbol.split('-')[1].search(/(OPT|FUT|PERP)/));
    const parentUnderlying = availableUnderlyings.find(u => u.symbol === underlyingSymbolForDerivative);

    if (parentUnderlying) {
        if (orderMarketSymbol.includes("-OPT-")) return { ...parentUnderlying, tickSize: parentUnderlying.defaultOptionTickSize, lotSize: parentUnderlying.defaultOptionLotSize, type: "OPTION" } as any;
        if (orderMarketSymbol.includes("-FUT-")) return { ...parentUnderlying, tickSize: parentUnderlying.defaultFutureTickSize, lotSize: parentUnderlying.defaultFutureLotSize, type: "FUTURE" } as any;
        if (orderMarketSymbol.endsWith("-PERP")) return { ...parentUnderlying, tickSize: parentUnderlying.defaultPerpTickSize || 0.01, lotSize: parentUnderlying.defaultPerpLotSize || 0.001, type: "PERP" } as any; // Fallback if defaults missing
    }
    return null; // Fallback if no meta found
  }, [availableUnderlyings]);


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
    let filtered = openOrders;
    if (filterMode === "UNDERLYING" && selectedUnderlying) {
      filtered = openOrders.filter(order => 
        order.market === selectedUnderlying.symbol || // Spot orders on the underlying
        order.underlyingPairSymbol === selectedUnderlying.symbol || // Derivatives based on this underlying
        (order.market.startsWith(selectedUnderlying.symbol + "-") && (order.market.endsWith("PERP") || order.market.includes("-OPT-") || order.market.includes("-FUT-")))
      );
    } else if (filterMode === "ACTIVE_INSTRUMENT" && activeInstrumentSymbol) {
      filtered = openOrders.filter(order => order.market === activeInstrumentSymbol);
    }
    // Default ("ALL_OPEN") shows all openOrders from context (which are already mode-filtered)
    return filtered;
  }, [openOrders, filterMode, selectedUnderlying, activeInstrumentSymbol]);

  const handleCancelAllDisplayedOrders = async () => {
    setShowCancelAllConfirm(false);
    if (displayedOrders.length === 0) {
      notify.error('No orders to cancel.'); return;
    }
    setIsCancelling('all_displayed');
    const loadingToastId = notify.loading(`Cancelling ${displayedOrders.length} order(s)...`);
    let successCount = 0, failCount = 0;

    for (const order of displayedOrders) {
      try {
        const response = await fetch(`/api/orders/${order.orderId}`, { method: 'DELETE' });
        if (response.ok) successCount++;
        else {
            failCount++;
            console.warn(`Failed to cancel order ${order.orderId}: ${await response.text()}`);
        }
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
      render: (o) => o.orderType === 'MARKET' ? 'Market' : formatOrderPrice(o.price, getMarketMetaForOrder(o.market)),
      accessor: (o) => o.price, sortable: true,
    },
    {
      key: 'qty', header: 'Amount',
      render: (o) => formatOrderQuantity(o.qty, getMarketMetaForOrder(o.market)),
      accessor: (o) => o.qty, sortable: true,
    },
    {
      key: 'filledQty', header: 'Filled',
      render: (o) => {
         const marketMeta = getMarketMetaForOrder(o.market);
         const filled = formatOrderQuantity(o.filledQty, marketMeta);
         const total = formatOrderQuantity(o.qty, marketMeta);
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
            <Button variant="ghost" size="sm" iconLeft={<ListFilter size={14} />} className={styles.filterToggleButton}>
                {getFilterButtonText()}
            </Button>
            <div className={styles.filterDropdownContent}>
                <button onClick={() => setFilterMode("ALL_OPEN")} className={filterMode === "ALL_OPEN" ? styles.activeFilter : ""}>All Open Orders</button>
                <button onClick={() => setFilterMode("UNDERLYING")} disabled={!selectedUnderlying} className={filterMode === "UNDERLYING" ? styles.activeFilter : ""}>
                    {selectedUnderlying ? `Pair: ${selectedUnderlying.symbol}` : "Pair (select one)"}
                </button>
                <button onClick={() => setFilterMode("ACTIVE_INSTRUMENT")} disabled={!activeInstrumentSymbol} className={filterMode === "ACTIVE_INSTRUMENT" ? styles.activeFilter : ""}>
                    {activeInstrumentSymbol ? `Instrument: ${activeInstrumentSymbol}` : "Instrument (active)"}
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
        pagination itemsPerPage={7} // Fewer items per page for open orders list
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