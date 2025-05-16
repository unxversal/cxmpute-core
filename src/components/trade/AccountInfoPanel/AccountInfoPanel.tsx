// src/components/trade/AccountInfoPanel/AccountInfoPanel.tsx
"use client";

import React, { useState } from 'react';
import styles from './AccountInfoPanel.module.css';
import OpenOrdersList from '../OpenOrdersList/OpenOrdersList';
import PositionsList from '../PositionsList/PositionsList';
import BalancesInfo from '../BalancesInfo/BalancesInfo';
import TradeHistoryList from '../TradeHistoryList/TradeHistoryList';
import { ListOrdered, Scale, Wallet, Clock } from 'lucide-react'; // Example icons

type AccountPanelTab = "orders" | "positions" | "balances" | "history";

const AccountInfoPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AccountPanelTab>("balances"); // Start with balances tab

  return (
    <div className={styles.accountPanelContainer}>
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabButton} ${activeTab === 'balances' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab("balances")}
        >
          <Wallet size={16} /> Balances
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'orders' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab("orders")}
        >
          <ListOrdered size={16} /> Open Orders
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'positions' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab("positions")}
        >
          <Scale size={16} /> Positions
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'history' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab("history")}
        >
          <Clock size={16} /> Trade History
        </button>
      </div>

      {/* Tab Content (Conditionally Render the appropriate list component) */}
      <div className={styles.tabContent}>
        {activeTab === "balances" && <BalancesInfo />}
        {activeTab === "orders" && <OpenOrdersList />}
        {activeTab === "positions" && <PositionsList />}
        {activeTab === "history" && <TradeHistoryList />}
      </div>
    </div>
  );
};

export default AccountInfoPanel;