/* eslint-disable @typescript-eslint/no-explicit-any */
// src/contexts/AccountContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import type {
  Order,
  Position,
  Balance,
  Trade,
  PaperPoints,
  TradingMode,
} from "@/lib/interfaces";
import { useAuth } from "./AuthContext"; // Make sure path is correct
import { useTradingMode } from "./TradingModeContext"; // Make sure path is correct

interface AccountDataContextState {
  openOrders: Order[];
  positions: Position[];
  balances: Partial<Balance>[];
  tradeHistory: Trade[];
  tradeHistoryNextToken: string | null; // For paginating trade history
  paperPoints: PaperPoints | null;
  isLoading: {
    orders: boolean;
    positions: boolean;
    balances: boolean;
    history: boolean;
    points: boolean;
  };
  error: {
    orders: string | null;
    positions: string | null;
    balances: string | null;
    history: string | null;
    points: string | null;
  };
}

interface AccountContextType extends AccountDataContextState {
  refreshAllAccountData: () => void; // Full refresh
  refreshOpenOrders: () => void;
  refreshPositions: () => void;
  refreshBalances: () => void;
  loadMoreTradeHistory: () => Promise<void>; // For pagination
  refreshPaperPoints: () => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

const initialLoadingState = {
  orders: false, positions: false, balances: false, history: false, points: false,
};
const initialErrorState = {
  orders: null, positions: null, balances: null, history: null, points: null,
};

export const AccountProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const { currentMode } = useTradingMode();

  const [data, setData] = useState<AccountDataContextState>({
    openOrders: [],
    positions: [],
    balances: [],
    tradeHistory: [],
    tradeHistoryNextToken: null,
    paperPoints: null,
    isLoading: initialLoadingState,
    error: initialErrorState,
  });

  const setLoading = (key: keyof AccountDataContextState['isLoading'], value: boolean) => {
    setData(prev => ({ ...prev, isLoading: { ...prev.isLoading, [key]: value } }));
  };
  const setError = (key: keyof AccountDataContextState['error'], value: string | null) => {
    setData(prev => ({ ...prev, error: { ...prev.error, [key]: value } }));
  };

