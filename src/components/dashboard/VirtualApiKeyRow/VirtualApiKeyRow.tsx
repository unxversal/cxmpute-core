// src/components/dashboard/VirtualApiKeyRow/VirtualApiKeyRow.tsx
"use client";

import React, { useState } from 'react';
import styles from './VirtualApiKeyRow.module.css';
import type { ApiKeyInfo } from '@/lib/interfaces';
import DashboardButton from '../DashboardButton/DashboardButton'; // Updated import
import Tooltip from '@/components/ui/Tooltip/Tooltip'; // Assuming dark tooltip is acceptable, or create themed one
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import { Copy, Edit3, Trash2, Eye, EyeOff, ListChecks, DollarSign, KeyRound, CheckCircle } from 'lucide-react';

interface VirtualApiKeyRowProps {
  apiKeyData: ApiKeyInfo & { name?: string };
  onDelete: (keyString: string) => void; // Parent handles confirmation & API call
  onEdit: (keyData: ApiKeyInfo & { name?: string }) => void; // Parent opens edit modal
  isDeleting?: boolean;
}

const maskApiKeyString = (key: string, show: boolean): string => {
  if (show) return key;
  if (key.length <= 8) return '****'.padEnd(key.length, '*');
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

const VirtualApiKeyRow: React.FC<VirtualApiKeyRowProps> = ({
  apiKeyData,
  onDelete,
  onEdit,
  isDeleting = false,
}) => {
  const [showFullKey, setShowFullKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKeyData.key)
      .then(() => {
        setCopied(true);
        notify.success("API Key copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy API key:', err);
        notify.error('Failed to copy key.');
      });
  };

  const handleDelete = () => {
    onDelete(apiKeyData.key);
  };

  const handleEdit = () => {
    onEdit(apiKeyData);
  };
  
  const permittedRoutesSummary = apiKeyData.permittedRoutes.length > 1
    ? `${apiKeyData.permittedRoutes[0].split('/').pop()} +${apiKeyData.permittedRoutes.length - 1}`
    : apiKeyData.permittedRoutes[0]?.split('/').pop() || 'None';

  return (
    <div className={`${styles.keyRowContainer} ${isDeleting ? styles.deletingState : ''}`}>
      <div className={styles.keyIconArea}>
        <KeyRound size={28} className={styles.mainKeyIcon}/>
      </div>
      <div className={styles.keyDetails}>
        <div className={styles.keyNameAndString}>
            <span className={styles.keyName} title={apiKeyData.name || `Key: ${apiKeyData.key}`}>
                {apiKeyData.name || `Virtual Key`}
            </span>
            <span className={styles.fullKeyStringSmall} title={apiKeyData.key}>
                (Key: {maskApiKeyString(apiKeyData.key, showFullKey)})
            </span>
        </div>

        <div className={styles.keyMetaGrid}>
            <div className={styles.metaItem}>
                <DollarSign size={14} className={styles.metaIcon} />
                <Tooltip 
                    content={`Credits Used: ${(apiKeyData.creditLimit - apiKeyData.creditsLeft).toLocaleString()} / Limit: ${apiKeyData.creditLimit.toLocaleString()}`} 
                    position="top"
                >
                    <span className={styles.metaText}>
                        {apiKeyData.creditsLeft.toLocaleString()} / {apiKeyData.creditLimit.toLocaleString()} credits
                    </span>
                </Tooltip>
            </div>

            <div className={styles.metaItem}>
                <ListChecks size={14} className={styles.metaIcon} />
                 <Tooltip 
                    content={
                        <div className={styles.tooltipRouteListWrapper}>
                            <strong>Permitted Routes:</strong>
                            <ul className={styles.tooltipRouteList}>
                                {apiKeyData.permittedRoutes.map(r => <li key={r}>{r}</li>)}
                                {apiKeyData.permittedRoutes.length === 0 && <li>No routes permitted.</li>}
                            </ul>
                        </div>
                    }
                    position="top"
                 >
                    <span className={styles.metaText}>
                        {apiKeyData.permittedRoutes.length} Route(s): {permittedRoutesSummary}
                    </span>
                </Tooltip>
            </div>
        </div>
      </div>

      <div className={styles.keyActions}>
        <Tooltip content={showFullKey ? "Hide Full Key" : "Show Full Key"} position="top">
            <DashboardButton variant="ghost" size="sm" onClick={() => setShowFullKey(!showFullKey)} className={styles.actionButton}>
                {showFullKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </DashboardButton>
        </Tooltip>
        <Tooltip content="Copy API Key" position="top">
            <DashboardButton variant="ghost" size="sm" onClick={handleCopyKey} className={styles.actionButton} disabled={copied}>
                {copied ? <CheckCircle size={16} className={styles.copiedIcon}/> : <Copy size={16} />}
            </DashboardButton>
        </Tooltip>
        <Tooltip content="Edit Name / Limits / Routes" position="top">
            <DashboardButton variant="ghost" size="sm" onClick={handleEdit} className={styles.actionButton}>
                <Edit3 size={16} />
            </DashboardButton>
        </Tooltip>
        <Tooltip content="Delete API Key" position="top">
            <DashboardButton 
                variant="danger" // Makes the icon red by default due to DashboardButton variant styles
                size="sm" 
                onClick={handleDelete} 
                className={`${styles.actionButton} ${styles.deleteButtonSpecial}`} // Special class for potential icon color override
                isLoading={isDeleting}
            >
                <Trash2 size={16} />
            </DashboardButton>
        </Tooltip>
      </div>
    </div>
  );
};

export default VirtualApiKeyRow;