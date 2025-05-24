// src/components/dashboard/ViewApiKeyModal/ViewApiKeyModal.tsx
"use client";

import React, { useState, useEffect } from 'react';
import styles from './ViewApiKey.module.css';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import { Eye, EyeOff, Copy, RefreshCcw, AlertTriangle } from 'lucide-react';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
import Tooltip from '@/components/ui/Tooltip/Tooltip';

export type ApiKeyType = "User AK" | "Provider AK" | "Trader AK";

interface ViewApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeyType: ApiKeyType;
  currentApiKey: string | null; // Null if initially loading or not set
  onRefresh: () => Promise<string | null>; // Returns new key or null on error
  isLoadingRefresh: boolean; // Parent component manages loading state for refresh
  isApiKeyLoading?: boolean; // Optional: if the key itself is being fetched when modal opens
}

const ViewApiKeyModal: React.FC<ViewApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKeyType,
  currentApiKey,
  onRefresh,
  isLoadingRefresh,
  isApiKeyLoading = false, // Default to false
}) => {
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset visibility when modal opens or key changes
  useEffect(() => {
    if (isOpen) {
      setIsKeyVisible(false);
      setCopied(false);
    }
  }, [isOpen, currentApiKey]);

  const handleCopyToClipboard = () => {
    if (currentApiKey) {
      navigator.clipboard.writeText(currentApiKey)
        .then(() => {
          setCopied(true);
          notify.success(`${apiKeyType} copied to clipboard!`);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => {
          console.error("Failed to copy API key:", err);
          notify.error("Failed to copy key.");
        });
    }
  };

  const handleRefreshKey = async () => {
    const newKey = await onRefresh(); // Parent handles API call and updates its state
    if (newKey) {
      notify.success(`${apiKeyType} has been refreshed successfully!`);
      // The currentApiKey prop will update via parent, triggering re-render
    } else {
      // Error notification should be handled by the parent component's onRefresh logic
      // Or, we can add a generic one here if onRefresh doesn't always notify
      // notify.error(`Failed to refresh ${apiKeyType}.`);
    }
  };

  const displayApiKey = currentApiKey
    ? isKeyVisible ? currentApiKey : `${currentApiKey.substring(0, 4)}••••••••••••••••••••••••${currentApiKey.substring(currentApiKey.length - 4)}`
    : 'Not available';

  const modalTitle = `View Your ${apiKeyType}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="md">
      <div className={styles.modalContent}>
        {isApiKeyLoading ? (
          <div className={styles.apiKeyDisplayArea}>
            <SkeletonLoader width="100%" height="40px" />
          </div>
        ) : !currentApiKey ? (
          <div className={`${styles.notice} ${styles.errorNotice}`}>
            <AlertTriangle size={18} /> Key not available or not yet generated.
          </div>
        ) : (
          <>
            <p className={styles.description}>
              This is your <strong>{apiKeyType}</strong>. Keep it secure and do not share it publicly.
              {apiKeyType === "Trader AK" && " This key is used to authenticate with the DEX API and WebSocket services."}
              {apiKeyType === "User AK" && " This key is used for general platform API access."}
              {apiKeyType === "Provider AK" && " This key is used by your provider nodes to connect to the Cxmpute network."}
            </p>

            <div className={styles.apiKeyDisplayArea}>
              <span className={`${styles.apiKeyText} ${!isKeyVisible ? styles.masked : ''}`}>
                {displayApiKey}
              </span>
              <div className={styles.keyActions}>
                <Tooltip content={isKeyVisible ? "Hide key" : "Show key"} position="top">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setIsKeyVisible(!isKeyVisible)}
                    aria-label={isKeyVisible ? "Hide API key" : "Show API key"}
                    className={styles.iconButton}
                  >
                    {isKeyVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </Tooltip>
                <Tooltip content={copied ? "Copied!" : "Copy to clipboard"} position="top">
                  <Button
                    variant="ghost" size="sm"
                    onClick={handleCopyToClipboard}
                    disabled={!currentApiKey}
                    aria-label="Copy API key to clipboard"
                    className={styles.iconButton}
                  >
                    <Copy size={18} />
                  </Button>
                </Tooltip>
              </div>
            </div>
            <div className={styles.warningText}>
              <AlertTriangle size={16} />
              Refreshing this key will invalidate the current one immediately. Update any applications or services using the old key.
            </div>
          </>
        )}
        
        <div className={styles.modalFooterActions}>
          <Button variant="secondary" onClick={onClose} disabled={isLoadingRefresh}>
            Close
          </Button>
          {currentApiKey && ( // Only show refresh if a key exists
             <Button
                variant="danger"
                onClick={handleRefreshKey}
                isLoading={isLoadingRefresh}
                disabled={isLoadingRefresh || isApiKeyLoading || !currentApiKey}
                iconLeft={<RefreshCcw size={16}/>}
              >
                Refresh {apiKeyType}
             </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ViewApiKeyModal;