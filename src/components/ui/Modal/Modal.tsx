// src/components/ui/Modal/Modal.tsx
"use client";

import React, { useEffect, useRef, ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl'; // Optional size prop
  showCloseButton?: boolean;
  footerContent?: ReactNode; // Optional footer content
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  footerContent,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle Escape key press to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Focus the modal or first focusable element when it opens
      modalRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Handle overlay click to close modal
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  // Focus trapping (basic example)
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const trapFocus = (event: KeyboardEvent) => {
          if (event.key === 'Tab') {
            if (event.shiftKey) { // Shift + Tab
              if (document.activeElement === firstElement) {
                lastElement.focus();
                event.preventDefault();
              }
            } else { // Tab
              if (document.activeElement === lastElement) {
                firstElement.focus();
                event.preventDefault();
              }
            }
          }
        };
        document.addEventListener('keydown', trapFocus);
        return () => document.removeEventListener('keydown', trapFocus);
      }
    }
  }, [isOpen]);


  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles.modalOverlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        ref={modalRef}
        className={`${styles.modalContent} ${styles[size]}`}
        tabIndex={-1} // Make the modal div focusable
      >
        {(title || showCloseButton) && (
          <div className={styles.modalHeader}>
            {title && <h2 id="modal-title" className={styles.modalTitle}>{title}</h2>}
            {showCloseButton && (
              <button
                onClick={onClose}
                className={styles.closeButton}
                aria-label="Close modal"
              >
                ×
              </button>
            )}
          </div>
        )}
        <div className={styles.modalBody}>
          {children}
        </div>
        {footerContent && (
          <div className={styles.modalFooter}>
            {footerContent}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;