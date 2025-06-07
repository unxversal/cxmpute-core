'use client';

import React from 'react';
import { Server, Unplug, AlertTriangle } from 'lucide-react';

interface ProvisionManagerProps {
  userEmail: string;
}

export function ProvisionManager({ userEmail }: ProvisionManagerProps) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Provision Management</h2>
          <p className="text-gray-600 mt-1">Manage compute provisions and connectivity</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <Unplug className="h-8 w-8 text-orange-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Disconnect All</h3>
          <p className="text-sm text-gray-600 mb-4">Disconnect all active provisions</p>
          <button className="w-full py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
            Disconnect All
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <Server className="h-8 w-8 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Provider Provisions</h3>
          <p className="text-sm text-gray-600 mb-4">Disconnect specific provider</p>
          <button className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Manage Provider
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Specific Provision</h3>
          <p className="text-sm text-gray-600 mb-4">Disconnect individual provision</p>
          <button className="w-full py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            Disconnect Single
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Provision Management</h3>
        <p className="text-gray-600">
          Disconnect provisions for maintenance, emergencies, or provider management.
          This feature will be fully implemented in the next phase.
        </p>
      </div>
    </div>
  );
} 