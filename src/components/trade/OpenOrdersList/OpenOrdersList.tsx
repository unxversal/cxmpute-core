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
import type { Order } from '@/lib/interfaces';
import { XCircle, Filter, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal/Modal'; // For cancel all confirmation
import Tooltip from '@/components/ui/Tooltip/Tooltip';

// Formatting helpers (similar to those in RecentTrades, consider moving to utils)
const formatOrderPrice = (price: number | undefined, tickSize: number | undefined): string => {
  if (price === undefined) return '-.--';
  if (tickSize === undefined || typeof tickSize !== 'number' || isNaN(tickSize) || tickSize <= 0) {
    return price.toFixed(2);
  }
  const precision = Math.max(0, tickSize.toString().split('.')[1]?.length || 0);
  return price.toFixed(precision);
};

const formatOrderQuantity = (quantity: number, lotSize: number | undefined): string => {
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
    year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
};


const OpenOrdersList: React.FC = () => {
  const { openOrders, isLoading, error, refreshOpenOrders } = useAccountContext();
  const { availableMarkets, selectedMarket } = useMarketContext(); // Get all available markets for tick/lot sizes

  const [filterByCurrentMarket, setFilterByCurrentMarket] = useState(true);
  const [isCancelling, setIsCancelling] = useState<string | null | 'all'>(null); // orderId, 'all', or null
  const [showCancelAllConfirm, setShowCancelAllConfirm] = useState(false);

  const getMarketMeta = useCallback((marketSymbol: string) => {
    return availableMarkets.find(m => m.symbol === marketSymbol);
  }, [availableMarkets]);

  const handleCancelOrder = async (orderId: string) => {
    setIsCancelling(orderId);
    const loadingToastId = notify.loading(`Cancelling order ${orderId.substring(0,6)}...`);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        // Body might not be needed if orderId is in path, but some APIs expect it.
        // Our DELETE /api/orders/[orderId]/route.ts doesn't read body.
      });
      notify.dismiss(loadingToastId);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to cancel order ${orderId}`);
      }
      notify.success(`Order ${orderId.substring(0,6)} cancelled.`);
      refreshOpenOrders(); // Refresh the list from context
    } catch (err: any) {
      notify.dismiss(loadingToastId);
      console.error('Error cancelling order:', err);
      notify.error(err.message || 'Cancellation failed.');
    } finally {
      setIsCancelling(null);
    }
  };

  const handleCancelAllOrders = async () => {
    setShowCancelAllConfirm(false); // Close confirm modal
    const ordersToCancel = displayedOrders; // Cancel only currently displayed orders
    if (ordersToCancel.length === 0) {
      notify('No orders to cancel.');
      return;
    }

    setIsCancelling('all');
    const loadingToastId = notify.loading(`Cancelling ${ordersToCancel.length} order(s)...`);
    let successCount = 0;
    let failCount = 0;

    for (const order of ordersToCancel) {
      try {
        const response = await fetch(`/api/orders/${order.orderId}`, { method: 'DELETE' });
        if (response.ok) {
          successCount++;
        } else {
          const res = await response.json();
          console.warn(`Failed to cancel order ${order.orderId}: ${res.error || response.statusText}`);
          failCount++;
        }
      } catch (err) {
        console.warn(`Error during bulk cancel for order ${order.orderId}:`, err);
        failCount++;
      }
    }
    notify.dismiss(loadingToastId);
    if (successCount > 0) notify.success(`${successCount} order(s) cancelled.`);
    if (failCount > 0) notify.error(`${failCount} order(s) failed to cancel. See console for details.`);
    
    refreshOpenOrders();
    setIsCancelling(null);
  };


  const displayedOrders = useMemo(() => {
    if (filterByCurrentMarket && selectedMarket) {
      return openOrders.filter(order => order.market === selectedMarket.symbol);
    }
    return openOrders;
  }, [openOrders, filterByCurrentMarket, selectedMarket]);


  const columns: ColumnDefinition<Order>[] = [
    {
      key: 'market',
      header: 'Market',
      render: (order) => <span className={styles.marketCell}>{order.market}</span>,
      sortable: true,
      filterable: true,
    },
    {
      key: 'side',
      header: 'Side',
      render: (order) => (
        <span className={order.side === 'BUY' ? styles.buySide : styles.sellSide}>
          {order.side}
        </span>
      ),
      sortable: true,
      filterable: true, // Allow filtering by BUY/SELL
      filterKey: (order) => order.side,
    },
    {
      key: 'orderType',
      header: 'Type',
      render: (order) => order.orderType,
      sortable: true,
      filterable: true,
    },
    {
      key: 'price',
      header: 'Price',
      render: (order) => {
        const marketMeta = getMarketMeta(order.market);
        return order.orderType === 'MARKET' ? 'Market' : formatOrderPrice(order.price, marketMeta?.tickSize);
      },
      accessor: (order) => order.price, // For sorting
      sortable: true,
    },
    {
      key: 'qty',
      header: 'Amount',
      render: (order) => {
        const marketMeta = getMarketMeta(order.market);
        return formatOrderQuantity(order.qty, marketMeta?.lotSize);
      },
      accessor: (order) => order.qty,
      sortable: true,
    },
    {
      key: 'filledQty',
      header: 'Filled',
      render: (order) => {
         const marketMeta = getMarketMeta(order.market);
         const filled = formatOrderQuantity(order.filledQty, marketMeta?.lotSize);
         const total = formatOrderQuantity(order.qty, marketMeta?.lotSize);
         const percentage = order.qty > 0 ? ((order.filledQty / order.qty) * 100).toFixed(0) : "0";
         return (
            <div className={styles.filledCell}>
                <span>{filled} / {total}</span>
                <span className={styles.filledPercentage}>({percentage}%)</span>
            </div>
         );
      },
      accessor: (order) => order.filledQty / order.qty, // Sort by fill percentage
      sortable: true,
    },
     {
      key: 'status',
      header: 'Status',
      render: (order) => <span className={`${styles.statusCell} ${styles[order.status.toLowerCase()]}`}>{order.status}</span>,
      sortable: true,
      filterable: true,
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (order) => formatOrderTimestamp(order.createdAt),
      accessor: (order) => order.createdAt,
      sortable: true,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (order) => (
        <Button
          variant="danger"
          size="sm"
          onClick={(e) => { e.stopPropagation(); handleCancelOrder(order.orderId); }}
          isLoading={isCancelling === order.orderId}
          disabled={!!isCancelling} // Disable if any cancel is in progress
          className={styles.cancelButton}
          title={`Cancel order ${order.orderId.substring(0,6)}`}
        >
          <XCircle size={14} />
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.openOrdersContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Open Orders ({displayedOrders.length})</h3>
        <div className={styles.controls}>
          <Tooltip content={filterByCurrentMarket ? "Show all open orders" : "Show orders for current market only"}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterByCurrentMarket(!filterByCurrentMarket)}
              iconLeft={<Filter size={14} />}
              className={filterByCurrentMarket ? styles.filterButtonActive : styles.filterButton}
            >
              {filterByCurrentMarket && selectedMarket ? selectedMarket.symbol : 'All Markets'}
            </Button>
          </Tooltip>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowCancelAllConfirm(true)}
            disabled={isCancelling === 'all' || displayedOrders.length === 0}
            isLoading={isCancelling === 'all'}
            iconLeft={<Trash2 size={14} />}
          >
            Cancel All Displayed
          </Button>
        </div>
      </div>

      <DataTable<Order>
        columns={columns}
        data={displayedOrders}
        isLoading={isLoading.orders && openOrders.length === 0} // Show skeleton only on initial full load
        error={error.orders}
        emptyStateMessage="No open orders."
        rowKey={(order) => order.orderId}
        pagination
        itemsPerPage={10}
        showGlobalFilter // Enable global text filter for the table
        globalFilterPlaceholder="Search open orders..."
        initialSortKey="createdAt" // Default sort by newest
        initialSortDirection="desc"
        skeletonRowCount={5}
      />

      <Modal
        isOpen={showCancelAllConfirm}
        onClose={() => setShowCancelAllConfirm(false)}
        title="Confirm Cancel All Orders"
        size="sm"
      >
        <p>Are you sure you want to cancel all ({displayedOrders.length}) currently displayed open orders?</p>
        <p>This action cannot be undone.</p>
        <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setShowCancelAllConfirm(false)}>Back</Button>
            <Button variant="danger" onClick={handleCancelAllOrders}>Confirm Cancel All</Button>
        </div>
      </Modal>
    </div>
  );
};

export default OpenOrdersList;