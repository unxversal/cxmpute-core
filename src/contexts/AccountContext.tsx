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
  Balance, // This now needs to support sASSETs, USDC, CXPT
  Trade,
  PaperPoints,
  TradingMode,
} from "@/lib/interfaces";
import { useAuth } from "./AuthContext";
import { useTradingMode } from "./TradingModeContext";
import { useWebSocket } // To listen for WebSocket balance updates
from "./WebsocketContext"; 

interface AccountDataContextState {
  openOrders: Order[];
  positions: Position[];
  balances: Partial<Balance>[]; // Array of balances for different assets (USDC, CXPT, sBTC, sETH, etc.)
  tradeHistory: Trade[];
  tradeHistoryNextToken: string | null;
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
  refreshAllAccountData: () => void;
  refreshOpenOrders: () => void;
  refreshPositions: () => void;
  refreshBalances: () => void;
  loadMoreTradeHistory: () => Promise<void>;
  refreshPaperPoints: () => void;
  // Helper to get a specific asset's balance
  getBalanceByAsset: (assetSymbol: string) => Partial<Balance> | undefined;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

const initialLoadingState = {
  orders: false, positions: false, balances: false, history: false, points: false,
};
const initialErrorState = {
  orders: null, positions: null, balances: null, history: null, points: null,
};
const initialDataState: AccountDataContextState = {
    openOrders: [], positions: [], balances: [], tradeHistory: [],
    tradeHistoryNextToken: null, paperPoints: null,
    isLoading: initialLoadingState, error: initialErrorState,
};

export const AccountProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const { currentMode } = useTradingMode();
  const { traderData: wsTraderData, connectionStatus: wsConnectionStatus } = useWebSocket(); // Get traderData for live balance updates

  const [data, setData] = useState<AccountDataContextState>(initialDataState);

  const setLoading = useCallback((key: keyof AccountDataContextState['isLoading'], value: boolean) => {
    setData(prev => ({ ...prev, isLoading: { ...prev.isLoading, [key]: value } }));
  }, []);
  const setError = useCallback((key: keyof AccountDataContextState['error'], value: string | null) => {
    setData(prev => ({ ...prev, error: { ...prev.error, [key]: value } }));
  }, []);

