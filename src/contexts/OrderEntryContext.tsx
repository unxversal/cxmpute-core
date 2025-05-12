// src/contexts/OrderEntryContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
  useMemo, // Added useMemo
} from "react";
import type {
  // MarketMeta, // No longer needed directly if selectedUnderlying is typed as UnderlyingPairMeta
  // InstrumentMarketMeta, // No longer needed directly
  // ExpiryData, // No longer needed directly
  // OptionInstrumentData, // No longer needed directly
  // FutureInstrumentData, // No longer needed directly
  DerivativeType,
} from "@/lib/interfaces";
import { useMarketContext } from "./MarketContext";

// --- Local Type Definitions for Order Entry ---
export type OrderEntryOrderType = "MARKET" | "LIMIT" | "OPTION" | "FUTURE" | "PERP" | "SPOT";
export type OrderEntryOrderSide = "BUY" | "SELL";
export type FormOptionType = "CALL" | "PUT"; // Renamed from OptionType to avoid conflict if imported

export interface OrderFormState {
  orderType: OrderEntryOrderType;
  side: OrderEntryOrderSide;
  quantity: string;
  price: string;
  strikePriceDisplay: string;
  optionType: FormOptionType;
  rawExpiryInput: string; // YYYY-MM-DD format for <input type="date">
}
// --- End Local Type Definitions ---

const initialOrderFormState: OrderFormState = {
  orderType: 'LIMIT',
  side: 'BUY',
  quantity: '',
  price: '',
  strikePriceDisplay: '',
  optionType: 'CALL',
  rawExpiryInput: '',
};

interface OrderEntryContextType {
  formState: OrderFormState;
  setFormState: React.Dispatch<React.SetStateAction<OrderFormState>>;
  updateFormField: <K extends keyof OrderFormState>(field: K, value: OrderFormState[K]) => void;
  resetForm: (partialState?: Partial<OrderFormState>) => void;

  selectedInstrumentType: DerivativeType | "PERP" | "SPOT" | null;
  setSelectedInstrumentType: (type: DerivativeType | "PERP" | "SPOT" | null) => void;
  
  selectedExpiryTs: number | null;
  setSelectedExpiryTs: (ts: number | null) => void;

  // This holds the fully resolved, tradable instrument symbol
  // e.g., "BTC/USDC-OPT-241231-30K-C", "ETH/USDC-PERP", or "BTC/USDC" (for spot)
  finalInstrumentSymbol: string | null; 
  setFinalInstrumentSymbol: (symbol: string | null) => void;

  setPriceFromOrderBook: (price: number, tickSize?: number) => void;
  setQuantityByPercentage: (percentage: number) => void; // Remains conceptual here

  isDerivativeInstrumentFullySelected: boolean; // True if type, expiry & strike (for option) are chosen
}

const OrderEntryContext = createContext<OrderEntryContextType | undefined>(undefined);

