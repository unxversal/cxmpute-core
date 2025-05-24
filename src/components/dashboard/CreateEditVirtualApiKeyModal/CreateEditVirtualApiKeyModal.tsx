// src/components/dashboard/CreateEditVirtualApiKeyModal/CreateEditVirtualApiKeyModal.tsx
"use client";

import React, { useState, useEffect, FormEvent } from 'react';
import styles from './CreateEditVirtualApiKeyModal.module.css';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { ApiKeyInfo } from '@/lib/interfaces'; // Assuming ApiKeyInfo might include 'name'
import { KeyRound, ShieldCheck, DollarSign, ListChecks, AlertTriangle } from 'lucide-react';

// Available routes for selection - consider moving to a shared constants file (e.g., src/lib/references.ts)
const AVAILABLE_ROUTES = [
  "/api/v1/chat/completions",
  "/api/v1/embeddings",
  "/api/v1/tts",
  "/api/v1/scrape",
];


interface CreateEditVirtualApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  existingKeyData?: ApiKeyInfo & { name?: string }; // Add name here
  onKeySaved: () => void; // Callback to refresh parent list
}

const CreateEditVirtualApiKeyModal: React.FC<CreateEditVirtualApiKeyModalProps> = ({
  isOpen,
  onClose,
  userId,
  existingKeyData,
  onKeySaved,
}) => {
  const isEditMode = !!existingKeyData;
  const [keyName, setKeyName] = useState('');
  const [creditLimit, setCreditLimit] = useState('10000'); // Default for new keys
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>(['/api/v1/chat/completions']); // Default for new keys
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && existingKeyData) {
        setKeyName(existingKeyData.name || '');
        setCreditLimit(existingKeyData.creditLimit.toString());
        setSelectedRoutes(existingKeyData.permittedRoutes || []);
      } else {
        // Reset for create mode
        setKeyName('');
        setCreditLimit('10000');
        setSelectedRoutes(['/api/v1/chat/completions']);
      }
      setFormError(null);
    }
  }, [isOpen, isEditMode, existingKeyData]);

  const handleRouteToggle = (route: string) => {
    setSelectedRoutes(prev =>
      prev.includes(route) ? prev.filter(r => r !== route) : [...prev, route]
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const limitNum = parseInt(creditLimit, 10);
    if (isNaN(limitNum) || limitNum <= 0) {
      setFormError("Credit limit must be a positive number.");
      return;
    }
    if (selectedRoutes.length === 0) {
      setFormError("At least one route must be permitted.");
      return;
    }
    if (keyName.trim().length > 50) {
        setFormError("Key name cannot exceed 50 characters.");
        return;
    }


    setIsLoading(true);
    const payload = {
      name: keyName.trim() || undefined, // Send undefined if empty, backend can decide to store null or empty string
      creditLimit: limitNum,
      permittedRoutes: selectedRoutes,
    };

    const apiUrl = isEditMode
      ? `/api/user/${userId}/keys/${existingKeyData?.key}`
      : `/api/user/${userId}/keys`;
    const method = isEditMode ? 'PUT' : 'POST'; // Assuming PUT for update

    try {
      const response = await fetch(apiUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to ${isEditMode ? 'update' : 'create'} API key.`);
      }

      notify.success(`API Key ${isEditMode ? 'metadata updated' : 'created'} successfully!`);
      onKeySaved(); // Trigger refresh in parent
      onClose();    // Close modal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} API key:`, err);
      setFormError(err.message || 'An unexpected error occurred.');
      notify.error(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const modalTitle = isEditMode ? "Edit API Key Metadata" : "Create New Virtual API Key";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg">
      <form onSubmit={handleSubmit} className={styles.form}>
        {isEditMode && existingKeyData && (
          <div className={styles.keyInfoDisplay}>
            <KeyRound size={18} />
            <strong>Key:</strong> <span>{existingKeyData.key.substring(0,8)}... (Cannot be changed)</span>
          </div>
        )}

        <div className={styles.formGroup}>
          <label htmlFor="keyName">Key Name / Label (Optional)</label>
          <input
            type="text"
            id="keyName"
            className={styles.inputField}
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="e.g., My Web App Key, Testing Key"
            maxLength={50}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="creditLimit"><DollarSign size={16}/> Credit Limit</label>
          <input
            type="number"
            id="creditLimit"
            className={styles.inputField}
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            min="1"
            required
          />
          <p className={styles.inputHint}>Max credits this key can use. This will be deducted from your main user credits.</p>
        </div>

        <div className={styles.formGroup}>
          <label><ListChecks size={16}/> Permitted API Routes</label>
          <div className={styles.routesGrid}>
            {AVAILABLE_ROUTES.map(route => (
              <div key={route} className={styles.routeCheckboxItem}>
                <input
                  type="checkbox"
                  id={`route-${route}`}
                  value={route}
                  checked={selectedRoutes.includes(route)}
                  onChange={() => handleRouteToggle(route)}
                  className={styles.checkboxInput}
                />
                <label htmlFor={`route-${route}`} className={styles.checkboxLabel}>
                  {route.split('/').pop()} {/* Show only endpoint name */}
                  <span className={styles.fullRoutePath}>({route})</span>
                </label>
              </div>
            ))}
          </div>
           <p className={styles.inputHint}>Select which API service endpoints this key can access.</p>
        </div>

        {formError && <p className={styles.formErrorMessage}><AlertTriangle size={16}/> {formError}</p>}

        <div className={styles.modalFooterActions}>
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading} iconLeft={<ShieldCheck size={16} />}>
            {isEditMode ? 'Save Changes' : 'Create API Key'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateEditVirtualApiKeyModal;