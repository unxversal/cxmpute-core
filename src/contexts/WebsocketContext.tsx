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
import { useMarketContext } from "./MarketContext"; // For activeInstrumentSymbol

import type {
  WsDepthUpdate,
  WsTrade,
  WsMarkPriceUpdate,
  WsFundingRateUpdate,
  WsMarketSummaryUpdate,
  WsOrderUpdate,
  WsPositionUpdate,
  WsBalanceUpdate,
  WsLiquidationAlert,
  WsMarketDataState,
  WsTraderDataState,
} from "@/lib/interfaces";

type WebSocketStatus = "CONNECTING" | "OPEN" | "CLOSING" | "CLOSED" | "ERROR" | "IDLE"; // Added IDLE

interface WebSocketContextType {
  connectionStatus: WebSocketStatus;
  marketSpecificData: WsMarketDataState; // Renamed for clarity
  traderData: WsTraderDataState;
  lastError: string | null;
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

const WS_API_URL = Resource.DexWsApi.url;

const initialMarketSpecificDataState: WsMarketDataState = {
  depth: null,
  lastTrade: null,
  markPrice: null,
  fundingRate: null,
  summary: null,
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
  // Key change: Now using activeInstrumentSymbol from MarketContext
  const { activeInstrumentSymbol } = useMarketContext();

  const socketRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<WebSocketStatus>("IDLE");
  const [lastError, setLastError] = useState<string | null>(null);

  // Renamed for clarity, as this data is specific to `activeInstrumentSymbol`
  const [marketSpecificData, setMarketSpecificData] = useState<WsMarketDataState>(initialMarketSpecificDataState);
  const [traderData, setTraderData] = useState<WsTraderDataState>(initialTraderDataState);

  const [currentMarketChannelSub, setCurrentMarketChannelSub] = useState<string | null>(null);
  const [currentTraderChannelSub, setCurrentTraderChannelSub] = useState<string | null>(null);

  const sendMessageToServer = useCallback((payload: object) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      console.warn("WebSocket not open when trying to send message:", payload);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log("WebSocket: Disconnecting initiated...");
      socketRef.current.onclose = null; // Deregister onclose before calling close
      socketRef.current.onerror = null; // Deregister onerror
      socketRef.current.onmessage = null; // Deregister onmessage
      socketRef.current.onopen = null; // Deregister onopen
      if (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING) {
        socketRef.current.close(1000, "User disconnected");
      }
      socketRef.current = null;
    }
    setConnectionStatus("CLOSED");
    setCurrentMarketChannelSub(null);
    setCurrentTraderChannelSub(null);
    setMarketSpecificData(initialMarketSpecificDataState);
    setTraderData(initialTraderDataState);
    setLastError(null);
     console.log("WebSocket: State reset after disconnect.");
  }, []);


  const connect = useCallback(() => {
    if (!isAuthenticated || !user?.properties.traderAk) {
      console.log("WebSocket: Connect called but user not authenticated or traderAk missing. Current status:", connectionStatus);
      if (connectionStatus !== "IDLE" && connectionStatus !== "CLOSED" && connectionStatus !== "ERROR") {
         disconnect(); // Ensure clean state if called while in a transient state
      }
      setConnectionStatus("IDLE"); // Set to IDLE if cannot connect
      return;
    }
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      console.log("WebSocket: Already connected or connecting. Status:", connectionStatus);
      return;
    }

    console.log(`WebSocket: Attempting to connect with traderAk...`);
    setConnectionStatus("CONNECTING");
    setLastError(null);
    setMarketSpecificData(initialMarketSpecificDataState);
    setTraderData(initialTraderDataState);

    const connectUrl = `${WS_API_URL}?traderAk=${user.properties.traderAk}`;
    const ws = new WebSocket(connectUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket: Connection OPEN");
      setConnectionStatus("OPEN");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        // console.log("WebSocket: Message received", message.type, message.market);

        // Filter messages to ensure they match the current active instrument symbol and mode
        // For trader-specific messages, we only check the mode.
        const isForCurrentMarket = activeInstrumentSymbol && message.market === activeInstrumentSymbol && message.mode === currentMode;
        // const isForCurrentTrader = user?.properties.traderId && message.traderId === user.properties.traderId && message.mode === currentMode;
        const isGlobalMarketState = message.type === "marketStateUpdate" && message.market === activeInstrumentSymbol && message.mode === currentMode;


        switch (message.type) {
          case "depth":
          case "trade":
          case "markPrice":
          case "fundingRateUpdate":
          case "marketSummaryUpdate":
            if (isForCurrentMarket) {
              setMarketSpecificData(prev => {
                const updated = { ...prev };
                if (message.type === "depth") updated.depth = message as WsDepthUpdate;
                if (message.type === "trade") updated.lastTrade = message as WsTrade;
                if (message.type === "markPrice") updated.markPrice = message as WsMarkPriceUpdate;
                if (message.type === "fundingRateUpdate") {
                    updated.fundingRate = message as WsFundingRateUpdate;
                    if (message.markPrice && (!updated.markPrice || message.timestamp >= updated.markPrice.timestamp)) {
                        updated.markPrice = { type: "markPrice", market: message.market, mode: message.mode, price: message.markPrice, timestamp: message.timestamp };
                    }
                }
                if (message.type === "marketSummaryUpdate") {
                    updated.summary = message as WsMarketSummaryUpdate;
                     if (message.markPrice !== null && message.markPrice !== undefined && (!updated.markPrice || message.timestamp >= updated.markPrice.timestamp)) {
                        updated.markPrice = { type: "markPrice", market: message.market, mode: message.mode, price: message.markPrice, timestamp: message.timestamp };
                    }
                    if (message.fundingRate !== null && message.fundingRate !== undefined && (!updated.fundingRate || message.timestamp >= updated.fundingRate.timestamp)) {
                        updated.fundingRate = { type: "fundingRateUpdate", market: message.market, mode: message.mode, fundingRate: message.fundingRate, timestamp: message.timestamp };
                    }
                }
                return updated;
              });
            }
            break;

          case "orderUpdate":
          case "positionUpdate":
          case "liquidationAlert":
             // These are trader-specific but might also contain a market.
             // We generally want all trader updates regardless of the *activeInstrumentSymbol*
             // as they might pertain to other markets the user is involved in.
             // The check for `message.mode === currentMode` is important.
            if (message.mode === currentMode) {
                 if (message.type === "orderUpdate") setTraderData(prev => ({ ...prev, lastOrderUpdate: message as WsOrderUpdate }));
                 if (message.type === "positionUpdate") setTraderData(prev => ({ ...prev, lastPositionUpdate: message as WsPositionUpdate }));
                 if (message.type === "liquidationAlert") setTraderData(prev => ({ ...prev, lastLiquidationAlert: message as WsLiquidationAlert }));
            }
            break;
          case "balanceUpdate": {
            // Balance updates are per-asset and per-mode for the trader.
            if (message.mode === currentMode) {
                const balanceMsg = message as WsBalanceUpdate;
                setTraderData(prev => ({
                    ...prev,
                    balances: { ...prev.balances, [balanceMsg.asset]: balanceMsg }
                }));
            }
            break;
          }
          case "marketStateUpdate": // e.g. market paused/resumed by admin
            if (isGlobalMarketState) {
                console.log("WebSocket: Market State Update received for active market", message);
                // The MarketContext might listen for this type of event and refresh its `availableUnderlyings`
                // or specific instrument details if a market becomes PAUSED.
                // For now, just logging. Or WebSocketContext could re-expose this message.
            }
            break;
          default:
            // console.warn("WebSocket: Received unhandled or filtered message type:", message.type, message);
            break;
        }
      } catch (error) {
        console.error("WebSocket: Error parsing message data", error, event.data);
      }
    };

    ws.onerror = (errorEvent) => {
      console.error("WebSocket: Connection Error", errorEvent);
      setLastError("WebSocket connection error.");
      // Don't call disconnect() here directly, onclose will handle state transition
      // setConnectionStatus("ERROR"); // onclose will set to CLOSED or ERROR if it was abrupt
    };

    ws.onclose = (closeEvent) => {
      console.log("WebSocket: Connection CLOSED. Code:", closeEvent.code, "Reason:", closeEvent.reason, "Was clean:", closeEvent.wasClean);
      // Check if the socket that closed is the current active socket
      if (socketRef.current === ws) {
        // If it wasn't a clean disconnect initiated by our app, consider it an error.
        if (!closeEvent.wasClean && connectionStatus !== "CLOSING") {
            setLastError(closeEvent.reason || "WebSocket connection closed unexpectedly.");
            setConnectionStatus("ERROR");
        } else {
            setConnectionStatus("CLOSED");
        }
        // Call disconnect to clean up state, but it won't try to close again if ref is null
        socketRef.current = null; // Critical: ensure ref is null before calling disconnect to prevent re-close
        disconnect(); // Centralized state cleanup
      }
    };
  }, [isAuthenticated, user?.properties.traderAk, disconnect, activeInstrumentSymbol, currentMode, connectionStatus]);

  useEffect(() => {
    if (isAuthenticated && user?.properties.traderAk && connectionStatus === "IDLE") {
      connect();
    } else if ((!isAuthenticated || !user?.properties.traderAk) && connectionStatus !== "CLOSED" && connectionStatus !== "IDLE") {
      disconnect();
    }
    return () => {
        // Ensure disconnection on component unmount only if connected/connecting
      if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
         disconnect();
      }
    };
  }, [isAuthenticated, user?.properties.traderAk, connect, disconnect, connectionStatus]);

  // Effect to (re)subscribe to market channel when activeInstrumentSymbol or mode changes
  useEffect(() => {
    if (connectionStatus === "OPEN" && activeInstrumentSymbol && currentMode) {
      const newMarketChannel = `market.${activeInstrumentSymbol}.${currentMode}`;
      if (newMarketChannel !== currentMarketChannelSub) {
        if (currentMarketChannelSub) {
          // Optional: sendMessageToServer({ action: "unsubscribe", channel: currentMarketChannelSub });
        }
        console.log(`WebSocket: Subscribing to market channel: ${newMarketChannel}`);
        sendMessageToServer({ action: "subscribe", channel: newMarketChannel });
        setCurrentMarketChannelSub(newMarketChannel);
        // Reset market-specific data for the new instrument
        setMarketSpecificData(initialMarketSpecificDataState);
      }
    } else if (currentMarketChannelSub && (connectionStatus !== "OPEN" || !activeInstrumentSymbol || !currentMode)) {
      // Unsubscribe or clear state if no longer relevant
      // Optional: sendMessageToServer({ action: "unsubscribe", channel: currentMarketChannelSub });
      setCurrentMarketChannelSub(null);
      setMarketSpecificData(initialMarketSpecificDataState);
    }
  }, [connectionStatus, activeInstrumentSymbol, currentMode, sendMessageToServer, currentMarketChannelSub]);

  // Effect to (re)subscribe to trader channel when user or mode changes
  useEffect(() => {
    if (connectionStatus === "OPEN" && user?.properties.traderId && currentMode) {
      const newTraderChannel = `trader.${user.properties.traderId}.${currentMode}`;
      if (newTraderChannel !== currentTraderChannelSub) {
        if (currentTraderChannelSub) {
           // Optional: sendMessageToServer({ action: "unsubscribe", channel: currentTraderChannelSub });
        }
        console.log(`WebSocket: Subscribing to trader channel: ${newTraderChannel}`);
        sendMessageToServer({ action: "subscribe", channel: newTraderChannel });
        setCurrentTraderChannelSub(newTraderChannel);
        // Trader data is generally persistent across market changes but might reset on mode change for some parts
      }
    } else if (currentTraderChannelSub && (connectionStatus !== "OPEN" || !user?.properties.traderId || !currentMode)) {
      // Optional: sendMessageToServer({ action: "unsubscribe", channel: currentTraderChannelSub });
      setCurrentTraderChannelSub(null);
      // setTraderData(initialTraderDataState); // Consider if trader data should clear here
    }
  }, [connectionStatus, user?.properties.traderId, currentMode, sendMessageToServer, currentTraderChannelSub]);

  const contextValue = {
    connectionStatus,
    marketSpecificData, // Use new name
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