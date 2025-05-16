// src/components/trade/TradeDashboard/TradeDashboard.tsx
"use client";

import React from 'react';
import styles from './TradeDashboard.module.css';

// Context Providers
// AuthProvider and TradingModeProvider are expected to wrap this component at a higher level (e.g., in the page.tsx)
import { MarketProvider } from '@/contexts/MarketContext';
import { WebSocketProvider } from '@/contexts/WebsocketContext'; // Corrected casing
import { AccountProvider } from '@/contexts/AccountContext';
import { OrderEntryProvider } from '@/contexts/OrderEntryContext';
import { WalletProvider } from '@/contexts/WalletContext'; // For WalletConnectButton and Modals

// Layout and Panel Components
import TradingLayout from '@/components/trade/TradingLayout/TradingLayout';
import MarketSelector from '@/components/trade/MarketSelector/MarketSelector';
import ModeSwitcher from '@/components/trade/ModeSwitcher/ModeSwitcher';
import WalletConnectButton from '@/components/trade/WalletConnectButton/WalletConnectButton';
import MarketInfoBar from '@/components/trade/MarketInfoBar/MarketInfoBar';
import TradingChart from '@/components/trade/TradingChart/TradingChart';
import OrderEntryPanel from '@/components/trade/OrderEntryPanel/OrderEntryPanel';
import OrderBook from '@/components/trade/Orderbook/Orderbook';
import RecentTrades from '@/components/trade/RecentTrades/RecentTrades';
import AccountInfoPanel from '@/components/trade/AccountInfoPanel/AccountInfoPanel';
import NotificationToaster from '@/components/ui/NotificationToaster/NotificationToaster'; // Global Toaster

// No initial props for market/mode for now, contexts will handle defaults
// interface TradeDashboardProps {
//   initialMarketSymbol?: string;
//   initialMode?: TradingMode;
// }

const TradeDashboard: React.FC = (/* props: TradeDashboardProps */) => {
  // If initial props were used, they would be passed to the relevant context providers.
  // e.g., <MarketProvider initialSymbol={props.initialMarketSymbol}>

  return (
    // Wrap with providers that are specific to the trading dashboard's lifecycle
    // AuthProvider and TradingModeProvider are assumed to be further up the tree.
    <MarketProvider> {/* Manages underlyings, active instruments */}
      <AccountProvider> {/* Manages user-specific balances, orders, positions, history */}
        <WalletProvider> {/* Manages external wallet connection (MetaMask, etc.) */}
            <WebSocketProvider> {/* Manages WebSocket connection and live data streams */}
            <OrderEntryProvider> {/* Manages state for the order entry form and its interactions */}
                <div className={styles.dashboardWrapper}>
                <NotificationToaster /> {/* For global app notifications */}

                <TradingLayout
                    marketSelectorArea={
                    <div className={styles.topBarControls}>
                        <div className={styles.topLeftControls}>
                            <MarketSelector />
                            <ModeSwitcher />
                        </div>
                        <div className={styles.topRightControls}>
                            {/* WalletConnectButton is for REAL mode */}
                            <WalletConnectButton />
                        </div>
                    </div>
                    }
                    marketInfoArea={<MarketInfoBar />}
                    chartArea={<TradingChart />}
                    orderEntryArea={<OrderEntryPanel />}
                    orderBookArea={<OrderBook />}
                    recentTradesArea={<RecentTrades />}
                    accountInfoArea={<AccountInfoPanel />}
                />
                </div>
            </OrderEntryProvider>
            </WebSocketProvider>
        </WalletProvider>
      </AccountProvider>
    </MarketProvider>
  );
};

export default TradeDashboard;