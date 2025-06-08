// src/components/dashboard/Dashboard.tsx
"use client";

import React, { useState, useEffect } from 'react';
import styles from './dashboard.module.css'; // Main dashboard container styles
import DashboardToggle, { DashboardViewType } from './DashboardToggle/DashboardToggle';
import UserDashboardContent from './UserDashboardContent/UserDashboardContent'; // Path to themed user content
import ProviderDashboardContent from './ProviderDashboardContent/ProviderDashboardContent'; // Path to themed provider content
import type { AuthenticatedUserSubject } from '@/lib/auth';
import SkeletonLoader from '../ui/SkeletonLoader/SkeletonLoader'; // Light-themed skeleton for page load

// Props for the main Dashboard component
interface DashboardProps {
  subject: AuthenticatedUserSubject['properties'];
}

const Dashboard: React.FC<DashboardProps> = ({ subject }) => {
  // Default to 'user' view, or 'provider' if user has a providerId but no strong user-specific landing reason
  const initialView: DashboardViewType = subject.providerId ? "provider" : "user";
  const [activeDashboardView, setActiveDashboardView] = useState<DashboardViewType>(initialView);
  const [isClientHydrated, setIsClientHydrated] = useState(false);

  useEffect(() => {
    setIsClientHydrated(true);
  }, []);

  const handleViewChange = (view: DashboardViewType) => {
    setActiveDashboardView(view);
  };

  // Provider view is available if subject has a providerId.
  const isProviderViewAvailable = !!subject.providerId;

  if (!isClientHydrated) {
    return (
      <div className={styles.pageLoadingContainer}>
        <SkeletonLoader type="rectangle" width="80%" height="60px" style={{ marginBottom: '20px' }}/>
        <SkeletonLoader type="rectangle" width="100%" height="400px" />
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}> {/* This is the main flex column from module */}
      <div className={styles.toggleSection}>
        <DashboardToggle
          activeView={activeDashboardView}
          onViewChange={handleViewChange}
          isProviderViewAvailable={isProviderViewAvailable}
          isAdmin={subject.admin}
        />
      </div>

      <div className={styles.contentSection}>
        {activeDashboardView === 'user' && (
          <UserDashboardContent subject={subject} />
        )}
        {activeDashboardView === 'provider' && isProviderViewAvailable && (
          <ProviderDashboardContent subject={subject} />
        )}
        {/* Fallback if provider view is selected but not available (e.g., direct URL manipulation attempt) */}
        {activeDashboardView === 'provider' && !isProviderViewAvailable && (
            <div className={styles.accessDeniedCard}>
                <h3>Provider Dashboard Not Accessible</h3>
                <p>You have not registered as a provider. Please complete provider onboarding to access this section.</p>
                {/* You might want a button here to guide them to a provider signup/info page */}
                {/* Example: <DashboardButton variant="primary" text="Become a Provider" href="/provider-signup" /> */}
            </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;