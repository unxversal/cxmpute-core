// src/contexts/TradingModeContext.tsx
"use client";

import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from 'react';
import type { TradingMode } from '@/lib/interfaces';

interface TradingModeContextType {
  currentMode: TradingMode;
  setCurrentMode: Dispatch<SetStateAction<TradingMode>>;
}

const TradingModeContext = createContext<TradingModeContextType | undefined>(undefined);

export const TradingModeProvider = ({ children, initialMode = "PAPER" }: { children: ReactNode; initialMode?: TradingMode }) => {
  const [currentMode, setCurrentMode] = useState<TradingMode>(initialMode);

  return (
    <TradingModeContext.Provider value={{ currentMode, setCurrentMode }}>
      {children}
    </TradingModeContext.Provider>
  );
};

export const useTradingMode = (): TradingModeContextType => {
  const context = useContext(TradingModeContext);
  if (context === undefined) {
    throw new Error('useTradingMode must be used within a TradingModeProvider');
  }
  return context;
};