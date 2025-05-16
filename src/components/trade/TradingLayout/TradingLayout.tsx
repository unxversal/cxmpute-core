"use client";

import React, { ReactNode } from 'react';
import styles from './TradingLayout.module.css';

interface TradingLayoutProps {
  marketSelectorArea?: ReactNode; // e.g., <MarketSelector /> and <ModeSwitcher />
  marketInfoArea: ReactNode;     // e.g., <MarketInfoBar />
  chartArea: ReactNode;          // e.g., <TradingChart />
  orderEntryArea: ReactNode;   // e.g., <OrderEntryPanel />
  orderBookArea: ReactNode;      // e.g., <OrderBook />
  recentTradesArea: ReactNode;   // e.g., <RecentTrades />
  accountInfoArea: ReactNode;    // e.g., <AccountInfoPanel />
  // Potentially a top bar for global controls like WalletConnectButton, ModeSwitcher
  // topBarArea?: ReactNode; 
}

const TradingLayout: React.FC<TradingLayoutProps> = ({
  marketSelectorArea,
  marketInfoArea,
  chartArea,
  orderEntryArea,
  orderBookArea,
  recentTradesArea,
  accountInfoArea,
}) => {
  return (
    <div className={styles.tradingLayoutWrapper}>
      {/* Optional Top Bar Area - for global selectors, wallet connect etc. */}
      {marketSelectorArea && (
        <header className={styles.topBar}>
            {marketSelectorArea}
        </header>
      )}

      {/* Main Content Grid */}
      <main className={styles.mainContent}>
        {/* Left Column: Order Book & Recent Trades */}
        <aside className={`${styles.column} ${styles.leftColumn}`}>
          <section className={`${styles.panel} ${styles.orderBookPanel}`} aria-labelledby="orderbook-title">
            {/* <h2 id="orderbook-title" className="sr-only">Order Book</h2> */}
            {orderBookArea}
          </section>
          <section className={`${styles.panel} ${styles.recentTradesPanel}`} aria-labelledby="recenttrades-title">
            {/* <h2 id="recenttrades-title" className="sr-only">Recent Trades</h2> */}
            {recentTradesArea}
          </section>
        </aside>

        {/* Center Column: Market Info, Chart & Order Entry */}
        <section className={`${styles.column} ${styles.centerColumn}`}>
          <section className={`${styles.panel} ${styles.marketInfoPanel}`} aria-labelledby="marketinfo-title">
            {/* <h2 id="marketinfo-title" className="sr-only">Market Information</h2> */}
            {marketInfoArea}
          </section>
          <section className={`${styles.panel} ${styles.chartPanel}`} aria-labelledby="chart-title">
            {/* <h2 id="chart-title" className="sr-only">Trading Chart</h2> */}
            {chartArea}
          </section>
          <section className={`${styles.panel} ${styles.orderEntryPanel}`} aria-labelledby="orderentry-title">
            {/* <h2 id="orderentry-title" className="sr-only">Order Entry</h2> */}
            {orderEntryArea}
          </section>
        </section>

        {/* Right Column: Account Information */}
        <aside className={`${styles.column} ${styles.rightColumn}`}>
          <section className={`${styles.panel} ${styles.accountInfoPanel}`} aria-labelledby="accountinfo-title">
            {/* <h2 id="accountinfo-title" className="sr-only">Account Information</h2> */}
            {accountInfoArea}
          </section>
        </aside>
      </main>
    </div>
  );
};

export default TradingLayout;