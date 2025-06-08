"use client";

import React, { useState, useEffect } from 'react';
import styles from './PricingManager.module.css';
import ThemeCard from '@/components/dashboard/ThemeCard/ThemeCard';
import DashboardButton from '@/components/dashboard/DashboardButton/DashboardButton';
import { 
  DollarSign, 
  Save, 
  Settings,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Plus
} from 'lucide-react';

interface PricingManagerProps {
  adminId: string;
}

interface PricingConfig {
  configId: string;
  endpoint: string;
  model?: string;
  basePrice: number;
  markup: number;
  finalPrice: number;
  currency: string;
  unit: string;
  updatedDate: string;
  updatedBy: string;
}

interface PricingForm {
  endpoint: string;
  model: string;
  basePrice: string;
  markup: string;
  currency: string;
  unit: string;
}

const PricingManager: React.FC<PricingManagerProps> = ({ adminId }) => {
  const [configs, setConfigs] = useState<PricingConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [form, setForm] = useState<PricingForm>({
    endpoint: '/chat/completions',
    model: '',
    basePrice: '',
    markup: '',
    currency: 'USD',
    unit: 'per 1K tokens'
  });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setConfigsLoading(true);
    try {
      const response = await fetch('/api/admin/pricing');
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
        setIsInitialized(data.isInitialized || false);
      }
    } catch (error) {
      console.error('Error fetching pricing configs:', error);
    } finally {
      setConfigsLoading(false);
    }
  };

  const handleInputChange = (field: keyof PricingForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const setPresetValues = (preset: 'low' | 'medium' | 'high') => {
    const presets = {
      low: { basePrice: '0.001', markup: '15' },
      medium: { basePrice: '0.002', markup: '20' },
      high: { basePrice: '0.005', markup: '30' }
    };
    
    setForm(prev => ({
      ...prev,
      basePrice: presets[preset].basePrice,
      markup: presets[preset].markup
    }));
  };

  const calculateFinalPrice = () => {
    const base = parseFloat(form.basePrice) || 0;
    const markupPercent = parseFloat(form.markup) || 0;
    return base * (1 + markupPercent / 100);
  };

  const updatePricing = async () => {
    if (!form.endpoint || !form.basePrice || !form.markup || !form.currency || !form.unit) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: form.endpoint,
          model: form.model || null,
          basePrice: parseFloat(form.basePrice),
          markup: parseFloat(form.markup),
          currency: form.currency,
          unit: form.unit,
          adminId
        })
      });

      if (response.ok) {
        // Reset form and refresh configs
        setForm({
          endpoint: '/chat/completions',
          model: '',
          basePrice: '',
          markup: '',
          currency: 'USD',
          unit: 'per 1K tokens'
        });
        fetchConfigs();
      }
    } catch (error) {
      console.error('Error updating pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultPricing = async () => {
    setInitLoading(true);
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId })
      });
      if (response.ok) {
        fetchConfigs();
      }
    } catch (error) {
      console.error('Error initializing pricing:', error);
    } finally {
      setInitLoading(false);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const finalPrice = calculateFinalPrice();

  return (
    <div className={styles.pricingManagerContainer}>
      {/* Initialization Check */}
      {!isInitialized && !configsLoading && (
        <ThemeCard className={styles.initPricingCard}>
          <div className={styles.initContent}>
            <div className={styles.statusIndicator + ' ' + styles.notInitialized}>
              <AlertCircle size={16} />
              Not Initialized
            </div>
            
            <h3>💰 Initialize Platform Pricing</h3>
            <p className={styles.initDescription}>
              No pricing configuration found. Initialize default pricing for all service endpoints 
              to get started with platform monetization.
            </p>
            
            <div className={styles.initWarning}>
              <strong>Note:</strong> This will create default pricing configurations for all endpoints 
              including chat completions, embeddings, TTS, scraping, and multimodal services.
            </div>
            
            <DashboardButton
              variant="primary"
              onClick={initializeDefaultPricing}
              disabled={initLoading}
              iconLeft={<Settings size={16} />}
              text={initLoading ? "Initializing..." : "Initialize Default Pricing"}
            />
          </div>
        </ThemeCard>
      )}

      {/* Current Pricing Table */}
      {isInitialized && (
        <ThemeCard className={styles.currentPricingCard}>
          <h3>💳 Current Pricing Configuration</h3>
          <p>Active pricing for all platform endpoints</p>
          
          {configsLoading ? (
            <div className={styles.loadingState}>Loading pricing configuration...</div>
          ) : configs.length === 0 ? (
            <div className={styles.emptyState}>
              <DollarSign size={48} />
              <p>No pricing configurations found</p>
            </div>
          ) : (
            <table className={styles.pricingTable}>
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Model</th>
                  <th>Base Price</th>
                  <th>Markup</th>
                  <th>Final Price</th>
                  <th>Unit</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((config) => (
                  <tr key={config.configId}>
                    <td className={styles.endpointCell}>{config.endpoint}</td>
                    <td>{config.model || '-'}</td>
                    <td className={styles.priceCell}>
                      {formatPrice(config.basePrice, config.currency)}
                    </td>
                    <td className={styles.markupCell}>{config.markup}%</td>
                    <td className={styles.priceCell}>
                      {formatPrice(config.finalPrice, config.currency)}
                    </td>
                    <td>{config.unit}</td>
                    <td className={styles.updatedCell}>
                      {formatDate(config.updatedDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ThemeCard>
      )}

      {/* Update Pricing Form */}
      {isInitialized && (
        <ThemeCard className={styles.updatePricingCard}>
          <h3>⚙️ Update Pricing Configuration</h3>
          <p>Modify pricing for specific endpoints and models</p>
          
          <div className={styles.pricingForm}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Endpoint *</label>
                <select
                  className={styles.formSelect + ' ' + styles.endpointSelect}
                  value={form.endpoint}
                  onChange={(e) => handleInputChange('endpoint', e.target.value)}
                >
                  <option value="/chat/completions">/chat/completions</option>
                  <option value="/embeddings">/embeddings</option>
                  <option value="/tts">/tts</option>
                  <option value="/scrape">/scrape</option>
                  <option value="/image">/image</option>
                  <option value="/video">/video</option>
                  <option value="/m">/m (multimodal)</option>
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label>Model (Optional)</label>
                <input
                  type="text"
                  className={styles.formInput + ' ' + styles.modelSelect}
                  placeholder="e.g., llama3, nomic-embed-text"
                  value={form.model}
                  onChange={(e) => handleInputChange('model', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Base Price *</label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  className={styles.formInput + ' ' + styles.priceInput}
                  placeholder="0.002"
                  value={form.basePrice}
                  onChange={(e) => handleInputChange('basePrice', e.target.value)}
                />
                <div className={styles.presetButtons}>
                  <button
                    type="button"
                    className={styles.presetButton}
                    onClick={() => setPresetValues('low')}
                  >
                    Low
                  </button>
                  <button
                    type="button"
                    className={styles.presetButton}
                    onClick={() => setPresetValues('medium')}
                  >
                    Medium
                  </button>
                  <button
                    type="button"
                    className={styles.presetButton}
                    onClick={() => setPresetValues('high')}
                  >
                    High
                  </button>
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label>Markup Percentage *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1000"
                  className={styles.formInput}
                  placeholder="20"
                  value={form.markup}
                  onChange={(e) => handleInputChange('markup', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Currency *</label>
                <select
                  className={styles.formSelect + ' ' + styles.currencySelect}
                  value={form.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label>Unit *</label>
                <select
                  className={styles.formSelect + ' ' + styles.unitSelect}
                  value={form.unit}
                  onChange={(e) => handleInputChange('unit', e.target.value)}
                >
                  <option value="per 1K tokens">per 1K tokens</option>
                  <option value="per 1K characters">per 1K characters</option>
                  <option value="per request">per request</option>
                  <option value="per image">per image</option>
                  <option value="per video">per video</option>
                  <option value="per minute">per minute</option>
                </select>
              </div>
            </div>

            {/* Pricing Preview */}
            {form.basePrice && form.markup && (
              <div className={styles.previewCard}>
                <h4 className={styles.previewTitle}>💰 Pricing Preview</h4>
                <table className={styles.previewTable}>
                  <tbody>
                    <tr className={styles.calculationRow}>
                      <td>Base Price:</td>
                      <td>{formatPrice(parseFloat(form.basePrice) || 0, form.currency)}</td>
                    </tr>
                    <tr className={styles.calculationRow}>
                      <td>Markup ({form.markup}%):</td>
                      <td>{formatPrice((parseFloat(form.basePrice) || 0) * (parseFloat(form.markup) || 0) / 100, form.currency)}</td>
                    </tr>
                    <tr className={styles.finalPriceRow}>
                      <td><strong>Final Price:</strong></td>
                      <td><strong>{formatPrice(finalPrice, form.currency)} {form.unit}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className={styles.formRow}>
              <DashboardButton
                variant="secondary"
                onClick={() => setForm({
                  endpoint: '/chat/completions',
                  model: '',
                  basePrice: '',
                  markup: '',
                  currency: 'USD',
                  unit: 'per 1K tokens'
                })}
                text="Reset Form"
              />
              <DashboardButton
                variant="primary"
                onClick={updatePricing}
                disabled={loading || !form.endpoint || !form.basePrice || !form.markup}
                iconLeft={<Save size={16} />}
                text={loading ? "Updating..." : "Update Pricing"}
              />
            </div>
          </div>
        </ThemeCard>
      )}
    </div>
  );
};

export default PricingManager; 