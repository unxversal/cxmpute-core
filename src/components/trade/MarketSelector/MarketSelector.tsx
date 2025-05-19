// src/components/trade/MarketSelector/MarketSelector.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from './MarketSelector.module.css';
import { useMarketContext } from '@/contexts/MarketContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { ChevronDown, Search, XCircle, Layers } from 'lucide-react'; // Added Layers icon
import LoadingSpinner from '@/components/ui/LoadingSpinner/LoadingSpinner';
import Tooltip from '@/components/ui/Tooltip/Tooltip';

const MarketSelector: React.FC = () => {
  const {
    availableUnderlyings,
    selectedUnderlying,
    selectUnderlyingBySymbol,
    isLoadingUnderlyings,
    errorUnderlyings,
  } = useMarketContext();
  const { currentMode } = useTradingMode();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [wrapperRef]);

  const filteredUnderlyings = useMemo(() => {
    if (!searchTerm) return availableUnderlyings;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return availableUnderlyings.filter(
      (underlying) =>
        underlying.symbol.toLowerCase().includes(lowerSearchTerm) ||
        underlying.baseAsset.toLowerCase().includes(lowerSearchTerm) ||
        underlying.quoteAsset.toLowerCase().includes(lowerSearchTerm)
    );
  }, [availableUnderlyings, searchTerm]);

  const handleUnderlyingSelect = (underlyingSymbol: string) => {
    selectUnderlyingBySymbol(underlyingSymbol);
    setIsOpen(false);
    setSearchTerm('');
  };
  
  // Displaying some metric for the selected underlying SPOT market (e.g. last price from WebSocket)
  // This is more complex as WebSocketContext.marketSpecificData is for the *activeInstrumentSymbol*
  // For now, we will not display live price in the selector button itself for simplicity.
  // The MarketInfoBar will show price for the activeInstrumentSymbol or selectedUnderlying's spot.
  // const displayPriceForSelectedUnderlying = useMemo(() => {
  //   if (selectedUnderlying && activeInstrumentSymbol === selectedUnderlying.symbol && wsMarketData.lastTrade) {
  //       return formatPrice(wsMarketData.lastTrade.price, selectedUnderlying.tickSizeSpot);
  //   }
  //   return null;
  // }, [selectedUnderlying, activeInstrumentSymbol, wsMarketData.lastTrade]);


  if (isLoadingUnderlyings && availableUnderlyings.length === 0) {
    return (
      <div className={`${styles.marketSelectorButton} ${styles.loadingState}`}>
        <LoadingSpinner size={20} color="#8a91a0" />
        <span>Loading Markets...</span>
      </div>
    );
  }

  if (errorUnderlyings) {
    return <div className={`${styles.marketSelectorButton} ${styles.errorState}`} title={errorUnderlyings}>
        <Layers size={20} className={styles.mainIconError}/> Error Loading
    </div>;
  }
  
  if (!selectedUnderlying && availableUnderlyings.length > 0) {
      // This case should ideally be handled by MarketContext auto-selecting the first underlying
      // If still null here, it means no underlyings were found or an issue occurred.
  }


  return (
    <div className={styles.marketSelectorWrapper} ref={wrapperRef}>
      <Tooltip content={`Current Underlying: ${selectedUnderlying?.symbol || 'None'} (${currentMode})`} position="bottom">
        <button
          className={styles.marketSelectorButton}
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Select trading pair, current pair is ${selectedUnderlying?.symbol || 'not selected'}`}
        >
          <div className={styles.selectedMarketInfo}>
            <Layers size={20} className={styles.mainIcon}/>
            {selectedUnderlying ? (
              <>
                <span className={styles.selectedMarketSymbol}>{selectedUnderlying.symbol}</span>
                {/* <span className={`${styles.marketModeTag} ${styles[currentMode.toLowerCase()]}`}>
                  {currentMode}
                </span> */}
                {/* {displayPriceForSelectedUnderlying && (
                    <span className={styles.selectedMarketPrice}>{displayPriceForSelectedUnderlying}</span>
                )} */}
              </>
            ) : (
              <span>Select Pair</span>
            )}
          </div>
          <ChevronDown size={20} className={`${styles.chevron} ${isOpen ? styles.open : ''}`} />
        </button>
      </Tooltip>

      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          <div className={styles.searchContainer}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search pairs (e.g., BTC/USDC)"
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              aria-label="Search trading pairs"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className={styles.clearSearchButton} aria-label="Clear search">
                <XCircle size={16} />
              </button>
            )}
          </div>
          <ul className={styles.marketList}>
            {isLoadingUnderlyings && filteredUnderlyings.length === 0 && (
                <li className={styles.loadingListItem}><LoadingSpinner size={16} /> Searching...</li>
            )}
            {!isLoadingUnderlyings && filteredUnderlyings.length > 0 ? (
              filteredUnderlyings.map((underlying) => (
                <li
                  key={underlying.symbol}
                  className={`${styles.marketItem} ${
                    selectedUnderlying?.symbol === underlying.symbol ? styles.selected : ''
                  } ${underlying.status === 'PAUSED' ? styles.paused : ''}`}
                  onClick={() => underlying.status !== 'PAUSED' && handleUnderlyingSelect(underlying.symbol)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (underlying.status !== 'PAUSED') handleUnderlyingSelect(underlying.symbol); }}}
                  role="option"
                  aria-selected={selectedUnderlying?.symbol === underlying.symbol}
                  aria-disabled={underlying.status === 'PAUSED'}
                  tabIndex={underlying.status === 'PAUSED' ? -1 : 0}
                >
                  <div className={styles.itemMainInfo}>
                    <span className={styles.itemSymbol}>{underlying.symbol}</span>
                    {underlying.status === 'PAUSED' && (
                      <span className={styles.statusTagPaused}>PAUSED</span>
                    )}
                  </div>
                  {/* Optional: Display brief stats for the underlying spot market if available */}
                  {/* <span className={styles.itemSpotPrice}>Spot: {fetchSpotPriceFor(underlying.symbol)}</span> */}
                </li>
              ))
            ) : (
              !isLoadingUnderlyings && <li className={styles.noResults}>No underlying pairs found.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MarketSelector;