  const fetchOpenOrders = useCallback(async (traderId: string, mode: TradingMode) => {
    if (!isAuthenticated || !traderId || !mode) return;
    setLoading("orders", true);
    setError("orders", null);
    try {
      // API should filter by traderId based on authentication, not query param
      const params = new URLSearchParams({ mode, status: "OPEN" });
      const resOpen = await fetch(`/api/orders?${params.toString()}`);
      if (!resOpen.ok) throw new Error(`Failed to fetch open orders: ${await resOpen.text()}`);
      const openOrdersData: Order[] = await resOpen.json();
      
      params.set("status", "PARTIAL");
      const resPartial = await fetch(`/api/orders?${params.toString()}`);
      if (!resPartial.ok) throw new Error(`Failed to fetch partial orders: ${await resPartial.text()}`);
      const partialOrdersData: Order[] = await resPartial.json();

      setData(prev => ({ ...prev, openOrders: [...openOrdersData, ...partialOrdersData]
        .sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)) 
      }));
    } catch (e: any) {
      setError("orders", e.message);
      setData(prev => ({ ...prev, openOrders: [] }));
    } finally {
      setLoading("orders", false);
    }
  }, [isAuthenticated]);

  const fetchPositions = useCallback(async (traderId: string, mode: TradingMode) => {
    if (!isAuthenticated || !traderId || !mode) return;
    setLoading("positions", true);
    setError("positions", null);
    try {
      // API uses authenticated traderId
      const params = new URLSearchParams({ mode });
      const response = await fetch(`/api/positions?${params.toString()}`);
      if (!response.ok) throw new Error(`Failed to fetch positions: ${await response.text()}`);
      const positionsData: Position[] = await response.json();
      setData(prev => ({ ...prev, positions: positionsData }));
    } catch (e: any) {
      setError("positions", e.message);
      setData(prev => ({ ...prev, positions: [] }));
    } finally {
      setLoading("positions", false);
    }
  }, [isAuthenticated]);

  const fetchBalances = useCallback(async (traderId: string, mode: TradingMode) => {
    if (!isAuthenticated || !traderId || !mode) return;
    setLoading("balances", true);
    setError("balances", null);
    try {
      // API uses authenticated traderId
      const params = new URLSearchParams({ mode });
      const response = await fetch(`/api/balances?${params.toString()}`);
      if (!response.ok) throw new Error(`Failed to fetch balances: ${await response.text()}`);
      const balancesData: Partial<Balance>[] = await response.json();
      setData(prev => ({ ...prev, balances: balancesData }));
    } catch (e: any) {
      setError("balances", e.message);
      setData(prev => ({ ...prev, balances: [] }));
    } finally {
      setLoading("balances", false);
    }
  }, [isAuthenticated]);

  const fetchTradeHistoryInternal = useCallback(async (traderId: string, mode: TradingMode, nextTokenParam?: string | null, isLoadMore = false) => {
    if (!isAuthenticated || !traderId || !mode) return null;
    setLoading("history", true);
    setError("history", null);
    let newNextToken: string | null = null;
    try {
      // API uses authenticated traderId
      const params = new URLSearchParams({ mode, limit: "20" }); 
      if (nextTokenParam) params.append("nextToken", nextTokenParam);

      const response = await fetch(`/api/trades/history?${params.toString()}`);
      if (!response.ok) throw new Error(`Failed to fetch trade history: ${await response.text()}`);
      const historyData: { items: Trade[]; nextToken: string | null } = await response.json();
      
      setData(prev => ({
        ...prev,
        tradeHistory: isLoadMore ? [...prev.tradeHistory, ...historyData.items] : historyData.items,
        tradeHistoryNextToken: historyData.nextToken,
      }));
      newNextToken = historyData.nextToken;
    } catch (e: any) {
      setError("history", e.message);
      if (!isLoadMore) setData(prev => ({ ...prev, tradeHistory: [], tradeHistoryNextToken: null }));
    } finally {
      setLoading("history", false);
    }
    return newNextToken;
  }, [isAuthenticated]);

  const refreshTradeHistory = useCallback((nextTokenVal?: string | null) => {
    if (user?.properties.traderId && currentMode) {
      return fetchTradeHistoryInternal(user.properties.traderId, currentMode, nextTokenVal, false);
    }
    return Promise.resolve(null);
  }, [user, currentMode, fetchTradeHistoryInternal]);
  
  const loadMoreTradeHistory = useCallback(async () => {
    if (user?.properties.traderId && currentMode && data.tradeHistoryNextToken) {
      await fetchTradeHistoryInternal(user.properties.traderId, currentMode, data.tradeHistoryNextToken, true);
    }
  }, [user, currentMode, data.tradeHistoryNextToken, fetchTradeHistoryInternal]);


  const fetchPaperPoints = useCallback(async (traderId: string) => {
    if (!isAuthenticated || !traderId) return;
    setLoading("points", true);
    setError("points", null);
    try {
      // API uses authenticated traderId from token, path param is for route matching & authz
      const response = await fetch(`/api/traders/${traderId}/paper-points`); 
      if (!response.ok) throw new Error(`Failed to fetch paper points: ${await response.text()}`);
      const pointsData: PaperPoints = await response.json();
      setData(prev => ({ ...prev, paperPoints: pointsData }));
    } catch (e: any) {
      setError("points", e.message);
      setData(prev => ({ ...prev, paperPoints: null }));
    } finally {
      setLoading("points", false);
    }
  }, [isAuthenticated]);

  const refreshAllAccountData = useCallback(() => {
    if (isAuthenticated && user?.properties.traderId && currentMode) {
      const traderId = user.properties.traderId;
      fetchOpenOrders(traderId, currentMode);
      fetchPositions(traderId, currentMode);
      fetchBalances(traderId, currentMode);
      refreshTradeHistory(null); // Initial fetch for history
      if (currentMode === "PAPER") {
        fetchPaperPoints(traderId);
      } else {
        setData(prev => ({ ...prev, paperPoints: null }));
      }
    } else {
      setData({
        openOrders: [], positions: [], balances: [], tradeHistory: [], paperPoints: null, tradeHistoryNextToken: null,
        isLoading: initialLoadingState, error: initialErrorState
      });
    }
  }, [isAuthenticated, user, currentMode, fetchOpenOrders, fetchPositions, fetchBalances, refreshTradeHistory, fetchPaperPoints]);

  useEffect(() => {
    refreshAllAccountData();
  }, [refreshAllAccountData]);

  const contextValue: AccountContextType = {
    ...data,
    refreshAllAccountData,
    refreshOpenOrders: () => { if(user?.properties.traderId && currentMode) fetchOpenOrders(user.properties.traderId, currentMode)},
    refreshPositions: () => { if(user?.properties.traderId && currentMode) fetchPositions(user.properties.traderId, currentMode)},
    refreshBalances: () => { if(user?.properties.traderId && currentMode) fetchBalances(user.properties.traderId, currentMode)},
    loadMoreTradeHistory,
    refreshPaperPoints: () => { if(user?.properties.traderId && currentMode === "PAPER") fetchPaperPoints(user.properties.traderId)},
  };

  return (
    <AccountContext.Provider value={contextValue}>
      {children}
    </AccountContext.Provider>
  );
};

export const useAccountContext = (): AccountContextType => {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error("useAccountContext must be used within an AccountProvider");
  }
  return context;
};