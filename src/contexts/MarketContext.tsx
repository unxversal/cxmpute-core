/* eslint-disable @typescript-eslint/no-explicit-any */
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
import type {
  UnderlyingPairMeta,
  InstrumentMarketMeta,
  ExpiryData,
  TradingMode,
  DerivativeType,
  PerpInstrumentApiResponse,
  InstrumentsApiResponse,
} from "@/lib/interfaces";
import { useTradingMode } from "./TradingModeContext";

export interface InstrumentsBundle {
  options?: ExpiryData[]; // Array of expiries, each containing strikes
  futures?: ExpiryData[]; // Array of expiries, each containing a future instrument
  perp?: InstrumentMarketMeta | null; // Single perp market for the underlying
}

interface MarketContextType {
  availableUnderlyings: UnderlyingPairMeta[];
  selectedUnderlying: UnderlyingPairMeta | null;
  instrumentsForSelectedUnderlying: InstrumentsBundle | null;
  activeInstrumentSymbol: string | null; // The actual market symbol for chart, orderbook etc.
  
  isLoadingUnderlyings: boolean;
  isLoadingInstruments: boolean;
  errorUnderlyings: string | null;
  errorInstruments: string | null;

  selectUnderlyingBySymbol: (symbol: string | null) => void;
  fetchInstrumentsForUnderlying: (
    underlying: UnderlyingPairMeta,
    instrumentType: DerivativeType | "PERP" | "SPOT" // SPOT to clear/use underlying directly
  ) => Promise<void>;
  setActiveInstrumentSymbol: (instrumentSymbol: string | null) => void; // Usually set by OrderEntryPanel
  refreshUnderlyings: () => void;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export const MarketProvider = ({ children }: { children: ReactNode }) => {
  const { currentMode } = useTradingMode();

  const [availableUnderlyings, setAvailableUnderlyings] = useState<UnderlyingPairMeta[]>([]);
  const [selectedUnderlyingSymbol, setSelectedUnderlyingSymbol] = useState<string | null>(null);
  
  const [instrumentsForSelectedUnderlying, setInstrumentsForSelectedUnderlying] = useState<InstrumentsBundle | null>(null);
  const [activeInstrumentSymbol, setActiveInstrumentSymbolState] = useState<string | null>(null);

  const [isLoadingUnderlyings, setIsLoadingUnderlyings] = useState<boolean>(false);
  const [isLoadingInstruments, setIsLoadingInstruments] = useState<boolean>(false);
  const [errorUnderlyings, setErrorUnderlyings] = useState<string | null>(null);
  const [errorInstruments, setErrorInstruments] = useState<string | null>(null);

  // 1. Fetch Available Underlyings (Admin-defined pairs)
  const fetchUnderlyingsAPI = useCallback(async (mode: TradingMode) => {
    setIsLoadingUnderlyings(true);
    setErrorUnderlyings(null);
    setAvailableUnderlyings([]);
    setSelectedUnderlyingSymbol(null); // Reset selection
    setInstrumentsForSelectedUnderlying(null); // Clear instruments
    setActiveInstrumentSymbolState(null); // Clear active instrument

    let allFetchedUnderlyings: UnderlyingPairMeta[] = [];
    let nextToken: string | null = null;
    try {
      do {
        const params = new URLSearchParams({ mode, limit: "100" });
        if (nextToken) params.append("nextToken", nextToken);
        
        const response = await fetch(`/api/public/underlyings?${params.toString()}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch underlying markets for ${mode} mode`);
        }
        const data: { items: UnderlyingPairMeta[]; nextToken: string | null } = await response.json();
        allFetchedUnderlyings = allFetchedUnderlyings.concat(data.items);
        nextToken = data.nextToken;
      } while (nextToken);

      setAvailableUnderlyings(allFetchedUnderlyings);
      if (allFetchedUnderlyings.length > 0) {
        // Auto-select the first underlying and set it as the active instrument if it's SPOT
        const firstUnderlying = allFetchedUnderlyings[0];
        setSelectedUnderlyingSymbol(firstUnderlying.symbol);
        if(firstUnderlying.type === "SPOT") { // Default active instrument to the spot market of first underlying
            setActiveInstrumentSymbolState(firstUnderlying.symbol);
        }
      }
    } catch (error: any) {
      console.error("Error fetching underlying markets:", error);
      setErrorUnderlyings(error.message || "Unknown error fetching underlyings.");
    } finally {
      setIsLoadingUnderlyings(false);
    }
  }, []);

  useEffect(() => {
    if (currentMode) {
      fetchUnderlyingsAPI(currentMode);
    }
  }, [currentMode, fetchUnderlyingsAPI]);

