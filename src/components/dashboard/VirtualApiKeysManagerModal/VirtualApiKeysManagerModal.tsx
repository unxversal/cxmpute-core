// src/components/dashboard/VirtualApiKeysManagerModal/VirtualApiKeysManagerModal.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import styles from './VirtualApiKeysManagerModal.module.css';
import ThemeModal from '../ThemeModal/ThemeModal';
import DashboardButton from '../DashboardButton/DashboardButton';
import VirtualApiKeyRow from '../VirtualApiKeyRow/VirtualApiKeyRow';
import CreateEditVirtualApiKeyModal from '../CreateEditVirtualApiKeyModal/CreateEditVirtualApiKeyModal';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { ApiKeyInfo } from '@/lib/interfaces';
import { PlusCircle, KeyRound, AlertTriangle, RefreshCcw, Loader } from 'lucide-react';

interface VirtualApiKeysManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const VirtualApiKeysManagerModal: React.FC<VirtualApiKeysManagerModalProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const [virtualKeys, setVirtualKeys] = useState<(ApiKeyInfo & { name?: string })[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isCreateEditModalOpen, setIsCreateEditModalOpen] = useState(false);
  const [keyToEdit, setKeyToEdit] = useState<(ApiKeyInfo & { name?: string }) | null>(null);

  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeletingKeyInProgress, setIsDeletingKeyInProgress] = useState<string | null>(null);

  const fetchVirtualKeys = useCallback(async (showLoadingToast = false) => {
    if (!userId) return;
    setIsLoadingKeys(true);
    setFetchError(null);
    let loadingToastId: string | undefined;
    if (showLoadingToast) {
        loadingToastId = notify.loading("Refreshing virtual API keys...");
    }

    try {
      const response = await fetch(`/api/user/${userId}/keys`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error from server."}));
        throw new Error(errorData.error || "Failed to fetch API keys.");
      }
      const keysData = await response.json();
      setVirtualKeys(keysData as (ApiKeyInfo & { name?: string })[]);
      if (showLoadingToast && loadingToastId) notify.success("Virtual API keys refreshed!", { id: loadingToastId });
      else if (showLoadingToast) notify.success("Virtual API keys refreshed!");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Error fetching virtual API keys:", err);
      setFetchError(err.message || "Could not load keys.");
      if (showLoadingToast && loadingToastId) notify.error(err.message || "Could not refresh keys.", { id: loadingToastId });
      else if (showLoadingToast) notify.error(err.message || "Could not refresh keys.");
    } finally {
      setIsLoadingKeys(false);
      if (loadingToastId && !showLoadingToast && !fetchError) { // Dismiss only if not handled by success/error & was toast
         notify.dismiss(loadingToastId);
      }
    }
  }, [userId, fetchError]); // Removed fetchError from deps

  useEffect(() => {
    if (isOpen) {
      fetchVirtualKeys();
    } else {
      setVirtualKeys([]);
      setIsLoadingKeys(false);
      setFetchError(null);
      setIsCreateEditModalOpen(false);
      setKeyToEdit(null);
      setKeyToDelete(null);
      setShowDeleteConfirmModal(false);
      setIsDeletingKeyInProgress(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // fetchVirtualKeys is memoized

  const handleOpenCreateModal = () => { /* ... (same) ... */ setKeyToEdit(null); setIsCreateEditModalOpen(true); };
  const handleOpenEditModal = (keyData: ApiKeyInfo & { name?: string }) => { /* ... (same) ... */ setKeyToEdit(keyData); setIsCreateEditModalOpen(true);};
  const handleKeySaved = () => { /* ... (same, ensure fetchVirtualKeys(true)) ... */ fetchVirtualKeys(true); setIsCreateEditModalOpen(false); setKeyToEdit(null);};
  const handleInitiateDelete = (keyString: string) => { /* ... (same) ... */ setKeyToDelete(keyString); setShowDeleteConfirmModal(true);};
  const confirmDeleteKey = async () => { /* ... (same, ensure fetchVirtualKeys() or fetchVirtualKeys(true)) ... */
    if (!keyToDelete) return;
    setIsDeletingKeyInProgress(keyToDelete);
    setShowDeleteConfirmModal(false);
    const loadingToastId = notify.loading(`Deleting API key ...${keyToDelete.slice(-4)}`);
    try {
      const response = await fetch(`/api/user/${userId}/keys/${keyToDelete}`, { method: 'DELETE' });
      notify.dismiss(loadingToastId); // Dismiss early
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to delete API key.");
      notify.success("API Key deleted successfully!");
      fetchVirtualKeys(false); // Refresh list silently after delete
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      notify.dismiss(loadingToastId); // Ensure dismissed on error
      console.error("Error deleting API key:", err);
      notify.error(err.message || "Could not delete key.");
    } finally {
      setKeyToDelete(null);
      setIsDeletingKeyInProgress(null);
    }
  };
  const cancelDeleteKey = () => { /* ... (same) ... */ setKeyToDelete(null); setShowDeleteConfirmModal(false);};

  const modalTitle = (
    <span className={styles.modalTitleCustom}>
        <KeyRound size={24} className={styles.titleIcon} /> Manage Virtual API Keys
    </span>
  );
  
  const managerModalFooter = (
    <DashboardButton variant="secondary" onClick={onClose} text="Done" />
  );

  return (
    <>
      <ThemeModal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={modalTitle as unknown as string} 
        size="xl" 
        footerContent={managerModalFooter}
        className={styles.managerModalContentBox}
      >
        <div className={styles.managerContent}>
          <div className={styles.headerActions}>
            <div className={styles.headerInfo}>
                <KeyRound size={18} className={styles.infoIcon}/>
                <p>Create and manage virtual API keys with specific credit limits and route permissions for your applications.</p>
            </div>
            <div className={styles.headerButtons}>
                <DashboardButton
                    variant="ghost" size="sm"
                    onClick={() => fetchVirtualKeys(true)} // explicit toast on manual refresh
                    isLoading={isLoadingKeys && virtualKeys.length > 0}
                    disabled={isLoadingKeys}
                    iconLeft={isLoadingKeys && virtualKeys.length > 0 ? <Loader size={14} className={styles.spinningIconSmall} /> : <RefreshCcw size={14}/>}
                    text={isLoadingKeys && virtualKeys.length > 0 ? "Refreshing..." : "Refresh"}
                />
                <DashboardButton
                    variant="primary" size="sm"
                    onClick={handleOpenCreateModal}
                    iconLeft={<PlusCircle size={16}/>}
                    text="Create New Key"
                    disabled={isLoadingKeys}
                />
            </div>
          </div>

          {isLoadingKeys && virtualKeys.length === 0 ? ( // Initial loading state for the whole list
            <div className={styles.listLoadingContainer}>
              <Loader size={32} className={styles.spinningIcon} />
              <p>Loading Virtual API Keys...</p>
            </div>
          ) : !isLoadingKeys && fetchError ? (
            <div className={styles.messageContainer}>
              <AlertTriangle size={32} className={styles.errorIcon}/>
              <p className={styles.fetchErrorText}>{fetchError}</p>
              <DashboardButton onClick={() => fetchVirtualKeys(true)} variant="secondary" size="sm" text="Try Again"/>
            </div>
          ) : !isLoadingKeys && !fetchError && virtualKeys.length === 0 ? (
            <div className={styles.messageContainer}>
              <KeyRound size={32} className={styles.emptyIcon}/>
              <p>You haven&apos;t created any virtual API keys yet.</p>
              <DashboardButton onClick={handleOpenCreateModal} variant="primary" text="Create Your First Key"/>
            </div>
          ) : ( // Data loaded, or error but some data exists
            <div className={styles.keysList}>
              {virtualKeys.map(apiKey => (
                <VirtualApiKeyRow
                  key={apiKey.key}
                  apiKeyData={apiKey}
                  onDelete={() => handleInitiateDelete(apiKey.key)}
                  onEdit={handleOpenEditModal}
                  isDeleting={isDeletingKeyInProgress === apiKey.key}
                />
              ))}
            </div>
          )}
        </div>
      </ThemeModal>

      {isCreateEditModalOpen && ( /* ... (CreateEditModal instance same as before) ... */ 
        <CreateEditVirtualApiKeyModal
          isOpen={isCreateEditModalOpen}
          onClose={() => setIsCreateEditModalOpen(false)}
          userId={userId}
          existingKeyData={keyToEdit || undefined}
          onKeySaved={handleKeySaved}
        />
      )}

      {showDeleteConfirmModal && keyToDelete && ( /* ... (Delete Confirm Modal instance same as before) ... */
        <ThemeModal
          isOpen={showDeleteConfirmModal}
          onClose={cancelDeleteKey}
          title={ <span className={styles.modalTitleCustom}><AlertTriangle size={24} className={styles.titleIconDelete}/> Confirm Delete</span> as unknown as string }
          size="sm"
          footerContent={
            <>
                <DashboardButton variant="secondary" onClick={cancelDeleteKey} disabled={!!isDeletingKeyInProgress} text="Cancel"/>
                <DashboardButton variant="danger" onClick={confirmDeleteKey} isLoading={!!isDeletingKeyInProgress} disabled={!!isDeletingKeyInProgress} text="Yes, Delete Key"/>
            </>
          }
        >
          <div className={styles.deleteConfirmContent}>
            <p className={styles.confirmDeleteText}>
                Are you sure you want to delete the API key 
                {virtualKeys.find(k => k.key === keyToDelete)?.name 
                    ? ` named "${virtualKeys.find(k => k.key === keyToDelete)?.name}" ` 
                    : ` ending in `} 
                (<code>...{keyToDelete.slice(-4)}</code>)?
            </p>
            <p className={styles.confirmDeleteWarning}>This action cannot be undone and will immediately revoke access for this key.</p>
          </div>
        </ThemeModal>
      )}
    </>
  );
};

export default VirtualApiKeysManagerModal;