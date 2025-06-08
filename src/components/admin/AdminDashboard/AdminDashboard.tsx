"use client";

import React, { useState } from 'react';
import styles from './AdminDashboard.module.css';
import ThemeCard from '@/components/dashboard/ThemeCard/ThemeCard';
import DashboardButton from '@/components/dashboard/DashboardButton/DashboardButton';
import type { AuthenticatedUserSubject } from '@/lib/auth';
import { 
  Users, 
  Bell, 
  Server, 
  DollarSign, 
  Shield, 
  Settings,
  AlertTriangle,
  UserX,
  Trash2
} from 'lucide-react';

// Import admin sections
import AccountManagement from '../AccountManagement/AccountManagement';
import NotificationManager from '../NotificationManager/NotificationManager';
import ProvisionManager from '../ProvisionManager/ProvisionManager';
import PricingManager from '../PricingManager/PricingManager';

interface AdminDashboardProps {
  subject: AuthenticatedUserSubject['properties'];
}

type AdminTab = 'accounts' | 'notifications' | 'provisions' | 'pricing';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ subject }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('accounts');

  const tabs = [
    {
      id: 'accounts' as AdminTab,
      label: 'Account Management',
      icon: <Users size={20} />,
      description: 'Suspend, delete, and manage user accounts',
      component: <AccountManagement adminId={subject.id} />
    },
    {
      id: 'notifications' as AdminTab,
      label: 'Notifications',
      icon: <Bell size={20} />,
      description: 'Send platform-wide notifications and announcements',
      component: <NotificationManager adminId={subject.id} />
    },
    {
      id: 'provisions' as AdminTab,
      label: 'Provision Control',
      icon: <Server size={20} />,
      description: 'Disconnect and manage provider provisions',
      component: <ProvisionManager adminId={subject.id} />
    },
    {
      id: 'pricing' as AdminTab,
      label: 'Pricing & Fees',
      icon: <DollarSign size={20} />,
      description: 'Configure platform pricing and fee structures',
      component: <PricingManager adminId={subject.id} />
    }
  ];

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div className={styles.adminDashboardContainer}>
      {/* Header */}
      <ThemeCard className={styles.headerCard}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.adminBadge}>
              <Shield size={24} />
              <span>ADMIN</span>
            </div>
            <h1 className={styles.dashboardTitle}>Platform Administration</h1>
            <p className={styles.welcomeMessage}>
              Welcome, {subject.email}. Manage the Cxmpute platform with administrative controls.
            </p>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.warningNotice}>
              <AlertTriangle size={20} />
              <div>
                <p><strong>Admin Access</strong></p>
                <p>Handle with care. Changes affect all users.</p>
              </div>
            </div>
          </div>
        </div>
      </ThemeCard>

      {/* Tab Navigation */}
      <ThemeCard className={styles.tabNavigationCard}>
        <div className={styles.tabNavigation}>
          {tabs.map((tab) => (
            <DashboardButton
              key={tab.id}
              variant={activeTab === tab.id ? 'primary' : 'secondary'}
              iconLeft={tab.icon}
              text={tab.label}
              onClick={() => setActiveTab(tab.id)}
              className={`${styles.tabButton} ${activeTab === tab.id ? styles.activeTab : ''}`}
            />
          ))}
        </div>
      </ThemeCard>

      {/* Active Tab Content */}
      <div className={styles.tabContent}>
        <ThemeCard className={styles.contentCard}>
          <div className={styles.contentHeader}>
            <h2 className={styles.contentTitle}>
              {activeTabData?.icon}
              {activeTabData?.label}
            </h2>
            <p className={styles.contentDescription}>{activeTabData?.description}</p>
          </div>
          <div className={styles.contentBody}>
            {activeTabData?.component}
          </div>
        </ThemeCard>
      </div>
    </div>
  );
};

export default AdminDashboard; 