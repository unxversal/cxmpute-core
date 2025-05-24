// src/components/dashboard/VirtualApiKeyRow/VirtualApiKeyRow.tsx
"use client";

import React, { useState } from 'react';
import styles from './VirtualApiKeyRow.module.css';
import type { ApiKeyInfo } from '@/lib/interfaces';
import Button from '@/components/ui/Button/Button';
import Tooltip from '@/components/ui/Tooltip/Tooltip';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import { Copy, Edit3, Trash2, Eye, EyeOff, ListChecks, DollarSign, CheckCircle } from 'lucide-react';

interface VirtualApiKeyRowProps {
  apiKeyData: ApiKeyInfo & { name?: string }; // Assuming name is now part of ApiKeyInfo
  onDelete: (keyString: string) => void;
  onEdit: (keyData: ApiKeyInfo & { name?: string }) => void;
  isDeleting?: boolean; // To show loading state on delete button if parent handles it
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
    // Confirmation can be handled in the parent modal (VirtualApiKeysManagerModal)
    // or by adding another confirmation step here if preferred.
    // For now, directly call onDelete passed from parent.
    onDelete(apiKeyData.key);
  };

  const handleEdit = () => {
    onEdit(apiKeyData);
  };
  
  const permittedRoutesSummary = apiKeyData.permittedRoutes.length > 2
    ? `${apiKeyData.permittedRoutes.slice(0, 2).map(r => r.split('/').pop()).join(', ')} +${apiKeyData.permittedRoutes.length - 2} more`
    : apiKeyData.permittedRoutes.map(r => r.split('/').pop()).join(', ') || 'None';

  return (
    <div className={styles.keyRowContainer}>
      <div className={styles.keyDetails}>
        <div className={styles.keyNameAndString}>
            <span className={styles.keyName} title={apiKeyData.name || 'Unnamed Key'}>
                {apiKeyData.name || `Key: ${maskApiKeyString(apiKeyData.key, false).substring(0,12)}...`}
            </span>
            {!apiKeyData.name && (
                <span className={styles.fullKeyStringSmall} title={apiKeyData.key}>
                    ({maskApiKeyString(apiKeyData.key, showFullKey)})
                </span>
            )}
            {apiKeyData.name && (
                 <span className={styles.fullKeyStringSmall} title={apiKeyData.key}>
                    ({maskApiKeyString(apiKeyData.key, showFullKey)})
                </span>
            )}
        </div>

        <div className={styles.keyMetaGrid}>
            <div className={styles.metaItem}>
                <DollarSign size={14} className={styles.metaIcon} />
                <Tooltip content={`Credits Left: ${apiKeyData.creditsLeft.toLocaleString()} / Limit: ${apiKeyData.creditLimit.toLocaleString()}`} position="top">
                    <span className={styles.metaText}>
                        {apiKeyData.creditsLeft.toLocaleString()} / {apiKeyData.creditLimit.toLocaleString()} Credits
                    </span>
                </Tooltip>
            </div>

            <div className={styles.metaItem}>
                <ListChecks size={14} className={styles.metaIcon} />
                 <Tooltip 
                    content={
                        <ul className={styles.tooltipRouteList}>
                            {apiKeyData.permittedRoutes.map(r => <li key={r}>{r}</li>)}
                            {apiKeyData.permittedRoutes.length === 0 && <li>No routes permitted.</li>}
                        </ul>
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
            <Button variant="ghost" size="sm" onClick={() => setShowFullKey(!showFullKey)} className={styles.iconButton}>
            {showFullKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
        </Tooltip>
        <Tooltip content="Copy API Key" position="top">
            <Button variant="ghost" size="sm" onClick={handleCopyKey} className={styles.iconButton} disabled={copied}>
            {copied ? <CheckCircle size={16} color="var(--cxmpute-green)" /> : <Copy size={16} />}
            </Button>
        </Tooltip>
        <Tooltip content="Edit Key Name/Limits/Routes" position="top">
            <Button variant="ghost" size="sm" onClick={handleEdit} className={styles.iconButton}>
            <Edit3 size={16} />
            </Button>
        </Tooltip>
        <Tooltip content="Delete API Key" position="top">
            <Button variant="danger" size="sm" onClick={handleDelete} className={styles.iconButton} isLoading={isDeleting}>
            <Trash2 size={16} />
            </Button>
        </Tooltip>
      </div>
    </div>
  );
};

export default VirtualApiKeyRow;