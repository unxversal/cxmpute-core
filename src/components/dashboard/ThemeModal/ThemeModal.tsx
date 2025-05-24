// src/components/dashboard/ThemeModal/ThemeModal.tsx
"use client";

import React, { useEffect, useRef, ReactNode } from 'react';
import styles from './ThemeModal.module.css';
import DashboardButton from '../DashboardButton/DashboardButton'; // Using our new DashboardButton
import { X } from 'lucide-react';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl'; // Optional size prop, 'md' is default
  showCloseButton?: boolean;
  footerContent?: ReactNode; // Optional footer content (e.g., action buttons)
  className?: string; // Allow passing custom class to modalContent
}

const ThemeModal: React.FC<ThemeModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  footerContent,
  className = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle Escape key press to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.addEventListener('keydown', handleEscape);
      modalRef.current?.focus(); // Focus the modal itself
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus(); // Restore focus on close
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

  // Basic focus trapping
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      // Focus first element on open, after a micro-delay for modal to render
      setTimeout(() => firstElement.focus(), 50);


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
      modalRef.current.addEventListener('keydown', trapFocus);
      return () => modalRef.current?.removeEventListener('keydown', trapFocus);
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
      aria-labelledby={title ? "theme-modal-title" : undefined}
    >
      <div
        ref={modalRef}
        className={`${styles.modalContent} ${styles[size]} ${className}`}
        tabIndex={-1} // Make the modal div focusable for screen readers and Esc key
      >
        {(title || showCloseButton) && (
          <div className={styles.modalHeader}>
            {title && <h2 id="theme-modal-title" className={styles.modalTitle}>{title}</h2>}
            {showCloseButton && (
              <DashboardButton
                variant="ghost"
                size="sm"
                onClick={onClose}
                className={styles.closeButton}
                aria-label="Close modal"
                iconLeft={<X size={20} />} // Using X from lucide
              />
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

export default ThemeModal;