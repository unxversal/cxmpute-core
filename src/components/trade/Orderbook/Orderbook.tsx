// src/components/trade/OrderBook/OrderBook.tsx
"use client";

import React, { useMemo, useState, useCallback, useEffect, ChangeEvent } from 'react';
import styles from './OrderBook.module.css';
import { useWebSocket } from '@/contexts/WebsocketContext';
import { useMarketContext } from '@/contexts/MarketContext';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
// import { useOrderEntry } from '@/contexts/OrderEntryContext'; // Example

const MAX_ORDER_BOOK_LEVELS = 15;

// Formatting helpers
const formatPrice = (price: number, tickSize: number | undefined): string => {
  if (tickSize === undefined || typeof tickSize !== 'number' || isNaN(tickSize) || tickSize <= 0) {
    return price.toFixed(2);
  }
  const precision = Math.max(0, tickSize.toString().split('.')[1]?.length || 0);
  return price.toFixed(precision);
};

const formatSize = (size: number, lotSize: number | undefined): string => {
  if (lotSize === undefined || typeof lotSize !== 'number' || isNaN(lotSize) || lotSize <= 0) {
    if (Math.abs(size) < 0.0001 && size !== 0) return size.toExponential(2);
    if (Math.abs(size) < 1) return size.toFixed(4);
    if (Math.abs(size) < 100) return size.toFixed(2);
    return size.toFixed(0);
  }
  const precision = Math.max(0, lotSize.toString().split('.')[1]?.length || 0);
  return size.toFixed(precision);
};

interface AggregatedLevel {
  price: number;
  size: number;
  cumulativeSize: number;
}

interface OrderBookRowProps {
  price: number;
  size: number;
  cumulativeSize: number;
  maxCumulativeSize: number;
  type: 'bid' | 'ask';
  aggregationLevel: number; // For formatting price correctly
  tickSize?: number; // Original market ticksize for reference
  lotSize?: number;
  onRowClick?: (price: number, size: number) => void;
}

const OrderBookRow: React.FC<OrderBookRowProps> = React.memo(({
  price,
  size,
  cumulativeSize,
  maxCumulativeSize,
  type,
  aggregationLevel,
  tickSize,
  lotSize,
  onRowClick
}) => {
  const depthPercentage = maxCumulativeSize > 0 ? (cumulativeSize / maxCumulativeSize) * 100 : 0;
  // Price should be formatted to the precision of the aggregationLevel or market tickSize
  const displayTickSize = aggregationLevel > 0 ? aggregationLevel : tickSize;

  return (
    <tr
      className={`${styles.orderRow} ${type === 'bid' ? styles.bidRow : styles.askRow}`}
      onClick={onRowClick ? () => onRowClick(price, size) : undefined}
      tabIndex={onRowClick ? 0 : undefined}
      onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick(price, size); } : undefined}
      aria-label={`Price ${formatPrice(price, displayTickSize)}, Size ${formatSize(size, lotSize)}`}
    >
      <td className={`${styles.priceCell} ${type === 'bid' ? styles.bidPrice : styles.askPrice}`}>
        {formatPrice(price, displayTickSize)}
      </td>
      <td className={styles.sizeCell}>{formatSize(size, lotSize)}</td>
      <td className={styles.cumulativeSizeCell}>{formatSize(cumulativeSize, lotSize)}</td>
      <td className={styles.depthBarCell}>
        <div
          className={`${styles.depthBar} ${type === 'bid' ? styles.bidDepthBar : styles.askDepthBar}`}
          style={{ width: `${depthPercentage}%` }}
        />
      </td>
    </tr>
  );
});
OrderBookRow.displayName = 'OrderBookRow';


