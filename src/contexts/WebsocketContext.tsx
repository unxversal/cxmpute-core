// src/contexts/WebSocketContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { Resource } from "sst";
import { useAuth } from "./AuthContext";
import { useTradingMode } from "./TradingModeContext";
import { useMarketContext } from "./MarketContext";

import type {
  WsDepthUpdate,
  WsTrade,
  WsMarkPriceUpdate,
  WsFundingRateUpdate,
  WsMarketSummaryUpdate, // Added
  WsOrderUpdate,
  WsPositionUpdate,
  WsBalanceUpdate,
  WsLiquidationAlert,
  WsMarketDataState, // This will now include 'summary'
  WsTraderDataState,
} from "@/lib/interfaces"; // Adjust path as needed

type WebSocketStatus = "CONNECTING" | "OPEN" | "CLOSING" | "CLOSED" | "ERROR";

interface WebSocketContextType {
  connectionStatus: WebSocketStatus;
  marketData: WsMarketDataState;
  traderData: WsTraderDataState;
  lastError: string | null;
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

const WS_API_URL = Resource.DexWsApi.url;

const initialMarketDataState: WsMarketDataState = {
  depth: null,
  lastTrade: null,
  markPrice: null,
  fundingRate: null,
  summary: null, // Initialize summary
};

const initialTraderDataState: WsTraderDataState = {
  lastOrderUpdate: null,
  lastPositionUpdate: null,
  balances: {},
  lastLiquidationAlert: null,
};

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const { currentMode } = useTradingMode();
  const { selectedMarket } = useMarketContext();

  const socketRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<WebSocketStatus>("CLOSED");
  const [lastError, setLastError] = useState<string | null>(null);

  const [marketData, setMarketData] = useState<WsMarketDataState>(initialMarketDataState);
  const [traderData, setTraderData] = useState<WsTraderDataState>(initialTraderDataState);

  const [currentMarketChannel, setCurrentMarketChannel] = useState<string | null>(null);
  const [currentTraderChannel, setCurrentTraderChannel] = useState<string | null>(null);

