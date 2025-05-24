// src/components/dashboard/ViewApiKeyModal/ViewApiKeyModal.tsx
"use client";

import React, { useState, useEffect } from 'react';
import styles from './ViewApiKeyModal.module.css';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import { Copy, RefreshCcw, Eye, EyeOff } from 'lucide-react';

export type ApiKeyType = "User AK" | "Provider AK" | "Trader AK";

interface ViewApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeyType: ApiKeyType;
  currentApiKey: string | null; // Can be null if not yet fetched or error
  onRefresh: () => Promise<void>;
  isLoadingRefresh: boolean;
  isLoadingKey?: boolean; // Optional: if the key itself is being fetched
}

const maskApiKey = (key: string | null, showKey: boolean): string => {
  if (!key) return 'N/A';
  if (showKey) return key;
  if (key.length <= 8) return '****'.padEnd(key.length, '*');
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

const ViewApiKeyModal: React.FC<ViewApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKeyType,
  currentApiKey,
  onRefresh,
  isLoadingRefresh,
  isLoadingKey = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setShowKey(false); // Reset visibility when modal closes
    }
  }, [isOpen]);

  const handleCopy = () => {
    if (currentApiKey) {
      navigator.clipboard.writeText(currentApiKey)
        .then(() => {
          setCopied(true);
          notify.success(`${apiKeyType} copied to clipboard!`);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => {
          console.error('Failed to copy API key:', err);
          notify.error('Failed to copy key.');
        });
    }
  };

  const handleRefreshClick = async () => {
    await onRefresh();
    // Optionally, you might want to auto-hide the key again after refresh
    // setShowKey(false); 
  };

  const modalTitle = `View Your ${apiKeyType}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="md">
      <div className={styles.modalContentWrapper}>
        {isLoadingKey && !currentApiKey ? (
          <div className={styles.loadingContainer}>
            <p>Loading API Key...</p>
          </div>
        ) : !currentApiKey && !isLoadingKey ? (
           <div className={styles.errorContainer}>
            <p>API Key not available or failed to load.</p>
          </div>
        ) : (
          <>
            <p className={styles.infoText}>
              This is your primary {apiKeyType}. Keep it secure and do not share it publicly.
              If you suspect it has been compromised, refresh it immediately.
            </p>
            <div className={styles.apiKeyDisplayContainer}>
              <pre className={styles.apiKeyText}>
                {maskApiKey(currentApiKey, showKey)}
              </pre>
              <div className={styles.keyActions}>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowKey(!showKey)}
                    className={styles.actionButton}
                    title={showKey ? "Hide key" : "Show key"}
                    iconLeft={showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                >
                    {showKey ? 'Hide' : 'Show'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!currentApiKey || copied}
                  className={styles.actionButton}
                  title="Copy key"
                  iconLeft={<Copy size={16}/>}
                >
                  {copied ? 'Copied!' : ''}
                </Button>
              </div>
            </div>
          </>
        )}

        <div className={styles.modalFooterActions}>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoadingRefresh}
            size="md"
          >
            Close
          </Button>
          <Button
            variant="danger"
            onClick={handleRefreshClick}
            isLoading={isLoadingRefresh}
            disabled={isLoadingRefresh || isLoadingKey || !currentApiKey}
            iconLeft={<RefreshCcw size={16}/>}
            size="md"
          >
            Refresh Key
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ViewApiKeyModal;