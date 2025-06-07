'use client';

import React from 'react';
import { Bell, Plus } from 'lucide-react';

interface NotificationManagerProps {
  userEmail: string;
}

export function NotificationManager({ userEmail }: NotificationManagerProps) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notification Management</h2>
          <p className="text-gray-600 mt-1">Create and manage system-wide notifications</p>
        </div>
        
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" />
          Create Notification
        </button>
      </div>

      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Notification Manager</h3>
        <p className="text-gray-600">
          Create notifications for homepage, user dashboard, or provider dashboard.
          This feature will be fully implemented in the next phase.
        </p>
      </div>
    </div>
  );
} 