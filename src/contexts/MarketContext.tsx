// src/contexts/MarketContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import type { MarketMeta, TradingMode } from "@/lib/interfaces";
import { useTradingMode } from "./TradingModeContext"; // Assuming TradingModeContext is in the same directory or accessible

interface MarketContextType {
  availableMarkets: MarketMeta[]; // Markets available for the current TradingMode
  selectedMarket: MarketMeta | null;
  setSelectedMarketBySymbol: (symbol: string | null) => void;
  isLoadingMarkets: boolean;
  marketError: string | null;
  refreshMarkets: () => void;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export const MarketProvider = ({ children }: { children: ReactNode }) => {
  const { currentMode } = useTradingMode();
  const [allMarketsForMode, setAllMarketsForMode] = useState<MarketMeta[]>([]);
  const [selectedMarketSymbol, setSelectedMarketSymbol] = useState<string | null>(null);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState<boolean>(false);
  const [marketError, setMarketError] = useState<string | null>(null);

  const fetchMarketsForMode = useCallback(async (mode: TradingMode) => {
    setIsLoadingMarkets(true);
    setMarketError(null);
    setAllMarketsForMode([]); // Clear previous markets
    setSelectedMarketSymbol(null); // Reset selected market on mode change

    let fetchedMarkets: MarketMeta[] = [];
    let nextToken: string | null = null;
    const statusesToFetch: ("ACTIVE" | "PAUSED")[] = ["ACTIVE", "PAUSED"]; // Fetch both active and paused markets

    try {
      for (const status of statusesToFetch) {
        nextToken = null; // Reset nextToken for each status
        do {
          const params = new URLSearchParams({
            mode: mode,
            status: status,
            limit: "100", // Fetch in batches of 100, adjust as needed
          });
          if (nextToken) {
            params.append("nextToken", nextToken);
          }

          const response = await fetch(`/api/public/markets?${params.toString()}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error( errorData.error || `Failed to fetch ${status} markets for ${mode} mode`);
          }
          const data: { items: MarketMeta[]; nextToken: string | null } = await response.json();
          fetchedMarkets = fetchedMarkets.concat(data.items);
          nextToken = data.nextToken;
        } while (nextToken);
      }

      // Sort markets alphabetically by symbol by default
      fetchedMarkets.sort((a, b) => a.symbol.localeCompare(b.symbol));
      setAllMarketsForMode(fetchedMarkets);

      // Auto-select the first market if available
      if (fetchedMarkets.length > 0) {
        setSelectedMarketSymbol(fetchedMarkets[0].symbol);
      }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error fetching markets:", error);
      setMarketError(error.message || "An unknown error occurred while fetching markets.");
      setAllMarketsForMode([]);
    } finally {
      setIsLoadingMarkets(false);
    }
  }, []);

  useEffect(() => {
    if (currentMode) {
      fetchMarketsForMode(currentMode);
    }
  }, [currentMode, fetchMarketsForMode]);

  const selectedMarket = useMemo(() => {
    if (!selectedMarketSymbol) return null;
    return allMarketsForMode.find(market => market.symbol === selectedMarketSymbol) || null;
  }, [selectedMarketSymbol, allMarketsForMode]);

  const setSelectedMarketBySymbol = useCallback((symbol: string | null) => {
    setSelectedMarketSymbol(symbol);
  }, []);

  const refreshMarkets = useCallback(() => {
      if (currentMode) {
          fetchMarketsForMode(currentMode);
      }
  }, [currentMode, fetchMarketsForMode]);

  return (
    <MarketContext.Provider
      value={{
        availableMarkets: allMarketsForMode,
        selectedMarket,
        setSelectedMarketBySymbol,
        isLoadingMarkets,
        marketError,
        refreshMarkets,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
};

export const useMarketContext = (): MarketContextType => {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error("useMarketContext must be used within a MarketProvider");
  }
  return context;
};