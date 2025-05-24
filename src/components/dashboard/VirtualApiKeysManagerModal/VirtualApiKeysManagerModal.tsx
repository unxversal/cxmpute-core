// src/components/dashboard/VirtualApiKeysManagerModal/VirtualApiKeysManagerModal.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import styles from './VirtualApiKeysManagerModal.module.css';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import VirtualApiKeyRow from '../VirtualApiKeyRow/VirtualApiKeyRow';
import CreateEditVirtualApiKeyModal from '../CreateEditVirtualApiKeyModal/CreateEditVirtualApiKeyModal';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { ApiKeyInfo } from '@/lib/interfaces';
import { PlusCircle, KeyRound, AlertTriangle, RefreshCcw } from 'lucide-react';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';

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
  const [isDeletingKey, setIsDeletingKey] = useState<string | null>(null); // Store the key string being deleted

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
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch API keys.");
      }
      const keysData = await response.json();
      setVirtualKeys(keysData as (ApiKeyInfo & { name?: string })[]);
      if (showLoadingToast) notify.success("Virtual API keys refreshed!");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Error fetching virtual API keys:", err);
      setFetchError(err.message || "Could not load keys.");
      if (showLoadingToast) notify.error(err.message || "Could not refresh keys.");
    } finally {
      setIsLoadingKeys(false);
      if (loadingToastId) notify.dismiss(loadingToastId);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      fetchVirtualKeys();
    } else {
      // Reset state when modal is closed
      setVirtualKeys([]);
      setIsLoadingKeys(false);
      setFetchError(null);
      setIsCreateEditModalOpen(false);
      setKeyToEdit(null);
      setKeyToDelete(null);
      setShowDeleteConfirmModal(false);
      setIsDeletingKey(null);
    }
  }, [isOpen, fetchVirtualKeys]);

  const handleOpenCreateModal = () => {
    setKeyToEdit(null); // Ensure edit mode is off
    setIsCreateEditModalOpen(true);
  };

  const handleOpenEditModal = (keyData: ApiKeyInfo & { name?: string }) => {
    setKeyToEdit(keyData);
    setIsCreateEditModalOpen(true);
  };

  const handleKeySaved = () => {
    fetchVirtualKeys(); // Refresh the list after a key is created or edited
    setIsCreateEditModalOpen(false); // Close the create/edit modal
  };

  const handleInitiateDelete = (keyString: string) => {
    setKeyToDelete(keyString);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteKey = async () => {
    if (!keyToDelete) return;

    setIsDeletingKey(keyToDelete); // Set loading state for the specific key being deleted
    setShowDeleteConfirmModal(false);
    const loadingToastId = notify.loading(`Deleting API key ${keyToDelete.substring(0,4)}...`);

    try {
      const response = await fetch(`/api/user/${userId}/keys/${keyToDelete}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to delete API key.");
      }
      notify.success("API Key deleted successfully!");
      fetchVirtualKeys(); // Refresh list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Error deleting API key:", err);
      notify.error(err.message || "Could not delete key.");
    } finally {
      setKeyToDelete(null);
      setIsDeletingKey(null); // Clear loading state
      notify.dismiss(loadingToastId);
    }
  };

  const cancelDeleteKey = () => {
    setKeyToDelete(null);
    setShowDeleteConfirmModal(false);
  };
  

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Manage Your Virtual API Keys" size="xl">
        <div className={styles.managerContent}>
          <div className={styles.headerActions}>
            <div className={styles.headerInfo}>
                <KeyRound size={20} />
                <p>Virtual API keys allow you to set specific credit limits and route permissions for different applications or use cases.</p>
            </div>
            <div className={styles.headerButtons}>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchVirtualKeys(true)}
                    isLoading={isLoadingKeys && virtualKeys.length > 0} // Show spinner if refreshing non-empty list
                    disabled={isLoadingKeys}
                    iconLeft={<RefreshCcw size={14}/>}
                >
                    Refresh List
                </Button>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleOpenCreateModal}
                    iconLeft={<PlusCircle size={16}/>}
                    disabled={isLoadingKeys}
                >
                    Create New Virtual Key
                </Button>
            </div>
          </div>

          {isLoadingKeys && virtualKeys.length === 0 && (
            <div className={styles.skeletonContainer}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`skel-${i}`} className={styles.keyRowContainerSkeleton}>
                    <div className={styles.keyDetailsSkeleton}><SkeletonLoader count={2} /></div>
                    <div className={styles.keyActionsSkeleton}><SkeletonLoader count={1} width={100} height={24}/></div>
                </div>
              ))}
            </div>
          )}

          {!isLoadingKeys && fetchError && (
            <div className={styles.errorMessageContainer}>
              <AlertTriangle size={24} />
              <p>{fetchError}</p>
              <Button onClick={() => fetchVirtualKeys(true)} variant="secondary" size="sm">Try Again</Button>
            </div>
          )}

          {!isLoadingKeys && !fetchError && virtualKeys.length === 0 && (
            <div className={styles.emptyStateContainer}>
              <p>You haven&apos;t created any virtual API keys yet.</p>
              <Button onClick={handleOpenCreateModal} variant="primary">Create Your First Key</Button>
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
                  isDeleting={isDeletingKey === apiKey.key}
                />
              ))}
            </div>
          )}
        </div>
      </Modal>

      {isCreateEditModalOpen && (
        <CreateEditVirtualApiKeyModal
          isOpen={isCreateEditModalOpen}
          onClose={() => setIsCreateEditModalOpen(false)}
          userId={userId}
          existingKeyData={keyToEdit || undefined} // Pass undefined if keyToEdit is null
          onKeySaved={handleKeySaved}
        />
      )}

      {showDeleteConfirmModal && keyToDelete && (
        <Modal
          isOpen={showDeleteConfirmModal}
          onClose={cancelDeleteKey}
          title="Confirm Delete API Key"
          size="sm"
        >
          <p className={styles.confirmDeleteText}>
            Are you sure you want to delete the API key ending in `...{keyToDelete.slice(-4)}`?
            {virtualKeys.find(k => k.key === keyToDelete)?.name ? ` (Name: ${virtualKeys.find(k => k.key === keyToDelete)?.name})` : ''}
          </p>
          <p className={styles.confirmDeleteWarning}>This action cannot be undone.</p>
          <div className={styles.deleteModalFooter}>
            <Button variant="outline" onClick={cancelDeleteKey} disabled={!!isDeletingKey}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteKey} isLoading={!!isDeletingKey} disabled={!!isDeletingKey}>
              Yes, Delete Key
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default VirtualApiKeysManagerModal;