const OrderBook: React.FC = () => {
  const { marketData, connectionStatus } = useWebSocket();
  const { selectedMarket, isLoadingMarkets } = useMarketContext();
  // const { setOrderEntryFields } = useOrderEntry();

  const [currentAggregation, setCurrentAggregation] = useState<number>(0.01); // Default, will be updated

  useEffect(() => {
    if (selectedMarket?.tickSize) {
      setCurrentAggregation(selectedMarket.tickSize);
    } else {
      setCurrentAggregation(0.01); // Fallback if tickSize is not available
    }
  }, [selectedMarket?.tickSize]);

  const handleAggregationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newAggregation = parseFloat(event.target.value);
    if (!isNaN(newAggregation) && newAggregation > 0) {
      setCurrentAggregation(newAggregation);
    }
  };

  const handleRowClick = useCallback((price: number, size: number) => {
    console.log(`Order book row clicked: Price=${price}, Size=${size}`);
    // if (setOrderEntryFields) {
    //   setOrderEntryFields({ price: price.toString(), quantity: size.toString() });
    // }
  }, []);

  const processedDepth = useMemo(() => {
    const defaultReturn = { bids: [], asks: [], spread: null, spreadPercentage: null, maxCumulative: 0 };
    if (!marketData.depth || !selectedMarket ||
        marketData.depth.market !== selectedMarket.symbol ||
        marketData.depth.mode !== selectedMarket.mode ||
        currentAggregation <= 0) {
      return defaultReturn;
    }

    const { bids: rawBids, asks: rawAsks } = marketData.depth;

    const aggregateLevels = (
        levels: [number, number][],
        isBids: boolean,
        aggregation: number
      ): AggregatedLevel[] => {
        if (!levels) return [];
        const aggregated: Map<number, number> = new Map();
        
        for (const [price, size] of levels) {
          // Round price to the nearest aggregation level
          // For bids, we floor: e.g., agg=0.5, price 100.3 -> 100.0
          // For asks, we ceil: e.g., agg=0.5, price 100.3 -> 100.5
          let groupKey: number;
          if (isBids) {
            groupKey = Math.floor(price / aggregation) * aggregation;
          } else {
            groupKey = Math.ceil(price / aggregation) * aggregation;
          }
          // Ensure precision for map keys to avoid floating point issues
          const keyPrecision = Math.max(0, aggregation.toString().split('.')[1]?.length || 0);
          groupKey = parseFloat(groupKey.toFixed(keyPrecision));

          aggregated.set(groupKey, (aggregated.get(groupKey) || 0) + size);
        }
      
        const sortedAggregatedLevels = Array.from(aggregated.entries())
          .map(([price, size]) => ({ price, size, cumulativeSize: 0 }))
          .sort((a, b) => isBids ? b.price - a.price : a.price - b.price); // Bids: High to Low, Asks: Low to High

        let cumulativeSize = 0;
        return sortedAggregatedLevels.map(level => {
          cumulativeSize += level.size;
          return { ...level, cumulativeSize };
        }).slice(0, MAX_ORDER_BOOK_LEVELS);
      };

    const aggregatedBids = aggregateLevels(rawBids, true, currentAggregation);
    const aggregatedAsks = aggregateLevels(rawAsks, false, currentAggregation);
        
    // Asks for display are usually reversed (lowest ask closest to spread)
    const displayAsks = [...aggregatedAsks].reverse();

    const bestBidPrice = aggregatedBids.length > 0 ? aggregatedBids[0].price : null;
    const bestAskPrice = aggregatedAsks.length > 0 ? aggregatedAsks[0].price : null; // Lowest ask after sort, before reverse for display

    let spread: number | null = null;
    let spreadPercentage: number | null = null;
    if (bestBidPrice !== null && bestAskPrice !== null && bestAskPrice > bestBidPrice) {
      spread = bestAskPrice - bestBidPrice;
      if (bestBidPrice > 0) {
        spreadPercentage = (spread / bestBidPrice);
      }
    }
    
    const maxCumulativeBid = aggregatedBids[aggregatedBids.length - 1]?.cumulativeSize || 0;
    const maxCumulativeAsk = aggregatedAsks[aggregatedAsks.length - 1]?.cumulativeSize || 0;
    const maxCumulative = Math.max(maxCumulativeBid, maxCumulativeAsk);

    return { bids: aggregatedBids, asks: displayAsks, spread, spreadPercentage, maxCumulative };
  }, [marketData.depth, selectedMarket, currentAggregation]);

  const aggregationOptions = useMemo(() => {
    if (!selectedMarket?.tickSize || selectedMarket.tickSize <= 0) return [0.01, 0.1, 0.5, 1, 5, 10]; // Default options
    const ts = selectedMarket.tickSize;
    return [ts, ts * 5, ts * 10, ts * 50, ts * 100].filter(opt => opt > 0); // Filter out zero or negative
  }, [selectedMarket?.tickSize]);


  const isWsConnected = connectionStatus === 'OPEN';
  const showSkeletons = isLoadingMarkets || (isWsConnected && (!marketData.depth || (processedDepth.bids.length === 0 && processedDepth.asks.length === 0)) && !selectedMarket);


  const renderSkeletonRows = (count: number) => (
    Array.from({ length: count }).map((_, i) => (
      <tr key={`skel-ob-${i}`} className={styles.orderRow}>
        <td className={styles.priceCell}><SkeletonLoader width="70px" /></td>
        <td className={styles.sizeCell}><SkeletonLoader width="60px" /></td>
        <td className={styles.cumulativeSizeCell}><SkeletonLoader width="60px" /></td>
        <td className={styles.depthBarCell}><SkeletonLoader width="100%" height="100%" /></td>
      </tr>
    ))
  );

  const [baseAsset, quoteAsset] = useMemo(() => {
    if (selectedMarket?.symbol) {
      const parts = selectedMarket.symbol.split(/[-/]/);
      return parts.length >= 2 ? [parts[0], parts[1]] : [selectedMarket.symbol, 'QUOTE'];
    }
    return ['BASE', 'QUOTE'];
  }, [selectedMarket?.symbol]);

  return (
    <div className={styles.orderBookContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Order Book</h3>
        <select
          value={currentAggregation}
          onChange={handleAggregationChange}
          className={styles.aggregationSelect}
          disabled={!selectedMarket}
          aria-label="Order book aggregation level"
        >
          {aggregationOptions.map(opt => (
            <option key={opt} value={opt}>
              {formatPrice(opt, opt)} {/* Format option value itself */}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.columns}>
        <div className={`${styles.column} ${styles.asksColumn}`}>
          <table className={styles.orderTable}>
            <thead>
              <tr>
                <th>Price ({quoteAsset})</th>
                <th>Size ({baseAsset})</th>
                <th>Total ({baseAsset})</th>
                <th className={styles.depthHeader}></th>
              </tr>
            </thead>
            <tbody>
              {showSkeletons ? renderSkeletonRows(Math.floor(MAX_ORDER_BOOK_LEVELS / 2) || 5) :
               processedDepth.asks.length === 0 && isWsConnected && selectedMarket ? (
                <tr><td colSpan={4} className={styles.noData}>No asks</td></tr>
               ) :
               processedDepth.asks.map((ask) => (
                <OrderBookRow
                  key={`ask-${ask.price}`}
                  type="ask"
                  price={ask.price}
                  size={ask.size}
                  cumulativeSize={ask.cumulativeSize}
                  maxCumulativeSize={processedDepth.maxCumulative}
                  aggregationLevel={currentAggregation}
                  tickSize={selectedMarket?.tickSize}
                  lotSize={selectedMarket?.lotSize}
                  onRowClick={handleRowClick}
                />
              ))}
            </tbody>
          </table>
        </div>

        {processedDepth.spread !== null && selectedMarket && isWsConnected && (
            <div className={styles.spreadInfo} aria-label="Market Spread">
                <span className={styles.spreadValue} title={`Spread: ${formatPrice(processedDepth.spread, selectedMarket.tickSize)}`}>
                    {formatPrice(processedDepth.spread, selectedMarket.tickSize)}
                </span>
                {processedDepth.spreadPercentage !== null && (
                    <span className={styles.spreadPercentage}>
                        ({(processedDepth.spreadPercentage * 100).toFixed(2)}%)
                    </span>
                )}
            </div>
        )}

        <div className={`${styles.column} ${styles.bidsColumn}`}>
          <table className={styles.orderTable}>
            {/* Headers can be omitted for bids if implied by asks or a central header row */}
            <tbody>
              {showSkeletons ? renderSkeletonRows(Math.floor(MAX_ORDER_BOOK_LEVELS / 2) || 5) :
               processedDepth.bids.length === 0 && isWsConnected && selectedMarket ? (
                <tr><td colSpan={4} className={styles.noData}>No bids</td></tr>
               ) :
               processedDepth.bids.map((bid) => (
                <OrderBookRow
                  key={`bid-${bid.price}`}
                  type="bid"
                  price={bid.price}
                  size={bid.size}
                  cumulativeSize={bid.cumulativeSize}
                  maxCumulativeSize={processedDepth.maxCumulative}
                  aggregationLevel={currentAggregation}
                  tickSize={selectedMarket?.tickSize}
                  lotSize={selectedMarket?.lotSize}
                  onRowClick={handleRowClick}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {!isWsConnected && !isLoadingMarkets && <div className={styles.disconnectedOverlay}>Order Book Disconnected</div>}
    </div>
  );
};

export default OrderBook;