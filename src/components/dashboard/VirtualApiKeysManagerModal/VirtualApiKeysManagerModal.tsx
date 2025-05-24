/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/dashboard/VirtualApiKeysManagerModal/VirtualApiKeysManagerModal.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import styles from './VirtualApiKeysManagerModal.module.css';
import ThemeModal from '../ThemeModal/ThemeModal'; // Updated import
import DashboardButton from '../DashboardButton/DashboardButton'; // Updated import
import VirtualApiKeyRow from '../VirtualApiKeyRow/VirtualApiKeyRow'; // Uses revised row
import CreateEditVirtualApiKeyModal from '../CreateEditVirtualApiKeyModal/CreateEditVirtualApiKeyModal'; // Uses revised create/edit modal
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { ApiKeyInfo } from '@/lib/interfaces';
import { PlusCircle, KeyRound, AlertTriangle, RefreshCcw } from 'lucide-react';
// Import a light-themed skeleton loader if you create one, or adjust ui/SkeletonLoader for light theme
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader'; // Assuming this can be themed or is neutral

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
    } catch (err: any) {
      console.error("Error fetching virtual API keys:", err);
      setFetchError(err.message || "Could not load keys.");
      if (showLoadingToast && loadingToastId) notify.error(err.message || "Could not refresh keys.", { id: loadingToastId });
      else if (showLoadingToast) notify.error(err.message || "Could not refresh keys.");
    } finally {
      setIsLoadingKeys(false);
      if (loadingToastId && !showLoadingToast) notify.dismiss(loadingToastId); // Dismiss only if not handled by success/error
    }
  }, [userId]);

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
  }, [isOpen, fetchVirtualKeys]);

  const handleOpenCreateModal = () => {
    setKeyToEdit(null);
    setIsCreateEditModalOpen(true);
  };

  const handleOpenEditModal = (keyData: ApiKeyInfo & { name?: string }) => {
    setKeyToEdit(keyData);
    setIsCreateEditModalOpen(true);
  };

  const handleKeySaved = () => {
    fetchVirtualKeys(true); // Show toast on save
    setIsCreateEditModalOpen(false);
    setKeyToEdit(null);
  };

  const handleInitiateDelete = (keyString: string) => {
    setKeyToDelete(keyString);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteKey = async () => {
    if (!keyToDelete) return;
    setIsDeletingKeyInProgress(keyToDelete);
    setShowDeleteConfirmModal(false);
    const loadingToastId = notify.loading(`Deleting API key ...${keyToDelete.slice(-4)}`);

    try {
      const response = await fetch(`/api/user/${userId}/keys/${keyToDelete}`, { method: 'DELETE' });
      notify.dismiss(loadingToastId);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to delete API key.");
      notify.success("API Key deleted successfully!");
      fetchVirtualKeys();
    } catch (err: any) {
      notify.dismiss(loadingToastId);
      console.error("Error deleting API key:", err);
      notify.error(err.message || "Could not delete key.");
    } finally {
      setKeyToDelete(null);
      setIsDeletingKeyInProgress(null);
    }
  };
  
  const cancelDeleteKey = () => {
    setKeyToDelete(null);
    setShowDeleteConfirmModal(false);
  };

  const modalTitle = (
    <span className={styles.modalTitleCustom}>
        <KeyRound size={24} className={styles.titleIcon} /> Manage Virtual API Keys
    </span>
  );
  
  const managerModalFooter = (
    <DashboardButton variant="secondary" onClick={onClose}>
        Done
    </DashboardButton>
  );

  return (
    <>
      <ThemeModal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={modalTitle as unknown as string} 
        size="xl" 
        footerContent={managerModalFooter}
        className={styles.managerModalContentBox} // Custom class for ThemeModal's content box
      >
        <div className={styles.managerContent}>
          <div className={styles.headerActions}>
            <div className={styles.headerInfo}>
                <KeyRound size={18} className={styles.infoIcon}/>
                <p>Create and manage virtual API keys with specific credit limits and route permissions for your applications.</p>
            </div>
            <div className={styles.headerButtons}>
                <DashboardButton
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchVirtualKeys(true)}
                    isLoading={isLoadingKeys && virtualKeys.length > 0}
                    disabled={isLoadingKeys}
                    iconLeft={<RefreshCcw size={14}/>}
                    text="Refresh"
                />
                <DashboardButton
                    variant="primary" // Green
                    size="sm"
                    onClick={handleOpenCreateModal}
                    iconLeft={<PlusCircle size={16}/>}
                    text="Create New Key"
                    disabled={isLoadingKeys}
                />
            </div>
          </div>

          {isLoadingKeys && virtualKeys.length === 0 && (
            <div className={styles.skeletonContainer}>
              {Array.from({ length: 3 }).map((_, i) => (
                 <div key={`skel-manage-${i}`} className={styles.keyRowContainerSkeleton}>
                    <div className={styles.keyIconAreaSkeleton}><SkeletonLoader type="circle" width={30} height={30}/></div>
                    <div className={styles.keyDetailsSkeleton}><SkeletonLoader count={2} height="18px"/></div>
                    <div className={styles.keyActionsSkeleton}>
                        <SkeletonLoader width={30} height={28} style={{marginRight: '5px'}}/>
                        <SkeletonLoader width={30} height={28} style={{marginRight: '5px'}}/>
                        <SkeletonLoader width={30} height={28} />
                    </div>
                </div>
              ))}
            </div>
          )}

          {!isLoadingKeys && fetchError && (
            <div className={styles.messageContainer}>
              <AlertTriangle size={32} className={styles.errorIcon}/>
              <p className={styles.fetchErrorText}>{fetchError}</p>
              <DashboardButton onClick={() => fetchVirtualKeys(true)} variant="secondary" size="sm" text="Try Again"/>
            </div>
          )}

          {!isLoadingKeys && !fetchError && virtualKeys.length === 0 && (
            <div className={styles.messageContainer}>
              <KeyRound size={32} className={styles.emptyIcon}/>
              <p>You haven&apos;t created any virtual API keys yet.</p>
              <DashboardButton onClick={handleOpenCreateModal} variant="primary" text="Create Your First Key"/>
            </div>
          )}

          {!isLoadingKeys && !fetchError && virtualKeys.length > 0 && (
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

      {isCreateEditModalOpen && (
        <CreateEditVirtualApiKeyModal
          isOpen={isCreateEditModalOpen}
          onClose={() => setIsCreateEditModalOpen(false)}
          userId={userId}
          existingKeyData={keyToEdit || undefined}
          onKeySaved={handleKeySaved}
        />
      )}

      {showDeleteConfirmModal && keyToDelete && (
        <ThemeModal // Using ThemeModal for delete confirmation
          isOpen={showDeleteConfirmModal}
          onClose={cancelDeleteKey}
          title={
            <span className={styles.modalTitleCustom}>
                <AlertTriangle size={24} className={styles.titleIconDelete}/> Confirm Delete
            </span> as unknown as string
          }
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