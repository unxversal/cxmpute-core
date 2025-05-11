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
import { Resource } from "sst"; // To get WS API URL
import { useAuth } from "./AuthContext";
import { useTradingMode } from "./TradingModeContext";
import { useMarketContext } from "./MarketContext"; // To get selectedMarket

import type {
  WsDepthUpdate,
  WsTrade,
  WsMarkPriceUpdate,
  WsFundingRateUpdate,
  WsOrderUpdate,
  WsPositionUpdate,
  WsBalanceUpdate,
  WsLiquidationAlert,
  WsMarketDataState,
  WsTraderDataState,
} from "@/lib/interfaces"; // Adjust path as needed

type WebSocketStatus = "CONNECTING" | "OPEN" | "CLOSING" | "CLOSED" | "ERROR";

interface WebSocketContextType {
  connectionStatus: WebSocketStatus;
  marketData: WsMarketDataState;
  traderData: WsTraderDataState;
  lastError: string | null;
  connect: () => void; // Allow manual connection trigger
  disconnect: () => void;
  // sendMessage: (payload: object) => void; // May not be needed externally if subs are auto
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

const WS_API_URL = Resource.DexWsApi.url; // e.g., "wss://dev.dex.cxmpute.cloud"

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const { currentMode } = useTradingMode();
  const { selectedMarket } = useMarketContext();

  const socketRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<WebSocketStatus>("CLOSED");
  const [lastError, setLastError] = useState<string | null>(null);

  const [marketData, setMarketData] = useState<WsMarketDataState>({
    depth: null,
    lastTrade: null,
    markPrice: null,
    fundingRate: null,
  });

  const [traderData, setTraderData] = useState<WsTraderDataState>({
    lastOrderUpdate: null,
    lastPositionUpdate: null,
    balances: {},
    lastLiquidationAlert: null,
  });

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
      socketRef.current.close();
    }
  }, []);

  const connect = useCallback(() => {
    if (!isAuthenticated || !user?.properties.traderAk) {
      console.log("WebSocket: Not connecting, user not authenticated or traderAk missing.");
      if (socketRef.current) disconnect(); // Disconnect if already connected but auth changed
      return;
    }
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket: Already connected.");
      return;
    }

    setConnectionStatus("CONNECTING");
    setLastError(null);
    console.log(`WebSocket: Connecting to ${WS_API_URL} with traderAk...`);

    // Construct URL with traderAk
    const connectUrl = `${WS_API_URL}?traderAk=${user.properties.traderAk}`;
    const ws = new WebSocket(connectUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket: Connection OPEN");
      setConnectionStatus("OPEN");
      // Initial subscriptions will be triggered by useEffect below
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        // console.log("WebSocket: Message received", message);

        // Process message based on its type (align with fanOut.ts payload)
        switch (message.type) {
          // Market Data
          case "depth": // Assuming fanOut sends this type for depth updates
             setMarketData(prev => ({ ...prev, depth: message as WsDepthUpdate }));
             break;
          case "trade":
             setMarketData(prev => ({ ...prev, lastTrade: message as WsTrade }));
             break;
          case "markPrice": // Or if fundingRateUpdate contains markPrice
             setMarketData(prev => ({ ...prev, markPrice: message as WsMarkPriceUpdate }));
             break;
          case "fundingRateUpdate": // Matches funding.ts SNS payload
             setMarketData(prev => ({ ...prev, fundingRate: message as WsFundingRateUpdate, ...(message.markPrice && {markPrice: {type: "markPrice", market: message.market, mode: message.mode, price: message.markPrice, timestamp: message.timestamp}} ) }));
             break;

          // Trader Data (assuming these types are used in fanOut when publishing to trader channel)
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
          // Admin messages (e.g., market state change) could be handled here if needed
          case "marketStateUpdate":
            console.log("Market State Update:", message);
            // Potentially trigger a refresh of market list via MarketContext
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
      // Consider implementing retry logic here or exposing a manual reconnect
    };

    ws.onclose = (closeEvent) => {
      console.log("WebSocket: Connection CLOSED", closeEvent.code, closeEvent.reason);
      setConnectionStatus("CLOSED");
      socketRef.current = null; // Clear the ref
      setCurrentMarketChannel(null);
      setCurrentTraderChannel(null);
      // Optionally clear market/trader data on close or let it persist
    };
  }, [isAuthenticated, user?.properties.traderAk, disconnect]); // Added disconnect to dependency array for completeness

  // Effect to connect when authenticated and traderAk is available
  useEffect(() => {
    if (isAuthenticated && user?.properties.traderAk) {
      connect();
    } else {
      disconnect(); // Disconnect if auth state changes to unauthenticated
    }
    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [isAuthenticated, user?.properties.traderAk, connect, disconnect]);


  // Effect to subscribe to market channel
  useEffect(() => {
    if (connectionStatus === "OPEN" && selectedMarket && currentMode) {
      const newMarketChannel = `market.${selectedMarket.symbol}.${currentMode}`;
      if (newMarketChannel !== currentMarketChannel) {
        // If already subscribed to a different market, server might handle new sub implicitly
        // or you might want to explicitly send an "unsubscribe" message first if your backend supports it.
        console.log(`WebSocket: Subscribing to market channel: ${newMarketChannel}`);
        sendMessageToServer({ action: "subscribe", channel: newMarketChannel });
        setCurrentMarketChannel(newMarketChannel);
        // Clear old market data when subscribing to a new market
        setMarketData({ depth: null, lastTrade: null, markPrice: null, fundingRate: null });
      }
    } else if (currentMarketChannel && (connectionStatus !== "OPEN" || !selectedMarket || !currentMode)) {
        // Optional: send unsubscribe if connection closes or market/mode becomes null
        // sendMessageToServer({ action: "unsubscribe", channel: currentMarketChannel });
        setCurrentMarketChannel(null);
        setMarketData({ depth: null, lastTrade: null, markPrice: null, fundingRate: null }); // Clear data
    }
  }, [connectionStatus, selectedMarket, currentMode, sendMessageToServer, currentMarketChannel]);

  // Effect to subscribe to trader channel
  useEffect(() => {
    if (connectionStatus === "OPEN" && user?.properties.traderId && currentMode) {
      const newTraderChannel = `trader.${user.properties.traderId}.${currentMode}`;
      if (newTraderChannel !== currentTraderChannel) {
        console.log(`WebSocket: Subscribing to trader channel: ${newTraderChannel}`);
        sendMessageToServer({ action: "subscribe", channel: newTraderChannel });
        setCurrentTraderChannel(newTraderChannel);
      }
    } else if (currentTraderChannel && (connectionStatus !== "OPEN" || !user?.properties.traderId || !currentMode)) {
        setCurrentTraderChannel(null);
         // Optionally clear trader data if connection closes or traderId/mode is lost
        // setTraderData({ lastOrderUpdate: null, lastPositionUpdate: null, balances: {}, lastLiquidationAlert: null });
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