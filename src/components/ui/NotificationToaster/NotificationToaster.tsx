// src/components/ui/NotificationToaster/NotificationToaster.tsx
"use client";

import React from 'react';
import { Toaster, toast } from 'react-hot-toast';
// Optional: styles for the container if you need to override react-hot-toast defaults
// import styles from './NotificationToaster.module.css';

// Export the toast function directly for easy use in other components
export const notify = toast;

const NotificationToaster: React.FC = () => {
  return (
    <Toaster
      position="top-right" // Or your preferred position
      reverseOrder={false} // Show newest on top
      gutter={8}
      toastOptions={{
        // Default options for all toasts
        className: '', // You can add a global class name here
        duration: 5000, // Default duration
        style: {
          background: '#2a2f3b', // Dark background for toasts
          color: '#e0e0e0',     // Light text
          border: '1px solid #3e4556',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          padding: '12px 16px',
          fontSize: '0.9rem',
        },

        // Default options for specific types
        success: {
          duration: 3000,
          iconTheme: {
            primary: '#20a191', // Cxmpute Green for success
            secondary: '#FFFFFF',
          },
          style: {
            background: '#233b38', // Darker green background
            border: '1px solid #20a191',
          },
        },
        error: {
          duration: 5000,
          iconTheme: {
            primary: '#d64989', // Cxmpute Red for error
            secondary: '#FFFFFF',
          },
          style: {
            background: '#3a252e', // Darker red background
            border: '1px solid #d64989',
          },
        },
        loading: {
          style: {
            background: '#3e4556',
            border: '1px solid #50586a',
          }
        }
      }}
    />
  );
};

export default NotificationToaster;