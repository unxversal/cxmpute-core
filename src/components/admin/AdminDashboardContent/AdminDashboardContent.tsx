"use client";

import React, { useState } from 'react';
import styles from './AdminDashboardContent.module.css';
import ThemeCard from '@/components/dashboard/ThemeCard/ThemeCard';
import DashboardButton from '@/components/dashboard/DashboardButton/DashboardButton';
import type { AuthenticatedUserSubject } from '@/lib/auth';
import { 
  Users, 
  Server, 
  Bell, 
  DollarSign, 
  Shield, 
  AlertTriangle
} from 'lucide-react';

// Import tab components
import AccountManagement from '../AccountManagement/AccountManagement';
import NotificationManager from '../NotificationManager/NotificationManager';
import ProvisionManager from '../ProvisionManager/ProvisionManager';
import PricingManager from '../PricingManager/PricingManager';
import SystemOverview from '../SystemOverview/SystemOverview';

interface AdminDashboardProps {
  subject: AuthenticatedUserSubject['properties'];
}

type AdminTab = 'overview' | 'accounts' | 'notifications' | 'provisions' | 'pricing';

const AdminDashboardContent: React.FC<AdminDashboardProps> = ({ subject }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const tabs = [
    {
      id: 'overview' as AdminTab,
      label: 'System Overview',
      icon: <Shield size={20} />,
      description: 'Platform statistics and health monitoring'
    },
    {
      id: 'accounts' as AdminTab,
      label: 'Account Management',
      icon: <Users size={20} />,
      description: 'Suspend, delete, and manage user/provider accounts'
    },
    {
      id: 'notifications' as AdminTab,
      label: 'Notifications',
      icon: <Bell size={20} />,
      description: 'Send system-wide notifications and announcements'
    },
    {
      id: 'provisions' as AdminTab,
      label: 'Provision Management',
      icon: <Server size={20} />,
      description: 'Disconnect and manage provider provisions'
    },
    {
      id: 'pricing' as AdminTab,
      label: 'Pricing & Fees',
      icon: <DollarSign size={20} />,
      description: 'Configure service pricing and fee structures'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <SystemOverview subject={subject} />;
      case 'accounts':
        return <AccountManagement subject={subject} />;
      case 'notifications':
        return <NotificationManager subject={subject} />;
      case 'provisions':
        return <ProvisionManager subject={subject} />;
      case 'pricing':
        return <PricingManager subject={subject} />;
      default:
        return <SystemOverview subject={subject} />;
    }
  };

  return (
    <div className={styles.adminDashboardContainer}>
      {/* Header */}
      <ThemeCard className={styles.heroCard}>
        <div className={styles.heroContent}>
          <div className={styles.heroLeft}>
            <h3 className={styles.emailDisplay}>{subject.email}</h3>
            <h1 className={styles.dashboardTitle}>Admin Dashboard</h1>
            <h2 className={styles.welcomeMessage}>
              Platform administration and management tools
            </h2>
            <div className={styles.adminBadge}>
              <Shield size={16} />
              <span>Administrator Access</span>
            </div>
          </div>
          <div className={styles.heroRight}>
            <div className={styles.quickStats}>
              <div className={styles.statItem}>
                <AlertTriangle size={20} className={styles.warningIcon} />
                <span>System Status: Operational</span>
              </div>
            </div>
          </div>
        </div>
      </ThemeCard>

      {/* Tab Navigation */}
      <ThemeCard className={styles.tabNavigation}>
        <div className={styles.tabButtons}>
          {tabs.map((tab) => (
            <DashboardButton
              key={tab.id}
              variant={activeTab === tab.id ? 'primary' : 'ghost'}
              size="md"
              iconLeft={tab.icon}
              text={tab.label}
              onClick={() => setActiveTab(tab.id)}
              className={styles.tabButton}
            />
          ))}
        </div>
        <div className={styles.tabDescription}>
          <p>{tabs.find(tab => tab.id === activeTab)?.description}</p>
        </div>
      </ThemeCard>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default AdminDashboardContent; 