// src/components/dashboard/Dashboard.tsx
"use client";

import React, { useState, useEffect } from 'react';
import styles from './dashboard.module.css'; // Main dashboard container styles
import DashboardToggle, { DashboardViewType } from './DashboardToggle/DashboardToggle';
import UserDashboardContent from './UserDashboardContent/UserDashboardContent'; // Corrected path
import ProviderDashboardContent from './ProviderDashboardContent/ProviderDashboardContent'; // Corrected path
import type { AuthenticatedUserSubject } from '@/lib/auth';
import LoadingSpinner from '../ui/LoadingSpinner/LoadingSpinner'; // For initial loading state

// Props for the main Dashboard component
interface DashboardProps {
  subject: AuthenticatedUserSubject['properties'];
}

const Dashboard: React.FC<DashboardProps> = ({ subject }) => {
  const [activeDashboardView, setActiveDashboardView] = useState<DashboardViewType>("user");
  const [isLoading, setIsLoading] = useState(true); // For initial setup/hydration

  // A simple effect to remove initial loading state after mount
  useEffect(() => {
    setIsLoading(false);
  }, []);

  const handleViewChange = (view: DashboardViewType) => {
    setActiveDashboardView(view);
  };

  // Determine if the provider view should be available.
  // This logic might become more complex (e.g., check a 'isProviderRegistered' flag on subject)
  // For now, we assume if a providerId exists, they are a provider.
  const isProviderViewAvailable = !!subject.providerId;


  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size={48} />
        <p>Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* The DashboardToggle now sits above the content */}
      <div className={styles.toggleSection}>
        <DashboardToggle
          activeView={activeDashboardView}
          onViewChange={handleViewChange}
          isProviderViewAvailable={isProviderViewAvailable}
        />
      </div>

      <div className={styles.contentSection}>
        {activeDashboardView === 'user' && (
          <UserDashboardContent subject={subject} />
        )}
        {activeDashboardView === 'provider' && isProviderViewAvailable && (
          <ProviderDashboardContent subject={subject} />
        )}
        {activeDashboardView === 'provider' && !isProviderViewAvailable && (
            <div className={styles.accessDeniedCard}>
                <h3>Provider Dashboard Not Accessible</h3>
                <p>You have not registered as a provider. Please complete provider onboarding to access this section.</p>
                {/* Optional: Add a button/link to provider onboarding flow if you have one */}
                {/* <Button onClick={() => { /* Navigate to provider signup * / }}>Become a Provider</Button> */}
            </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;