export const OrderEntryProvider = ({ children }: { children: ReactNode }) => {
  const { selectedUnderlying } = useMarketContext();

  const [formState, setFormState] = useState<OrderFormState>(initialOrderFormState);
  const [selectedInstrumentType, setSelectedInstrumentTypeState] = 
    useState<DerivativeType | "PERP" | "SPOT" | null>(null);
  const [selectedExpiryTs, setSelectedExpiryTsState] = useState<number | null>(null);
  const [finalInstrumentSymbol, setFinalInstrumentSymbolState] = useState<string | null>(null);

  const updateFormField = useCallback(<K extends keyof OrderFormState>(field: K, value: OrderFormState[K]) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  }, []);
  
  const resetForm = useCallback((partialState?: Partial<OrderFormState>) => {
    setFormState({ ...initialOrderFormState, ...partialState });
    setSelectedInstrumentTypeState(null);
    setSelectedExpiryTsState(null);
    setFinalInstrumentSymbolState(null);
  }, []);

  useEffect(() => {
    resetForm(); // Reset all order entry specific states
    if (selectedUnderlying) {
        if (selectedUnderlying.type === "SPOT") {
            setSelectedInstrumentTypeState("SPOT");
            setFinalInstrumentSymbolState(selectedUnderlying.symbol);
            // Default form order type to LIMIT for SPOT markets perhaps
            updateFormField('orderType', 'LIMIT');
        } else {
            // If it's a derivative-enabled underlying, prompt user to select derivative type
            setSelectedInstrumentTypeState(null); 
            // Default form order type to LIMIT or based on what's allowed
            let defaultOrderTypeForDeriv: OrderEntryOrderType = 'LIMIT';
            if (selectedUnderlying.allowsOptions) defaultOrderTypeForDeriv = 'OPTION';
            else if (selectedUnderlying.allowsFutures) defaultOrderTypeForDeriv = 'FUTURE';
            else if (selectedUnderlying.allowsPerpetuals) defaultOrderTypeForDeriv = 'PERP';
            updateFormField('orderType', defaultOrderTypeForDeriv);
        }
    } else {
        // No underlying selected, ensure instrument type is also null
        setSelectedInstrumentTypeState(null);
    }
  }, [selectedUnderlying, resetForm, updateFormField]);

  const setPriceFromOrderBook = useCallback((price: number, tickSize?: number) => {
    if (formState.orderType === 'LIMIT' || formState.orderType === 'OPTION' || formState.orderType === 'FUTURE' || formState.orderType === 'PERP') {
      const precision = tickSize?.toString().split('.')[1]?.length || 2;
      updateFormField('price', price.toFixed(precision));
    }
  }, [formState.orderType, updateFormField]);

  const setQuantityByPercentage = useCallback((percentage: number) => {
    console.log(`OrderEntryContext: Intent to set quantity to ${percentage * 100}% of available.`);
    // Actual calculation logic will be in OrderEntryPanel, which calls updateFormField('quantity', ...)
  }, []);

  const setSelectedInstrumentType = useCallback((type: DerivativeType | "PERP" | "SPOT" | null) => {
    setSelectedInstrumentTypeState(type);
    setSelectedExpiryTsState(null); // Reset expiry when instrument type changes
    updateFormField('strikePriceDisplay', ''); // Reset strike display
    updateFormField('rawExpiryInput', '');    // Reset date input
    setFinalInstrumentSymbolState(null);      // Reset final symbol

    if (type === "SPOT" && selectedUnderlying) {
        setFinalInstrumentSymbolState(selectedUnderlying.symbol);
        updateFormField('orderType', 'LIMIT'); // Default to LIMIT for spot
    } else if (type) {
        // When a derivative type is selected, default form order type to LIMIT for that derivative
        // (or OPTION if type is OPTION, etc.)
        updateFormField('orderType', type as OrderEntryOrderType);
    }
  }, [updateFormField, selectedUnderlying]);

  const setSelectedExpiryTs = useCallback((ts: number | null) => {
    setSelectedExpiryTsState(ts);
    updateFormField('strikePriceDisplay', ''); // Reset strike if expiry changes
    setFinalInstrumentSymbolState(null);    // Reset final symbol

    if (ts) {
        const date = new Date(ts);
        const year = date.getUTCFullYear();
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = date.getUTCDate().toString().padStart(2, '0');
        updateFormField('rawExpiryInput', `${year}-${month}-${day}`);
    } else {
        updateFormField('rawExpiryInput', '');
    }
  }, [updateFormField]);

  const setFinalInstrumentSymbol = useCallback((symbol: string | null) => {
    setFinalInstrumentSymbolState(symbol);
    // When a final instrument symbol is set (e.g. specific option chosen),
    // it might be useful to also update MarketContext.activeInstrumentSymbol
    // This will be done by OrderEntryPanel itself after it gets confirmation.
  }, []);

  const isDerivativeInstrumentFullySelected = useMemo(() => {
    if (selectedInstrumentType === 'OPTION') {
      return !!selectedExpiryTs && !!formState.strikePriceDisplay && !!finalInstrumentSymbol;
    }
    if (selectedInstrumentType === 'FUTURE') {
      return !!selectedExpiryTs && !!finalInstrumentSymbol;
    }
    if (selectedInstrumentType === 'PERP' || selectedInstrumentType === 'SPOT') {
      return !!finalInstrumentSymbol; // For PERP/SPOT, symbol is set when type is selected
    }
    return false;
  }, [selectedInstrumentType, selectedExpiryTs, formState.strikePriceDisplay, finalInstrumentSymbol]);

  return (
    <OrderEntryContext.Provider
      value={{
        formState,
        setFormState,
        updateFormField,
        resetForm,
        selectedInstrumentType,
        setSelectedInstrumentType,
        selectedExpiryTs,
        setSelectedExpiryTs,
        finalInstrumentSymbol,
        setFinalInstrumentSymbol,
        setPriceFromOrderBook,
        setQuantityByPercentage,
        isDerivativeInstrumentFullySelected,
      }}
    >
      {children}
    </OrderEntryContext.Provider>
  );
};

export const useOrderEntry = (): OrderEntryContextType => {
  const context = useContext(OrderEntryContext);
  if (context === undefined) {
    throw new Error("useOrderEntry must be used within an OrderEntryProvider");
  }
  return context;
};