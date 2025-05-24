// src/components/dashboard/DashboardToggle/DashboardToggle.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import styles from './DashboardToggle.module.css';
import DashboardButton from '../DashboardButton/DashboardButton'; // Using our new DashboardButton
import { User, Briefcase, TrendingUp } from 'lucide-react';

export type DashboardViewType = "user" | "provider";

interface DashboardToggleProps {
  activeView: DashboardViewType;
  onViewChange: (view: DashboardViewType) => void;
  isProviderViewAvailable?: boolean;
}

const DashboardToggle: React.FC<DashboardToggleProps> = ({
  activeView,
  onViewChange,
  isProviderViewAvailable = true,
}) => {
  return (
    <div className={styles.toggleContainer}>
      <DashboardButton
        variant={activeView === 'user' ? 'accentPurple' : 'secondary'} // User active: Purple, Inactive: Slate
        onClick={() => onViewChange('user')}
        className={styles.toggleButton} // General class for all toggle buttons
        iconLeft={<User size={16} />}
        aria-pressed={activeView === 'user'}
        text="User View"
      />

      <DashboardButton
        variant={activeView === 'provider' ? 'primary' : 'secondary'} // Provider active: Green, Inactive: Slate
        onClick={() => onViewChange('provider')}
        className={styles.toggleButton}
        iconLeft={<Briefcase size={16} />}
        disabled={!isProviderViewAvailable}
        title={!isProviderViewAvailable ? "Provider dashboard requires provider setup" : "Switch to Provider Dashboard"}
        aria-pressed={activeView === 'provider'}
        text="Provider View"
      />

      {/* Trader link remains distinct */}
      <Link href="/trade" passHref legacyBehavior>
        <a className={styles.linkButtonWrapper} target="_blank" rel="noopener noreferrer">
          <DashboardButton
            variant="accentYellow" // Yellow for Trader, distinct from active/inactive toggles
            className={`${styles.toggleButton} ${styles.traderLinkButton}`}
            iconLeft={<TrendingUp size={16} />}
            text="Trading"
          />
        </a>
      </Link>
    </div>
  );
};

export default DashboardToggle;