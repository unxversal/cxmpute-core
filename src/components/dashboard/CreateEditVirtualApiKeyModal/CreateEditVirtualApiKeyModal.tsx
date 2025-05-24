// src/components/dashboard/CreateEditVirtualApiKeyModal/CreateEditVirtualApiKeyModal.tsx
"use client";

import React, { useState, useEffect, FormEvent } from 'react';
import styles from './CreateEditVirtualApiKeyModal.module.css';
import ThemeModal from '../ThemeModal/ThemeModal'; // Updated import
import DashboardButton from '../DashboardButton/DashboardButton'; // Updated import
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { ApiKeyInfo } from '@/lib/interfaces';
import { KeyRound, ShieldCheck, DollarSign, ListChecks, AlertTriangle, Edit } from 'lucide-react';

// Assuming AVAILABLE_ROUTES is defined in references or passed as prop
// For now, keeping it local as in the previous version.
// Consider moving to src/lib/references.ts if used elsewhere.
const AVAILABLE_ROUTES = [
  "/api/v1/chat/completions", "/api/v1/embeddings", "/api/v1/image",
  "/api/v1/tts", "/api/v1/video", "/api/v1/scrape",
  "/api/v1/m/caption", "/api/v1/m/query", "/api/v1/m/detect", "/api/v1/m/point",
];

interface CreateEditVirtualApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  existingKeyData?: ApiKeyInfo & { name?: string };
  onKeySaved: () => void;
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
  const [creditLimit, setCreditLimit] = useState('10000');
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>(['/api/v1/chat/completions']);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && existingKeyData) {
        setKeyName(existingKeyData.name || `Key ending in ...${existingKeyData.key.slice(-4)}`);
        setCreditLimit(existingKeyData.creditLimit.toString());
        setSelectedRoutes(existingKeyData.permittedRoutes || []);
      } else {
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
      setFormError("Credit limit must be a positive number."); return;
    }
    if (selectedRoutes.length === 0) {
      setFormError("At least one route must be permitted."); return;
    }
    if (keyName.trim().length > 50) {
      setFormError("Key name cannot exceed 50 characters."); return;
    }

    setIsLoading(true);
    const payload = {
      name: keyName.trim() || undefined,
      creditLimit: limitNum,
      permittedRoutes: selectedRoutes,
    };

    const apiUrl = isEditMode
      ? `/api/user/${userId}/keys/${existingKeyData?.key}`
      : `/api/user/${userId}/keys`;
    const method = isEditMode ? 'PUT' : 'POST';

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
      onKeySaved();
      onClose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} API key:`, err);
      setFormError(err.message || 'An unexpected error occurred.');
      // notify.error(err.message || 'An unexpected error occurred.'); // Form error is shown in modal
    } finally {
      setIsLoading(false);
    }
  };

  const modalTitleString = isEditMode ? "Edit API Key Metadata" : "Create New Virtual API Key";
  const modalTitleNode = (
    <span className={styles.modalTitleCustom}>
      {isEditMode ? <Edit size={24} className={styles.titleIcon}/> : <KeyRound size={24} className={styles.titleIcon}/>}
      {modalTitleString}
    </span>
  );

  const footerContent = (
    <>
      <DashboardButton type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
        Cancel
      </DashboardButton>
      <DashboardButton type="submit" variant="primary" isLoading={isLoading} disabled={isLoading} iconLeft={<ShieldCheck size={16} />} text={isEditMode ? 'Save Changes' : 'Create API Key'} />
    </>
  );


  return (
    <ThemeModal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={modalTitleNode as unknown as string} // Cast if ThemeModal title prop expects string
        size="lg" 
        footerContent={footerContent} // Pass buttons to ThemeModal footer
    >
      {/* Form is now direct child of ThemeModal's body */}
      <form onSubmit={handleSubmit} className={styles.form}>
        {isEditMode && existingKeyData && (
          <div className={styles.keyInfoDisplay}>
            <KeyRound size={18} className={styles.infoIcon} />
            <strong>Key String:</strong> 
            <span className={styles.actualKeyString} title={existingKeyData.key}>
                {existingKeyData.key.substring(0,4)}...{existingKeyData.key.slice(-4)} (Cannot be changed)
            </span>
          </div>
        )}

        <div className={styles.formGroup}>
          <label htmlFor="keyName">
            Key Name / Label <span className={styles.optionalText}>(Optional)</span>
          </label>
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
          <label htmlFor="creditLimit"><DollarSign size={16} className={styles.labelIcon}/> Credit Limit</label>
          <input
            type="number"
            id="creditLimit"
            className={styles.inputField}
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            min="1"
            required
          />
          <p className={styles.inputHint}>Max credits this key can use. Deducted from your main balance.</p>
        </div>

        <div className={styles.formGroup}>
          <label><ListChecks size={16} className={styles.labelIcon}/> Permitted API Routes</label>
          <div className={styles.routesGrid}>
            {AVAILABLE_ROUTES.map(route => (
              <div key={route} className={styles.routeCheckboxItem}>
                <input
                  type="checkbox"
                  id={`route-${route.replace(/\//g, '-')}`} // Make ID more CSS-friendly
                  value={route}
                  checked={selectedRoutes.includes(route)}
                  onChange={() => handleRouteToggle(route)}
                  className={styles.checkboxInput}
                />
                <label htmlFor={`route-${route.replace(/\//g, '-')}`} className={styles.checkboxLabel}>
                  {route.split('/').pop()}
                  <span className={styles.fullRoutePath}>({route})</span>
                </label>
              </div>
            ))}
          </div>
           <p className={styles.inputHint}>Select which API service endpoints this key can access.</p>
        </div>

        {formError && <p className={styles.formErrorMessage}><AlertTriangle size={16}/> {formError}</p>}
        
        {/* Footer buttons are now passed via footerContent to ThemeModal */}
      </form>
    </ThemeModal>
  );
};

export default CreateEditVirtualApiKeyModal;