'use client';

import React from 'react';
import { 
  Users, 
  Server, 
  Bell, 
  UserX, 
  Activity,
  DollarSign,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface AdminDashboardStats {
  totalUsers: number;
  totalProviders: number;
  activeNotifications: number;
  suspendedAccounts: number;
  totalProvisions: number;
  monthlyRevenue: number;
  systemHealth: "healthy" | "warning" | "critical";
}

interface AdminStatsProps {
  stats: AdminDashboardStats | null;
  onRefresh: () => void;
}

export function AdminStats({ stats, onRefresh }: AdminStatsProps) {
  if (!stats) {
    return (
      <div className="p-8 text-center">
        <Activity className="h-8 w-8 animate-pulse mx-auto mb-4 text-blue-600" />
        <p className="text-gray-600">Loading statistics...</p>
      </div>
    );
  }

  const healthConfig = {
    healthy: {
      icon: <CheckCircle className="h-5 w-5 text-green-600" />,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200'
    },
    warning: {
      icon: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200'
    },
    critical: {
      icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200'
    }
  };

  const health = healthConfig[stats.systemHealth];

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      icon: <Users className="h-6 w-6 text-blue-600" />,
      change: '+12%',
      changeType: 'positive' as const
    },
    {
      title: 'Total Providers',
      value: stats.totalProviders.toLocaleString(),
      icon: <Server className="h-6 w-6 text-purple-600" />,
      change: '+8%',
      changeType: 'positive' as const
    },
    {
      title: 'Active Provisions',
      value: stats.totalProvisions.toLocaleString(),
      icon: <Activity className="h-6 w-6 text-green-600" />,
      change: '+24%',
      changeType: 'positive' as const
    },
    {
      title: 'Monthly Revenue',
      value: `$${stats.monthlyRevenue.toLocaleString()}`,
      icon: <DollarSign className="h-6 w-6 text-emerald-600" />,
      change: '+15%',
      changeType: 'positive' as const
    },
    {
      title: 'Active Notifications',
      value: stats.activeNotifications.toLocaleString(),
      icon: <Bell className="h-6 w-6 text-orange-600" />,
      change: stats.activeNotifications > 0 ? 'Active' : 'None',
      changeType: stats.activeNotifications > 0 ? 'neutral' : 'positive' as const
    },
    {
      title: 'Suspended Accounts',
      value: stats.suspendedAccounts.toLocaleString(),
      icon: <UserX className="h-6 w-6 text-red-600" />,
      change: stats.suspendedAccounts > 0 ? 'Requires attention' : 'None',
      changeType: stats.suspendedAccounts > 0 ? 'negative' : 'positive' as const
    }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Overview</h2>
          <p className="text-gray-600 mt-1">Real-time platform statistics and health</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* System Health */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${health.bg} ${health.border}`}>
            {health.icon}
            <span className={`text-sm font-medium ${health.color}`}>
              System {stats.systemHealth.charAt(0).toUpperCase() + stats.systemHealth.slice(1)}
            </span>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">{card.title}</h3>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                {card.icon}
              </div>
            </div>
            
            <div className="mt-4 flex items-center gap-1">
              <TrendingUp className={`h-4 w-4 ${
                card.changeType === 'positive' ? 'text-green-600' : 
                card.changeType === 'negative' ? 'text-red-600' : 
                'text-gray-500'
              }`} />
              <span className={`text-sm ${
                card.changeType === 'positive' ? 'text-green-600' : 
                card.changeType === 'negative' ? 'text-red-600' : 
                'text-gray-500'
              }`}>
                {card.change}
              </span>
              <span className="text-sm text-gray-500">from last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow text-left">
            <Bell className="h-5 w-5 text-blue-600" />
            <div>
              <div className="font-medium text-gray-900">Create Notification</div>
              <div className="text-sm text-gray-500">System-wide alert</div>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow text-left">
            <Users className="h-5 w-5 text-purple-600" />
            <div>
              <div className="font-medium text-gray-900">Manage Accounts</div>
              <div className="text-sm text-gray-500">Users & providers</div>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow text-left">
            <Server className="h-5 w-5 text-green-600" />
            <div>
              <div className="font-medium text-gray-900">Provision Control</div>
              <div className="text-sm text-gray-500">Manage compute</div>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow text-left">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="font-medium text-gray-900">Update Pricing</div>
              <div className="text-sm text-gray-500">Configure rates</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
} 