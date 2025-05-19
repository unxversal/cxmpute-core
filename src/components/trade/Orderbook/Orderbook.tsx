// src/components/trade/OrderBook/OrderBook.tsx
"use client";

import React, { useMemo, useState, useCallback, useEffect, ChangeEvent } from 'react';
import styles from './OrderBook.module.css';
import { useWebSocket } from '@/contexts/WebsocketContext'; // Consistent casing
import { useMarketContext, InstrumentsBundle } from '@/contexts/MarketContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { useOrderEntry } from '@/contexts/OrderEntryContext';
import type { UnderlyingPairMeta, ExpiryData, TradingMode } from '@/lib/interfaces';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
import { ChevronDown } from 'lucide-react';

const MAX_ORDER_BOOK_LEVELS_DISPLAY = 12;

const formatPrice = (price: number, tickSize: number | undefined, defaultPrecision = 2): string => {
  if (typeof price !== 'number' || isNaN(price)) return '-.--';
  if (tickSize === undefined || typeof tickSize !== 'number' || isNaN(tickSize) || tickSize <= 0) {
    return price.toFixed(defaultPrecision);
  }
  const precision = Math.max(0, tickSize.toString().split('.')[1]?.length || 0);
  return price.toFixed(precision);
};

const formatSize = (size: number, lotSize: number | undefined, defaultPrecision = 4): string => {
  if (typeof size !== 'number' || isNaN(size)) return '0.00';
  if (lotSize === undefined || typeof lotSize !== 'number' || isNaN(lotSize) || lotSize <= 0) {
    if (Math.abs(size) < 0.00001 && size !== 0) return size.toExponential(2);
    return size.toFixed(defaultPrecision);
  }
  const precision = Math.max(0, lotSize.toString().split('.')[1]?.length || 0);
  return size.toFixed(precision);
};

const getCurrentInstrumentParameters = (
    activeSymbol: string | null,
    underlying: UnderlyingPairMeta | null,
    instrumentsBundle: InstrumentsBundle | null,
    currentMode: TradingMode | null // currentMode is used in constructing PK for some lookups if needed
): { tickSize?: number; lotSize?: number; baseAsset?: string; quoteAsset?: string } => {
    if (!activeSymbol || !underlying || !currentMode) return {};

    if (activeSymbol === underlying.symbol && underlying.type === "SPOT") {
        return { tickSize: underlying.tickSizeSpot, lotSize: underlying.lotSizeSpot, baseAsset: underlying.baseAsset, quoteAsset: underlying.quoteAsset };
    }
    if (instrumentsBundle?.perp?.symbol === activeSymbol) {
        return { tickSize: instrumentsBundle.perp.tickSize, lotSize: instrumentsBundle.perp.lotSize, baseAsset: instrumentsBundle.perp.baseAsset, quoteAsset: instrumentsBundle.perp.quoteAsset };
    }
    const findInExpiryData = (data?: ExpiryData[], type?: "OPTION" | "FUTURE") => {
        if (!data || !type) return null;
        for (const expiry of data) {
            if (type === "FUTURE" && expiry.futureInstrument?.instrumentSymbol === activeSymbol)
                return { tickSize: underlying.defaultFutureTickSize, lotSize: underlying.defaultFutureLotSize, baseAsset: underlying.baseAsset, quoteAsset: underlying.quoteAsset };
            const call = expiry.callStrikes?.find(s => s.instrumentSymbol === activeSymbol);
            if (call && type === "OPTION") return { tickSize: underlying.defaultOptionTickSize, lotSize: underlying.defaultOptionLotSize, baseAsset: underlying.baseAsset, quoteAsset: underlying.quoteAsset };
            const put = expiry.putStrikes?.find(s => s.instrumentSymbol === activeSymbol);
            if (put && type === "OPTION") return { tickSize: underlying.defaultOptionTickSize, lotSize: underlying.defaultOptionLotSize, baseAsset: underlying.baseAsset, quoteAsset: underlying.quoteAsset };
        }
        return null;
    };
    return findInExpiryData(instrumentsBundle?.options, "OPTION") || 
           findInExpiryData(instrumentsBundle?.futures, "FUTURE") || 
           { tickSize: underlying.tickSizeSpot, lotSize: underlying.lotSizeSpot, baseAsset: underlying.baseAsset, quoteAsset: underlying.quoteAsset };
};

