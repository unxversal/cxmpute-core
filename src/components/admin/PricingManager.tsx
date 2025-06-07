'use client';

import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  ToggleLeft, 
  ToggleRight, 
  Save, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  Settings
} from 'lucide-react';

interface PricingConfig {
  configKey: string;
  pricePerUnit: number;
  unit: string;
  lastUpdated: string;
  updatedBy: string;
}

interface PricingManagerProps {
  userEmail: string;
}

export function PricingManager({ userEmail }: PricingManagerProps) {
  const [pricing, setPricing] = useState<PricingConfig[]>([]);
  const [isMainnet, setIsMainnet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPricingConfig();
  }, []);

  const fetchPricingConfig = async () => {
    try {
      const response = await fetch('/api/admin/pricing', {
        headers: {
          'x-admin-email': userEmail
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPricing(data.pricing || []);
        setIsMainnet(data.isMainnet || false);
      }
    } catch (error) {
      console.error('Failed to fetch pricing config:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMainnet = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': userEmail
        },
        body: JSON.stringify({
          action: isMainnet ? 'switch_testnet' : 'switch_mainnet'
        })
      });
      
      if (response.ok) {
        setIsMainnet(!isMainnet);
        await fetchPricingConfig();
      }
    } catch (error) {
      console.error('Failed to toggle mainnet mode:', error);
    } finally {
      setSaving(false);
    }
  };

  const initializePricing = async (mode: 'testnet' | 'mainnet') => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': userEmail
        },
        body: JSON.stringify({ mode })
      });
      
      if (response.ok) {
        await fetchPricingConfig();
      }
    } catch (error) {
      console.error('Failed to initialize pricing:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-gray-600">Loading pricing configuration...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pricing Management</h2>
          <p className="text-gray-600 mt-1">Configure service pricing and billing mode</p>
        </div>
        
        <button
          onClick={fetchPricingConfig}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">System Mode</h3>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                isMainnet 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}>
                {isMainnet ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
                <span className="font-medium">
                  {isMainnet ? 'Mainnet (Paid Services)' : 'Testnet (Free Services)'}
                </span>
              </div>
            </div>
          </div>
          
          <button
            onClick={toggleMainnet}
            disabled={saving}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              isMainnet
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isMainnet ? (
              <>
                <ToggleLeft className="h-5 w-5" />
                Switch to Testnet
              </>
            ) : (
              <>
                <ToggleRight className="h-5 w-5" />
                Switch to Mainnet
              </>
            )}
          </button>
        </div>
      </div>

      {pricing.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800 mb-2">No Pricing Configuration Found</h3>
              <p className="text-yellow-700 text-sm mb-4">
                Initialize the pricing system to set up default service rates.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => initializePricing('testnet')}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Pause className="h-4 w-4" />
                  Initialize Testnet (Free)
                </button>
                <button
                  onClick={() => initializePricing('mainnet')}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <Play className="h-4 w-4" />
                  Initialize Mainnet (Paid)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-blue-800 text-sm">
            <p className="font-medium mb-1">Pricing Configuration</p>
            <p className="text-blue-700">
              {isMainnet 
                ? 'System is in mainnet mode - users are charged for API usage'
                : 'System is in testnet mode - all services are free'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 