  const selectedUnderlying = useMemo(() => {
    if (!selectedUnderlyingSymbol) return null;
    return availableUnderlyings.find(u => u.symbol === selectedUnderlyingSymbol) || null;
  }, [selectedUnderlyingSymbol, availableUnderlyings]);

  const selectUnderlyingBySymbol = useCallback((symbol: string | null) => {
    setSelectedUnderlyingSymbol(symbol);
    setInstrumentsForSelectedUnderlying(null); // Clear old instruments
    // If the new underlying is a simple SPOT market, set it as active instrument directly
    const newSelected = availableUnderlyings.find(u => u.symbol === symbol);
    if (newSelected && newSelected.type === "SPOT") {
        setActiveInstrumentSymbolState(newSelected.symbol);
    } else {
        setActiveInstrumentSymbolState(null); // Await further selection in OrderEntryPanel for derivatives
    }
  }, [availableUnderlyings]);


  // 2. Fetch Specific Instruments for a selected underlying and type
  const fetchInstrumentsForUnderlying = useCallback(
    async (underlying: UnderlyingPairMeta, instrumentType: DerivativeType | "PERP" | "SPOT") => {
      if (!underlying || !currentMode) return;

      // If type is SPOT, the active instrument is the underlying itself
      if (instrumentType === "SPOT") {
        setInstrumentsForSelectedUnderlying(null); // No separate instruments bundle for SPOT
        setActiveInstrumentSymbolState(underlying.symbol);
        return;
      }

      setIsLoadingInstruments(true);
      setErrorInstruments(null);
      setInstrumentsForSelectedUnderlying(null); // Clear previous before fetching new
      // Do not clear activeInstrumentSymbol here, OrderEntryPanel will set it upon full selection.

      try {
        const params = new URLSearchParams({
          underlyingPairSymbol: underlying.symbol,
          instrumentType: instrumentType,
          mode: currentMode,
          limit: "500", // Fetch all instruments for an underlying typically
        });
        // Note: Pagination for instruments list itself is not handled here, assuming API returns all for type

        const response = await fetch(`/api/public/instruments?${params.toString()}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch ${instrumentType} instruments for ${underlying.symbol}`);
        }
        
        const data = await response.json(); // Type will be InstrumentsApiResponse or PerpInstrumentApiResponse

        if (instrumentType === "OPTION") {
          setInstrumentsForSelectedUnderlying(prev => ({ ...prev, options: (data as InstrumentsApiResponse).expiries }));
        } else if (instrumentType === "FUTURE") {
          setInstrumentsForSelectedUnderlying(prev => ({ ...prev, futures: (data as InstrumentsApiResponse).expiries }));
        } else if (instrumentType === "PERP") {
          // The API returns { instrument: InstrumentMarketMeta | null, nextToken: string | null } for PERP
          // For consistency in InstrumentsBundle, we can store it like this:
          const perpData = data as PerpInstrumentApiResponse;
          setInstrumentsForSelectedUnderlying(prev => ({ ...prev, perp: perpData.instrument }));
          // If a PERP market exists, make it the active instrument
          if (perpData.instrument) {
            setActiveInstrumentSymbolState(perpData.instrument.symbol);
          } else {
             setActiveInstrumentSymbolState(null); // No active perp for this underlying
          }
        }
      } catch (error: any) {
        console.error(`Error fetching ${instrumentType} for ${underlying.symbol}:`, error);
        setErrorInstruments(error.message || `Unknown error fetching ${instrumentType}.`);
      } finally {
        setIsLoadingInstruments(false);
      }
    },
    [currentMode]
  );

  const setActiveInstrumentSymbol = useCallback((instrumentSymbol: string | null) => {
    console.log("MarketContext: Setting active instrument symbol to:", instrumentSymbol);
    setActiveInstrumentSymbolState(instrumentSymbol);
  }, []);
  
  const refreshUnderlyings = useCallback(() => {
      if (currentMode) {
          fetchUnderlyingsAPI(currentMode);
      }
  }, [currentMode, fetchUnderlyingsAPI]);


  return (
    <MarketContext.Provider
      value={{
        availableUnderlyings,
        selectedUnderlying,
        instrumentsForSelectedUnderlying,
        activeInstrumentSymbol,
        isLoadingUnderlyings,
        isLoadingInstruments,
        errorUnderlyings,
        errorInstruments,
        selectUnderlyingBySymbol,
        fetchInstrumentsForUnderlying,
        setActiveInstrumentSymbol,
        refreshUnderlyings,
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