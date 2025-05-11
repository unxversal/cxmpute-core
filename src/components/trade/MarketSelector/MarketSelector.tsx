// src/components/trade/MarketSelector/MarketSelector.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from './MarketSelector.module.css';
import { useMarketContext } from '@/contexts/MarketContext';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { ChevronDown, Search, XCircle } from 'lucide-react'; // Lucide icons
import LoadingSpinner from '@/components/ui/LoadingSpinner/LoadingSpinner';
// Optional: If you want to show live prices in the dropdown, you might need WebSocketContext
// import { useWebSocket } from '@/contexts/WebSocketContext';

const MarketSelector: React.FC = () => {
  const {
    availableMarkets,
    selectedMarket,
    setSelectedMarketBySymbol,
    isLoadingMarkets,
    marketError,
  } = useMarketContext();
  const { currentMode } = useTradingMode();
  // const { marketData } = useWebSocket(); // If showing live prices

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

  const filteredMarkets = useMemo(() => {
    if (!searchTerm) return availableMarkets;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return availableMarkets.filter(
      (market) =>
        market.symbol.toLowerCase().includes(lowerSearchTerm) ||
        market.type.toLowerCase().includes(lowerSearchTerm)
        // Add more fields to search if needed (e.g., underlying asset)
    );
  }, [availableMarkets, searchTerm]);

  const handleMarketSelect = (marketSymbol: string) => {
    setSelectedMarketBySymbol(marketSymbol);
    setIsOpen(false);
    setSearchTerm(''); // Reset search term on selection
  };

//   const getMarketDisplayPrice = (marketSymbol: string): string | null => {
//     // Placeholder: If you integrate live prices from WebSocketContext's marketData
//     // you could fetch it here. For now, we'll skip this for simplicity in the dropdown.
//     // const currentMarketData = marketData[marketSymbol]; // Hypothetical structure
//     // return currentMarketData?.markPrice?.price?.toFixed(market.tickSize.toString().split('.')[1]?.length || 2) || null;
//     return null;
//   };

  if (isLoadingMarkets) {
    return (
      <div className={`${styles.marketSelector} ${styles.loadingState}`}>
        <LoadingSpinner size={20} color="#8a91a0" />
        <span>Loading Markets...</span>
      </div>
    );
  }

  if (marketError) {
    return <div className={`${styles.marketSelector} ${styles.errorState}`}>Error: {marketError}</div>;
  }

  return (
    <div className={styles.marketSelectorWrapper} ref={wrapperRef}>
      <button
        className={styles.marketSelectorButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className={styles.selectedMarketInfo}>
          {selectedMarket ? (
            <>
              <span className={styles.selectedMarketSymbol}>{selectedMarket.symbol}</span>
              <span className={`${styles.marketModeTag} ${styles[currentMode.toLowerCase()]}`}>
                {currentMode}
              </span>
              {/* Optional: Display selected market's live price here */}
              {/* {getMarketDisplayPrice(selectedMarket.symbol) && (
                <span className={styles.selectedMarketPrice}>
                  {getMarketDisplayPrice(selectedMarket.symbol)}
                </span>
              )} */}
            </>
          ) : (
            <span>Select Market</span>
          )}
        </div>
        <ChevronDown size={20} className={`${styles.chevron} ${isOpen ? styles.open : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          <div className={styles.searchContainer}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search markets (e.g., BTC, PERP)"
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className={styles.clearSearchButton} aria-label="Clear search">
                <XCircle size={16} />
              </button>
            )}
          </div>
          <ul className={styles.marketList}>
            {filteredMarkets.length > 0 ? (
              filteredMarkets.map((market) => (
                <li
                  key={market.symbol + market.mode} // Ensure unique key if symbols can repeat across modes (though our PK structure prevents this)
                  className={`${styles.marketItem} ${
                    selectedMarket?.symbol === market.symbol ? styles.selected : ''
                  } ${market.status === 'PAUSED' ? styles.paused : ''}`}
                  onClick={() => handleMarketSelect(market.symbol)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleMarketSelect(market.symbol)}}
                  role="option"
                  aria-selected={selectedMarket?.symbol === market.symbol}
                  tabIndex={0}
                >
                  <span className={styles.itemSymbol}>{market.symbol}</span>
                  <div className={styles.itemDetails}>
                    <span className={styles.itemType}>{market.type}</span>
                    {/* {getMarketDisplayPrice(market.symbol) && (
                       <span className={styles.itemPrice}>{getMarketDisplayPrice(market.symbol)}</span>
                    )} */}
                    {market.status === 'PAUSED' && (
                      <span className={styles.statusTagPaused}>PAUSED</span>
                    )}
                  </div>
                </li>
              ))
            ) : (
              <li className={styles.noResults}>No markets found.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MarketSelector;