  const sendMessageToServer = useCallback((payload: object) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      console.warn("WebSocket not open. Cannot send message:", payload);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log("WebSocket: Disconnecting...");
      setConnectionStatus("CLOSING");
      socketRef.current.onclose = () => {}; // Clear previous onclose before closing
      socketRef.current.close();
      socketRef.current = null; // Ensure ref is cleared immediately
    }
     // Reset states regardless of socketRef.current state to ensure clean UI
    setConnectionStatus("CLOSED");
    setCurrentMarketChannel(null);
    setCurrentTraderChannel(null);
    setMarketData(initialMarketDataState); // Reset market data on disconnect
    setTraderData(initialTraderDataState); // Reset trader data on disconnect
  }, []);


  const connect = useCallback(() => {
    if (!isAuthenticated || !user?.properties.traderAk) {
      console.log("WebSocket: Not connecting, user not authenticated or traderAk missing.");
      if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) {
        disconnect();
      }
      return;
    }
    // Prevent multiple connection attempts if already connecting or open
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      console.log("WebSocket: Already connected or connecting.");
      return;
    }

    setConnectionStatus("CONNECTING");
    setLastError(null);
    setMarketData(initialMarketDataState); // Reset data on new connection attempt
    setTraderData(initialTraderDataState);
    console.log(`WebSocket: Connecting to ${WS_API_URL} with traderAk...`);

    const connectUrl = `${WS_API_URL}?traderAk=${user.properties.traderAk}`;
    const ws = new WebSocket(connectUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket: Connection OPEN");
      setConnectionStatus("OPEN");
      // Initial subscriptions are handled by useEffect hooks below
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        // console.log("WebSocket: Message received", message);

        switch (message.type) {
          // Market Data
          case "depth":
             setMarketData(prev => ({ ...prev, depth: message as WsDepthUpdate }));
             break;
          case "trade": // WsTrade now potentially includes prevPrice
             setMarketData(prev => ({ ...prev, lastTrade: message as WsTrade }));
             break;
          case "markPrice":
             setMarketData(prev => ({ ...prev, markPrice: message as WsMarkPriceUpdate }));
             break;
          case "fundingRateUpdate":
             setMarketData(prev => ({
                ...prev,
                fundingRate: message as WsFundingRateUpdate,
                ...(message.markPrice && { // If funding update also provides mark price
                    markPrice: {
                        type: "markPrice",
                        market: message.market,
                        mode: message.mode,
                        price: message.markPrice,
                        timestamp: message.timestamp
                    }
                })
             }));
             break;
          case "marketSummaryUpdate": // Handle the new summary update
             setMarketData(prev => ({
                ...prev,
                summary: message as WsMarketSummaryUpdate,
                // Also update markPrice and fundingRate if summary contains them and is newer
                ...(message.markPrice !== null && (!prev.markPrice || message.timestamp >= prev.markPrice.timestamp) && {
                    markPrice: { type: "markPrice", market: message.market, mode: message.mode, price: message.markPrice, timestamp: message.timestamp }
                }),
                ...(message.fundingRate !== null && (!prev.fundingRate || message.timestamp >= prev.fundingRate.timestamp) && {
                    fundingRate: { type: "fundingRateUpdate", market: message.market, mode: message.mode, fundingRate: message.fundingRate, timestamp: message.timestamp }
                })
             }));
             break;

          // Trader Data
          case "orderUpdate":
            setTraderData(prev => ({ ...prev, lastOrderUpdate: message as WsOrderUpdate }));
            break;
          case "positionUpdate":
            setTraderData(prev => ({ ...prev, lastPositionUpdate: message as WsPositionUpdate }));
            break;
          case "balanceUpdate": {
            const balanceMsg = message as WsBalanceUpdate;
            setTraderData(prev => ({
                ...prev,
                balances: {
                    ...prev.balances,
                    [balanceMsg.asset]: balanceMsg,
                }
            }));
            break;
          }
          case "liquidationAlert":
            setTraderData(prev => ({ ...prev, lastLiquidationAlert: message as WsLiquidationAlert }));
            break;
          case "marketStateUpdate": // e.g. market paused/resumed
            console.log("WebSocket: Market State Update received", message);
            // This could trigger a refresh of available markets in MarketContext
            // or update UI elements directly if they depend on market status.
            break;
          default:
            console.warn("WebSocket: Received unhandled message type:", message.type, message);
        }
      } catch (error) {
        console.error("WebSocket: Error parsing message data", error, event.data);
      }
    };

    ws.onerror = (errorEvent) => {
      console.error("WebSocket: Error", errorEvent);
      setLastError("WebSocket connection error occurred.");
      setConnectionStatus("ERROR");
    };

    ws.onclose = (closeEvent) => {
      console.log("WebSocket: Connection CLOSED", closeEvent.code, closeEvent.reason);
      // Check if the socket that closed is the current active socket
      // This prevents an old socket's onclose from resetting a newer connection's state.
      if (socketRef.current === ws) {
        disconnect(); // Use the disconnect function to ensure clean state reset
      }
    };
  }, [isAuthenticated, user?.properties.traderAk, disconnect]); // Added disconnect

  // Effect to connect/disconnect based on authentication
  useEffect(() => {
    if (isAuthenticated && user?.properties.traderAk) {
      connect();
    } else {
      disconnect();
    }
    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [isAuthenticated, user?.properties.traderAk, connect, disconnect]);


  // Effect to subscribe/unsubscribe to market channel
  useEffect(() => {
    if (connectionStatus === "OPEN" && selectedMarket && currentMode) {
      const newMarketChannel = `market.${selectedMarket.symbol}.${currentMode}`;
      if (newMarketChannel !== currentMarketChannel) {
        if (currentMarketChannel) {
          // Optional: send unsubscribe for the old channel if your backend supports it
          // sendMessageToServer({ action: "unsubscribe", channel: currentMarketChannel });
        }
        console.log(`WebSocket: Subscribing to market channel: ${newMarketChannel}`);
        sendMessageToServer({ action: "subscribe", channel: newMarketChannel });
        setCurrentMarketChannel(newMarketChannel);
        // Reset specific market data when changing markets to avoid showing stale data
        setMarketData(prev => ({
            ...initialMarketDataState, // Reset all market-specific fields
            summary: prev.summary?.market === newMarketChannel.split('.')[1] && prev.summary?.mode === currentMode ? prev.summary : null // Keep summary if it matches new market, else clear
        }));
      }
    } else if (currentMarketChannel && (connectionStatus !== "OPEN" || !selectedMarket || !currentMode)) {
      // Connection closed or no market/mode selected, clear subscription and data
      // Optional: send unsubscribe
      // sendMessageToServer({ action: "unsubscribe", channel: currentMarketChannel });
      setCurrentMarketChannel(null);
      setMarketData(initialMarketDataState); // Reset all market data
    }
  }, [connectionStatus, selectedMarket, currentMode, sendMessageToServer, currentMarketChannel]);

  // Effect to subscribe/unsubscribe to trader channel
  useEffect(() => {
    if (connectionStatus === "OPEN" && user?.properties.traderId && currentMode) {
      const newTraderChannel = `trader.${user.properties.traderId}.${currentMode}`;
      if (newTraderChannel !== currentTraderChannel) {
        if (currentTraderChannel) {
           // Optional: send unsubscribe for the old channel
           // sendMessageToServer({ action: "unsubscribe", channel: currentTraderChannel });
        }
        console.log(`WebSocket: Subscribing to trader channel: ${newTraderChannel}`);
        sendMessageToServer({ action: "subscribe", channel: newTraderChannel });
        setCurrentTraderChannel(newTraderChannel);
        // No need to reset traderData usually, as it's user-specific, not market-specific
      }
    } else if (currentTraderChannel && (connectionStatus !== "OPEN" || !user?.properties.traderId || !currentMode)) {
      // Optional: send unsubscribe
      // sendMessageToServer({ action: "unsubscribe", channel: currentTraderChannel });
      setCurrentTraderChannel(null);
      // Optionally clear trader data on full disconnect or if user logs out.
      // setTraderData(initialTraderDataState); // This might be too aggressive if user just switches mode
    }
  }, [connectionStatus, user?.properties.traderId, currentMode, sendMessageToServer, currentTraderChannel]);


  const contextValue = {
    connectionStatus,
    marketData,
    traderData,
    lastError,
    connect,
    disconnect,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};