interface AggregatedLevel { price: number; size: number; cumulativeSize: number; }

interface OrderBookRowProps {
  price: number; size: number; cumulativeSize: number; maxCumulativeSize: number;
  type: 'bid' | 'ask';
  aggregationLevel: number; tickSize?: number; lotSize?: number;
  onRowClick?: (price: number, size: number, type: 'bid' | 'ask') => void;
}

const OrderBookRow: React.FC<OrderBookRowProps> = React.memo(({
  price, size, cumulativeSize, maxCumulativeSize, type,
  aggregationLevel, tickSize, lotSize, onRowClick
}) => {
  const depthPercentage = maxCumulativeSize > 0 ? Math.min(100, (cumulativeSize / maxCumulativeSize) * 100) : 0;
  const displayTickSize = aggregationLevel > 0 ? aggregationLevel : tickSize;

  const handleClick = () => {
    if (onRowClick) onRowClick(price, size, type);
  };

  return (
    <tr
      className={`${styles.orderRow} ${type === 'bid' ? styles.bidRow : styles.askRow}`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      tabIndex={0}
      aria-label={`${type === 'bid' ? 'Bid' : 'Ask'} at price ${formatPrice(price, displayTickSize)}, size ${formatSize(size, lotSize)}, cumulative ${formatSize(cumulativeSize, lotSize)}`}
    >
      <td className={`${styles.priceCell} ${type === 'bid' ? styles.bidPrice : styles.askPrice}`}>
        {formatPrice(price, displayTickSize)}
      </td>
      <td className={styles.sizeCell}>{formatSize(size, lotSize)}</td>
      <td className={styles.totalCell}>{formatSize(cumulativeSize, lotSize)}</td>
      <td className={styles.depthBarContainer}>
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
  const { marketSpecificData, connectionStatus } = useWebSocket(); // Get connectionStatus
  const { activeInstrumentSymbol, selectedUnderlying, instrumentsForSelectedUnderlying, isLoadingUnderlyings } = useMarketContext();
  const { currentMode } = useTradingMode();
  const { setPriceFromOrderBook } = useOrderEntry();

  const instrumentParams = useMemo(() =>
    getCurrentInstrumentParameters(activeInstrumentSymbol, selectedUnderlying, instrumentsForSelectedUnderlying, currentMode),
    [activeInstrumentSymbol, selectedUnderlying, instrumentsForSelectedUnderlying, currentMode]
  );

  const [currentAggregation, setCurrentAggregation] = useState<number>(instrumentParams.tickSize || 0.01);

  useEffect(() => {
    setCurrentAggregation(instrumentParams.tickSize || 0.01);
  }, [instrumentParams.tickSize]);

  const handleAggregationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newAgg = parseFloat(event.target.value);
    if (!isNaN(newAgg) && newAgg > 0) setCurrentAggregation(newAgg);
  };

  const handleRowClick = useCallback((price: number, size: number, type: 'bid' | 'ask') => {
    setPriceFromOrderBook(price, instrumentParams.tickSize);
    console.log(`Order book click: ${type} @ ${price}, size ${size}. Sent to order entry.`);
  }, [setPriceFromOrderBook, instrumentParams.tickSize]);

  // Moved isWsConnected outside useMemo to be used in its dependency array
  const isWsConnected = connectionStatus === 'OPEN';

  const processedDepth = useMemo(() => {
    const defaultReturn = { bids: [], asks: [], spread: null, spreadPercentage: null, maxCumulative: 0 };
    // Use isWsConnected from outer scope, now correctly in dependency array
    if (!isWsConnected || !activeInstrumentSymbol || !marketSpecificData.depth ||
        marketSpecificData.depth.market !== activeInstrumentSymbol ||
        marketSpecificData.depth.mode !== currentMode ||
        currentAggregation <= 0) {
      return defaultReturn;
    }

    const { bids: rawBids, asks: rawAsks } = marketSpecificData.depth;

    const aggregateLevels = (levels: [number, number][], isBids: boolean, aggregation: number): AggregatedLevel[] => {
        if (!levels || levels.length === 0) return [];
        const aggregatedMap: Map<number, number> = new Map();
        const keyPrecision = Math.max(0, aggregation.toString().split('.')[1]?.length || 0);

        for (const [price, size] of levels) {
            let groupKey: number;
            if (isBids) groupKey = Math.floor(price / aggregation) * aggregation;
            else groupKey = Math.ceil(price / aggregation) * aggregation;
            groupKey = parseFloat(groupKey.toFixed(keyPrecision));
            aggregatedMap.set(groupKey, (aggregatedMap.get(groupKey) || 0) + size);
        }
      
        const sortedAggregated = Array.from(aggregatedMap.entries())
          .map(([price, size]) => ({ price, size, cumulativeSize: 0 }))
          .sort((a, b) => isBids ? b.price - a.price : a.price - b.price);

        let cumulative = 0;
        return sortedAggregated.map(level => {
          cumulative += level.size;
          return { ...level, cumulativeSize: cumulative };
        }).slice(0, MAX_ORDER_BOOK_LEVELS_DISPLAY);
      };

    const aggregatedBids = aggregateLevels(rawBids, true, currentAggregation);
    const aggregatedAsks = aggregateLevels(rawAsks, false, currentAggregation);
    const displayAsks = [...aggregatedAsks].reverse();

    const bestBidPrice = aggregatedBids[0]?.price;
    const bestAskPrice = aggregatedAsks[0]?.price;

    let spread: number | null = null;
    let spreadPercentage: number | null = null;
    if (bestBidPrice !== undefined && bestAskPrice !== undefined && bestAskPrice > bestBidPrice) {
      spread = bestAskPrice - bestBidPrice;
      if (bestBidPrice > 0) spreadPercentage = (spread / bestBidPrice);
    }
    
    const maxCumulativeBid = aggregatedBids[aggregatedBids.length-1]?.cumulativeSize || 0;
    const maxCumulativeAsk = aggregatedAsks[aggregatedAsks.length-1]?.cumulativeSize || 0; // This was using aggregatedBids before, corrected to aggregatedAsks
    const maxCumulative = Math.max(maxCumulativeBid, maxCumulativeAsk);
    return { bids: aggregatedBids, asks: displayAsks, spread, spreadPercentage, maxCumulative };

  }, [marketSpecificData.depth, activeInstrumentSymbol, currentMode, currentAggregation, isWsConnected]); // Added isWsConnected to dependency array

  const aggregationOptions = useMemo(() => {
    const ts = instrumentParams.tickSize;
    if (!ts || ts <= 0) return [0.01, 0.1, 0.5, 1, 5, 10].filter(opt => opt >= (ts || 0.00000001)); // Ensure positive filter value
    // Create more granular options around the tick size
    const options = new Set<number>();
    options.add(ts);
    options.add(ts * 2);
    options.add(ts * 5);
    options.add(ts * 10);
    if (ts < 0.01) options.add(0.01);
    if (ts < 0.1) options.add(0.1);
    if (ts < 1) options.add(ts * 20 > 1 ? 1 : ts * 20 ); // Add a step towards 1
    options.add(1);
    options.add(5);
    options.add(10);
    options.add(50);
    options.add(100);
    return Array.from(options).filter(opt => opt > 0 && opt >= ts).sort((a,b) => a-b).slice(0,7); // Limit options shown
  }, [instrumentParams.tickSize]);

  // isLoadingUnderlyings is from MarketContext, indicating if the base pair list is loading.
  // isWsConnected checks WebSocket.
  // marketSpecificData.depth being null while connected means no data for *this activeInstrumentSymbol* yet.
  const showInitialSkeletons = (isLoadingUnderlyings && !activeInstrumentSymbol) || 
                             (isWsConnected && !marketSpecificData.depth && !!activeInstrumentSymbol && processedDepth.bids.length === 0 && processedDepth.asks.length === 0) ||
                             (!isWsConnected && !activeInstrumentSymbol); // Show skeletons if not connected and no symbol


  return (
    <div className={styles.orderBookContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Order Book</h3>
        <div className={styles.aggregationControl}>
            <select value={currentAggregation} onChange={handleAggregationChange} className={styles.aggregationSelect}
                    disabled={!activeInstrumentSymbol || aggregationOptions.length <= 1} aria-label="Group order book levels">
            {aggregationOptions.map(opt => (
                <option key={opt} value={opt}>{formatPrice(opt, opt, 8)}</option>
            ))}
            </select>
            <ChevronDown size={14} className={styles.selectArrow}/>
        </div>
      </div>

      <div className={styles.columnsHeader}>
          <span>Price ({instrumentParams.quoteAsset || 'QUOTE'})</span>
          <span>Size ({instrumentParams.baseAsset || 'BASE'})</span>
          <span>Total</span>
          {/* Empty span for depth bar column or specific label like "Depth" */}
          <span className={styles.depthHeaderLabel}></span> 
      </div>

      <div className={styles.asksSection}>
          {showInitialSkeletons ? Array.from({ length: Math.floor(MAX_ORDER_BOOK_LEVELS_DISPLAY / 2) || 5 }).map((_, i) => <OrderBookRowSkeleton key={`ask-skel-${i}`} type="ask"/>) :
           processedDepth.asks.length === 0 && isWsConnected && activeInstrumentSymbol ? (
            <div className={styles.noData}>No asks</div>
           ) :
           processedDepth.asks.map((ask) => (
            <OrderBookRow key={`ask-${ask.price}-${ask.size}`} type="ask" {...ask} maxCumulativeSize={processedDepth.maxCumulative}
                aggregationLevel={currentAggregation} tickSize={instrumentParams.tickSize} lotSize={instrumentParams.lotSize} onRowClick={handleRowClick} />
          ))}
      </div>

      {isWsConnected && activeInstrumentSymbol && processedDepth.spread !== null && (
          <div className={styles.spreadInfo} aria-label="Market Spread">
              <span className={styles.spreadValue} title={`Spread: ${formatPrice(processedDepth.spread, instrumentParams.tickSize)}`}>
                  {formatPrice(processedDepth.spread, instrumentParams.tickSize)}
              </span>
              {processedDepth.spreadPercentage !== null && (
                  <span className={styles.spreadPercentage}>
                      ({(processedDepth.spreadPercentage * 100).toFixed(2)}%)
                  </span>
              )}
          </div>
      )}

      <div className={styles.bidsSection}>
           {showInitialSkeletons ? Array.from({ length: Math.floor(MAX_ORDER_BOOK_LEVELS_DISPLAY / 2) || 5 }).map((_, i) => <OrderBookRowSkeleton key={`bid-skel-${i}`} type="bid"/>) :
           processedDepth.bids.length === 0 && isWsConnected && activeInstrumentSymbol ? (
            <div className={styles.noData}>No bids</div>
           ) :
           processedDepth.bids.map((bid) => (
            <OrderBookRow key={`bid-${bid.price}-${bid.size}`} type="bid" {...bid} maxCumulativeSize={processedDepth.maxCumulative}
                aggregationLevel={currentAggregation} tickSize={instrumentParams.tickSize} lotSize={instrumentParams.lotSize} onRowClick={handleRowClick}/>
          ))}
      </div>
      {!activeInstrumentSymbol && !isLoadingUnderlyings && <div className={styles.noMarketMessage}>Select an instrument</div>}
      {!isWsConnected && activeInstrumentSymbol && <div className={styles.disconnectedMessage}>Book Feed Disconnected</div>}
    </div>
  );
};

const OrderBookRowSkeleton: React.FC<{type: 'bid'|'ask'}> = ({type}) => (
    // Using <tr> and <td> for skeleton to match table structure if OrderBookRow is <tr>
    // If OrderBookRow is a div, then this should also be divs. Assuming OrderBookRow is <tr>.
    <tr className={`${styles.orderRowSkeleton} ${type === 'bid' ? styles.bidRow : styles.askRow}`}>
        <td className={styles.priceCell}><SkeletonLoader width="90%" height="12px"/></td>
        <td className={styles.sizeCell}><SkeletonLoader width="90%" height="12px"/></td>
        <td className={styles.totalCell}><SkeletonLoader width="90%" height="12px"/></td>
        <td className={styles.depthBarContainer}><SkeletonLoader width={`${Math.random()*50+10}%`} height="12px" style={{ marginLeft: type === 'ask' ? 'auto' : '0', marginRight: type === 'bid' ? 'auto' : '0' }}/></td>
    </tr>
);

export default OrderBook;