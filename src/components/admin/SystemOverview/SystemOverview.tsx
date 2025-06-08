"use client";

import React, { useState, useEffect } from 'react';
import styles from './SystemOverview.module.css';
import ThemeCard from '@/components/dashboard/ThemeCard/ThemeCard';
import DashboardButton from '@/components/dashboard/DashboardButton/DashboardButton';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { AuthenticatedUserSubject } from '@/lib/auth';
import { 
  Users, 
  Server, 
  Activity, 
  DollarSign, 
  RefreshCcw,
  CheckCircle,
  AlertTriangle,
  Database
} from 'lucide-react';

interface SystemOverviewProps {
  subject: AuthenticatedUserSubject['properties'];
}

interface SystemStats {
  totalUsers: number;
  totalProviders: number;
  activeProvisions: number;
  totalEarnings: number;
  pendingActions: number;
  lastUpdated: string;
}

const SystemOverview: React.FC<SystemOverviewProps> = ({ subject }) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pricingStatus, setPricingStatus] = useState<'checking' | 'success' | 'error' | null>(null);

  const fetchSystemStats = async () => {
    try {
      const response = await fetch('/api/admin/system/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch system stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching system stats:', error);
      notify.error('Failed to load system statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStats = async () => {
    setIsRefreshing(true);
    await fetchSystemStats();
    setIsRefreshing(false);
  };

  const initPricingCheck = async () => {
    setPricingStatus('checking');
    try {
      const response = await fetch('/api/admin/pricing/init', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to initialize pricing');
      }
      
      const result = await response.json();
      setPricingStatus('success');
      notify.success(`Pricing initialized: ${result.message}`);
    } catch (error) {
      setPricingStatus('error');
      notify.error(error instanceof Error ? error.message : 'Failed to initialize pricing');
    }
  };

  useEffect(() => {
    fetchSystemStats();
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div>Loading system overview...</div>
      </div>
    );
  }

  return (
    <div className={styles.systemOverviewContainer}>
      {/* Statistics Cards */}
      <div className={styles.statsGrid}>
        <ThemeCard className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statIcon}>
              <Users size={24} />
            </div>
            <div className={styles.statInfo}>
              <h3>Total Users</h3>
              <p className={styles.statNumber}>{stats?.totalUsers || 0}</p>
            </div>
          </div>
        </ThemeCard>

        <ThemeCard className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statIcon}>
              <Server size={24} />
            </div>
            <div className={styles.statInfo}>
              <h3>Total Providers</h3>
              <p className={styles.statNumber}>{stats?.totalProviders || 0}</p>
            </div>
          </div>
        </ThemeCard>

        <ThemeCard className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statIcon}>
              <Activity size={24} />
            </div>
            <div className={styles.statInfo}>
              <h3>Active Provisions</h3>
              <p className={styles.statNumber}>{stats?.activeProvisions || 0}</p>
            </div>
          </div>
        </ThemeCard>

        <ThemeCard className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statIcon}>
              <DollarSign size={24} />
            </div>
            <div className={styles.statInfo}>
              <h3>Total Earnings (CXPT)</h3>
              <p className={styles.statNumber}>{stats?.totalEarnings?.toLocaleString() || 0}</p>
            </div>
          </div>
        </ThemeCard>
      </div>

      {/* Actions Panel */}
      <ThemeCard title="System Actions" className={styles.actionsPanel}>
        <div className={styles.actionsGrid}>
          <div className={styles.actionItem}>
            <div className={styles.actionInfo}>
              <h4>Refresh Statistics</h4>
              <p>Update all system statistics and counters</p>
            </div>
            <DashboardButton
              variant="secondary"
              iconLeft={<RefreshCcw size={16} />}
              text="Refresh"
              onClick={refreshStats}
              isLoading={isRefreshing}
              disabled={isRefreshing}
            />
          </div>

          <div className={styles.actionItem}>
            <div className={styles.actionInfo}>
              <h4>Initialize Pricing</h4>
              <p>Set up default pricing for all services and models</p>
            </div>
            <DashboardButton
              variant={pricingStatus === 'success' ? 'primary' : 'accentOrange'}
              iconLeft={
                pricingStatus === 'success' ? <CheckCircle size={16} /> :
                pricingStatus === 'error' ? <AlertTriangle size={16} /> :
                <Database size={16} />
              }
              text={
                pricingStatus === 'success' ? 'Initialized' :
                pricingStatus === 'error' ? 'Failed' :
                pricingStatus === 'checking' ? 'Initializing...' :
                'Initialize'
              }
              onClick={initPricingCheck}
              isLoading={pricingStatus === 'checking'}
              disabled={pricingStatus === 'checking' || pricingStatus === 'success'}
            />
          </div>
        </div>
      </ThemeCard>

      {/* System Info */}
      <ThemeCard title="System Information" className={styles.systemInfo}>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <strong>Admin:</strong> {subject.email}
          </div>
          <div className={styles.infoItem}>
            <strong>Last Updated:</strong> {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Never'}
          </div>
          <div className={styles.infoItem}>
            <strong>Platform Status:</strong> <span className={styles.statusOperational}>Operational</span>
          </div>
        </div>
      </ThemeCard>
    </div>
  );
};

export default SystemOverview; 