  const fetchOpenOrders = useCallback(async (traderId: string, mode: TradingMode) => {
    if (!isAuthenticated || !traderId || !mode) return;
    setLoading("orders", true); setError("orders", null);
    try {
      const paramsOpen = new URLSearchParams({ mode, status: "OPEN" });
      // API uses authenticated traderId from token for security
      const resOpen = await fetch(`/api/orders?${paramsOpen.toString()}`);
      if (!resOpen.ok) throw new Error(`(Open) ${ (await resOpen.json()).error || resOpen.statusText}`);
      const openOrdersData: {items: Order[]} = await resOpen.json();
      
      const paramsPartial = new URLSearchParams({ mode, status: "PARTIAL" });
      const resPartial = await fetch(`/api/orders?${paramsPartial.toString()}`);
      if (!resPartial.ok) throw new Error(`(Partial) ${(await resPartial.json()).error || resPartial.statusText}`);
      const partialOrdersData: {items: Order[]} = await resPartial.json();

      setData(prev => ({ ...prev, openOrders: [...(openOrdersData.items || []), ...(partialOrdersData.items || [])]
        .sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)) 
      }));
    } catch (e: any) { setError("orders", e.message); setData(prev => ({ ...prev, openOrders: [] }));}
    finally { setLoading("orders", false); }
  }, [isAuthenticated, setLoading, setError]);

  const fetchPositions = useCallback(async (traderId: string, mode: TradingMode) => {
    if (!isAuthenticated || !traderId || !mode) return;
    setLoading("positions", true); setError("positions", null);
    try {
      const params = new URLSearchParams({ mode });
      // API uses authenticated traderId
      const response = await fetch(`/api/positions?${params.toString()}`);
      if (!response.ok) throw new Error((await response.json()).error || response.statusText);
      const positionsData: Position[] = await response.json(); // API returns Position[] directly
      setData(prev => ({ ...prev, positions: positionsData }));
    } catch (e: any) { setError("positions", e.message); setData(prev => ({ ...prev, positions: [] }));}
    finally { setLoading("positions", false); }
  }, [isAuthenticated, setLoading, setError]);

  const fetchBalances = useCallback(async (traderId: string, mode: TradingMode) => {
    if (!isAuthenticated || !traderId || !mode) return;
    setLoading("balances", true); setError("balances", null);
    try {
      const params = new URLSearchParams({ mode });
      // API uses authenticated traderId
      const response = await fetch(`/api/balances?${params.toString()}`);
      if (!response.ok) throw new Error((await response.json()).error || response.statusText);
      const balancesData: Partial<Balance>[] = await response.json(); // API returns Partial<Balance>[]
      setData(prev => ({ ...prev, balances: balancesData }));
    } catch (e: any) { setError("balances", e.message); setData(prev => ({ ...prev, balances: [] }));}
    finally { setLoading("balances", false); }
  }, [isAuthenticated, setLoading, setError]);

  const fetchTradeHistoryPage = useCallback(async (traderId: string, mode: TradingMode, nextTokenParam?: string | null, isLoadMore = false) => {
    if (!isAuthenticated || !traderId || !mode) return null; // Return null if cannot fetch
    if (!isLoadMore) { // For initial load or refresh
        setData(prev => ({ ...prev, tradeHistory: [], tradeHistoryNextToken: null }));
    }
    setLoading("history", true); setError("history", null);
    try {
      const params = new URLSearchParams({ mode, limit: "20" }); 
      if (nextTokenParam) params.append("nextToken", nextTokenParam);
      // API uses authenticated traderId
      const response = await fetch(`/api/trades/history?${params.toString()}`);
      if (!response.ok) throw new Error((await response.json()).error || response.statusText);
      const historyData: { items: Trade[]; nextToken: string | null } = await response.json();
      
      setData(prev => ({
        ...prev,
        tradeHistory: isLoadMore ? [...prev.tradeHistory, ...historyData.items] : historyData.items,
        tradeHistoryNextToken: historyData.nextToken,
      }));
    } catch (e: any) { 
      setError("history", e.message); 
      if (!isLoadMore) setData(prev => ({ ...prev, tradeHistory: [], tradeHistoryNextToken: null }));
    } finally { setLoading("history", false); }
    // This function doesn't need to return nextToken, it's stored in state
  }, [isAuthenticated, setLoading, setError]);
  
  const loadMoreTradeHistory = useCallback(async () => {
    if (user?.properties.traderId && currentMode && data.tradeHistoryNextToken && !data.isLoading.history) {
      await fetchTradeHistoryPage(user.properties.traderId, currentMode, data.tradeHistoryNextToken, true);
    }
  }, [user?.properties.traderId, currentMode, data.tradeHistoryNextToken, data.isLoading.history, fetchTradeHistoryPage]);

  const fetchPaperPoints = useCallback(async (traderId: string) => {
    if (!isAuthenticated || !traderId) return;
    setLoading("points", true); setError("points", null);
    try {
      // API uses authenticated traderId (validated against path param)
      const response = await fetch(`/api/trades/${traderId}/paper-points`); 
      if (!response.ok) throw new Error((await response.json()).error || response.statusText);
      const pointsData: PaperPoints = await response.json();
      setData(prev => ({ ...prev, paperPoints: pointsData }));
    } catch (e: any) { setError("points", e.message); setData(prev => ({ ...prev, paperPoints: null }));}
    finally { setLoading("points", false); }
  }, [isAuthenticated, setLoading, setError]);

  const refreshAllAccountData = useCallback(() => {
    if (isAuthenticated && user?.properties.traderId && currentMode) {
      const traderId = user.properties.traderId;
      fetchOpenOrders(traderId, currentMode);
      fetchPositions(traderId, currentMode);
      fetchBalances(traderId, currentMode);
      fetchTradeHistoryPage(traderId, currentMode, null, false); // Initial fetch for history
      if (currentMode === "PAPER") {
        fetchPaperPoints(traderId);
      } else {
        setData(prev => ({ ...prev, paperPoints: null }));
      }
    } else {
      setData(initialDataState); // Reset to initial if not authenticated
    }
  }, [isAuthenticated, user?.properties.traderId, currentMode, fetchOpenOrders, fetchPositions, fetchBalances, fetchTradeHistoryPage, fetchPaperPoints]);

  useEffect(() => {
    refreshAllAccountData();
  }, [refreshAllAccountData]); // This effect triggers the initial data load and re-fetches if dependencies change.

  // Effect to handle WebSocket balance updates
  useEffect(() => {
    if (wsConnectionStatus === 'OPEN' && wsTraderData.balances) {
        // Check if the incoming WS balances are different from current context balances
        // This simple comparison might not be deep enough if objects are complex
        // but for balance strings it should be okay.
        let changed = false;
        const newBalancesFromWs: Partial<Balance>[] = [];

        for (const assetSymbol in wsTraderData.balances) {
            const wsBalance = wsTraderData.balances[assetSymbol];
            // Ensure the wsBalance is for the currentMode being viewed in the context
            if (wsBalance.mode === currentMode) {
                const existingBalance = data.balances.find(b => b.asset === wsBalance.asset);
                if (!existingBalance || existingBalance.balance !== wsBalance.balance || existingBalance.pending !== wsBalance.pending) {
                    changed = true;
                }
                newBalancesFromWs.push({
                    asset: wsBalance.asset,
                    balance: wsBalance.balance, // Assuming WsBalanceUpdate provides balance as string
                    pending: wsBalance.pending || "0", // Assuming WsBalanceUpdate provides pending as string
                    // pk and sk are not directly relevant for the array of balances in context state
                });
            }
        }
        // If only a subset of balances came via WS, we need to merge with existing non-updated balances
        if (changed || newBalancesFromWs.length !== data.balances.length) {
            setData(prev => {
                const updatedBalancesMap = new Map<string, Partial<Balance>>();
                // Add existing balances first
                prev.balances.forEach(b => {
                    if (b.asset) updatedBalancesMap.set(b.asset, b);
                });
                // Override/add new balances from WS
                newBalancesFromWs.forEach(b => {
                    if (b.asset) updatedBalancesMap.set(b.asset, b);
                });
                return {...prev, balances: Array.from(updatedBalancesMap.values())};
            });
        }
    }
  }, [wsTraderData.balances, wsConnectionStatus, currentMode, data.balances]);

  // TODO: Add similar useEffects to handle wsTraderData.lastOrderUpdate and wsTraderData.lastPositionUpdate
  // These would typically involve calling refreshOpenOrders() or refreshPositions() or merging the update.
  // For simplicity now, they will rely on periodic refreshAllAccountData or manual refresh.
  // A more reactive UI would merge these updates directly.


  const getBalanceByAsset = useCallback((assetSymbol: string): Partial<Balance> | undefined => {
    return data.balances.find(b => b.asset?.toUpperCase() === assetSymbol.toUpperCase());
  }, [data.balances]);

  const contextValue: AccountContextType = {
    ...data,
    refreshAllAccountData,
    refreshOpenOrders: () => { if(user?.properties.traderId && currentMode) fetchOpenOrders(user.properties.traderId, currentMode)},
    refreshPositions: () => { if(user?.properties.traderId && currentMode) fetchPositions(user.properties.traderId, currentMode)},
    refreshBalances: () => { if(user?.properties.traderId && currentMode) fetchBalances(user.properties.traderId, currentMode)},
    loadMoreTradeHistory,
    refreshPaperPoints: () => { if(user?.properties.traderId && currentMode === "PAPER") fetchPaperPoints(user.properties.traderId)},
    getBalanceByAsset,
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