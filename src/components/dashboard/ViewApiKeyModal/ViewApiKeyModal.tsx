// src/components/dashboard/ViewApiKeyModal/ViewApiKeyModal.tsx
"use client";

import React, { useState, useEffect } from 'react';
import styles from './ViewApiKeyModal.module.css';
import ThemeModal from '../ThemeModal/ThemeModal'; // Updated import
import DashboardButton from '../DashboardButton/DashboardButton'; // Updated import
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster'; // Assuming this is still desired
import { Copy, RefreshCcw, Eye, EyeOff, KeyRound } from 'lucide-react';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader'; // Keep for loading state

export type ApiKeyType = "User AK" | "Provider AK" | "Trader AK";

interface ViewApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeyType: ApiKeyType;
  currentApiKey: string | null;
  onRefresh: () => Promise<void>;
  isLoadingRefresh: boolean;
  isLoadingKey?: boolean;
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
      setShowKey(false);
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
    setShowKey(false); // Optionally hide key again after refresh for security
  };

  const modalTitle = (
    <span className={styles.modalTitleCustom}>
      <KeyRound size={24} className={styles.titleIcon} /> View Your {apiKeyType}
    </span>
  );

  const footerContent = (
    <>
      <DashboardButton
        variant="secondary" // e.g., Slate background
        onClick={onClose}
        disabled={isLoadingRefresh}
        size="md"
      >
        Close
      </DashboardButton>
      <DashboardButton
        variant="danger" // Cxmpute Red for refresh
        onClick={handleRefreshClick}
        isLoading={isLoadingRefresh}
        disabled={isLoadingRefresh || isLoadingKey || !currentApiKey}
        iconLeft={<RefreshCcw size={16}/>}
        size="md"
        text="Refresh Key" // Using text prop
      />
    </>
  );

  return (
    <ThemeModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={modalTitle as unknown as string} // Cast if ThemeModal expects string only
      size="md" 
      footerContent={footerContent}
    >
      <div className={styles.modalContentWrapper}>
        {isLoadingKey && !currentApiKey ? (
          <div className={styles.loadingContainer}>
            {/* Use a light-themed skeleton or spinner if preferred */}
            <SkeletonLoader type="text" count={2} height="20px" />
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
              <pre className={styles.apiKeyTextValue}> {/* Renamed class for clarity */}
                {maskApiKey(currentApiKey, showKey)}
              </pre>
              <div className={styles.keyActions}>
                <DashboardButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKey(!showKey)}
                  className={styles.actionButton}
                  title={showKey ? "Hide key" : "Show key"}
                  iconLeft={showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                />
                <DashboardButton
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!currentApiKey || copied}
                  className={styles.actionButton}
                  title="Copy key"
                  iconLeft={<Copy size={16}/>}
                >
                  {copied ? 'Copied!' : null}
                </DashboardButton>
              </div>
            </div>
          </>
        )}
      </div>
    </ThemeModal>
  );
};

export default ViewApiKeyModal;