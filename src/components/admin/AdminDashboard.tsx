'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Bell, 
  Settings, 
  Shield, 
  Activity,
  Unplug,
  DollarSign,
  BarChart3,
  UserCheck,
  UserX,
  Trash2,
  Play,
  Pause
} from 'lucide-react';
import { AdminStats } from './AdminStats';
import { NotificationManager } from './NotificationManager';
import { AccountManager } from './AccountManager';
import { ProvisionManager } from './ProvisionManager';
import { PricingManager } from './PricingManager';

interface AdminDashboardProps {
  userEmail: string;
}

type TabType = 'overview' | 'notifications' | 'accounts' | 'provisions' | 'pricing';

interface AdminDashboardStats {
  totalUsers: number;
  totalProviders: number;
  activeNotifications: number;
  suspendedAccounts: number;
  totalProvisions: number;
  monthlyRevenue: number;
  systemHealth: "healthy" | "warning" | "critical";
}

export function AdminDashboard({ userEmail }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/admin/dashboard', {
        headers: {
          'x-admin-email': userEmail
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    {
      id: 'overview' as TabType,
      label: 'Overview',
      icon: <BarChart3 className="h-4 w-4" />,
      description: 'System statistics and health'
    },
    {
      id: 'notifications' as TabType,
      label: 'Notifications',
      icon: <Bell className="h-4 w-4" />,
      description: 'Manage system notifications'
    },
    {
      id: 'accounts' as TabType,
      label: 'Accounts',
      icon: <Users className="h-4 w-4" />,
      description: 'User and provider management'
    },
    {
      id: 'provisions' as TabType,
      label: 'Provisions',
      icon: <Unplug className="h-4 w-4" />,
      description: 'Manage compute provisions'
    },
    {
      id: 'pricing' as TabType,
      label: 'Pricing',
      icon: <DollarSign className="h-4 w-4" />,
      description: 'Configure pricing and billing'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AdminStats stats={stats} onRefresh={fetchDashboardStats} />;
      case 'notifications':
        return <NotificationManager userEmail={userEmail} />;
      case 'accounts':
        return <AccountManager userEmail={userEmail} />;
      case 'provisions':
        return <ProvisionManager userEmail={userEmail} />;
      case 'pricing':
        return <PricingManager userEmail={userEmail} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600">
            Manage users, providers, notifications, and system settings
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            <span className="text-sm text-gray-600">
              Admin access granted for {userEmail}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span className={`mr-2 ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}`}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab description */}
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              {tabs.find(tab => tab.id === activeTab)?.description}
            </p>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading && activeTab === 'overview' ? (
            <div className="p-8 text-center">
              <Activity className="h-8 w-8 animate-pulse mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Loading dashboard...</p>
            </div>
          ) : (
            renderTabContent()
          )}
        </div>
      </div>
    </div>
  );
} 