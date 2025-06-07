'use client';

import React from 'react';
import { Users, UserX, Trash2, Search } from 'lucide-react';

interface AccountManagerProps {
  userEmail: string;
}

export function AccountManager({ userEmail }: AccountManagerProps) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Account Management</h2>
          <p className="text-gray-600 mt-1">Suspend, delete, and manage user/provider accounts</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search accounts..."
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <Users className="h-8 w-8 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Search Users</h3>
          <p className="text-sm text-gray-600 mb-4">Find and manage user accounts</p>
          <button className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Search Users
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <UserX className="h-8 w-8 text-orange-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Suspend Account</h3>
          <p className="text-sm text-gray-600 mb-4">Temporarily disable access</p>
          <button className="w-full py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
            Suspend
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <Trash2 className="h-8 w-8 text-red-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Delete Account</h3>
          <p className="text-sm text-gray-600 mb-4">Permanently remove account</p>
          <button className="w-full py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            Delete
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Account Management</h3>
        <p className="text-gray-600">
          Search, suspend, and delete user and provider accounts.
          This feature will be fully implemented in the next phase.
        </p>
      </div>
    </div>
  );
} 