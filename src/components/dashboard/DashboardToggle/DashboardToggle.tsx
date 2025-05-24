// src/components/dashboard/DashboardToggle/DashboardToggle.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import styles from './DashboardToggle.module.css';
import Button from '@/components/ui/Button/Button'; // Assuming your custom Button component
import { User, Briefcase, TrendingUp } from 'lucide-react'; // Example icons

export type DashboardViewType = "user" | "provider";

interface DashboardToggleProps {
  activeView: DashboardViewType;
  onViewChange: (view: DashboardViewType) => void;
  // Optional: if you need to disable provider view for non-providers (logic handled by parent)
  isProviderViewAvailable?: boolean;
}

const DashboardToggle: React.FC<DashboardToggleProps> = ({
  activeView,
  onViewChange,
  isProviderViewAvailable = true, // Assume available by default
}) => {
  return (
    <div className={styles.toggleContainer}>
      <Button
        variant={activeView === 'user' ? 'primary' : 'outline'}
        onClick={() => onViewChange('user')}
        className={`${styles.toggleButton} ${activeView === 'user' ? styles.activeUser : ''}`}
        iconLeft={<User size={16} />}
        aria-pressed={activeView === 'user'}
      >
        User
      </Button>

      <Button
        variant={activeView === 'provider' ? 'primary' : 'outline'}
        onClick={() => onViewChange('provider')}
        className={`${styles.toggleButton} ${activeView === 'provider' ? styles.activeProvider : ''}`}
        iconLeft={<Briefcase size={16} />}
        disabled={!isProviderViewAvailable}
        title={!isProviderViewAvailable ? "Provider dashboard requires provider setup" : "Switch to Provider Dashboard"}
        aria-pressed={activeView === 'provider'}
      >
        Provider
      </Button>

      <Link href="/trade" passHref legacyBehavior>
        <a className={styles.linkButtonWrapper} target="_blank" rel="noopener noreferrer">
          <Button
            variant="outline" // Consistent style with inactive toggles
            className={`${styles.toggleButton} ${styles.traderLink}`}
            iconLeft={<TrendingUp size={16} />}
          >
            Trader
          </Button>
        </a>
      </Link>
    </div>
  );
};

export default DashboardToggle;