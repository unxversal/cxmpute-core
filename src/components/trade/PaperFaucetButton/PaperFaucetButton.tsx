/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/PaperFaucetButton/PaperFaucetButton.tsx
"use client";

import React, { useState } from 'react';
import styles from './PaperFaucetButton.module.css';
import Button from '@/components/ui/Button/Button'; // Using our new UI Button
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import { useAccountContext } from '@/contexts/AccountContext'; // To refresh balances
import { Droplets } from 'lucide-react';

const PaperFaucetButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { refreshBalances } = useAccountContext(); // Get refreshBalances from context

  const handleFaucetRequest = async () => {
    setIsLoading(true);
    const loadingToastId = notify.loading('Requesting paper funds...');

    try {
      const response = await fetch('/api/paper/faucet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Authorization header is handled by the requireAuth in the API route
        },
        // No body needed if the API uses the authenticated user's ID
      });

      notify.dismiss(loadingToastId); // Dismiss loading toast

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Faucet request failed with status ${response.status}`);
      }

      notify.success(data.message || 'Paper funds added successfully!');
      refreshBalances(); // Refresh balances after successful faucet request

    } catch (error: any) {
      console.error('Paper Faucet Error:', error);
      notify.dismiss(loadingToastId); // Ensure loading toast is dismissed on error
      notify.error(error.message || 'Failed to request paper funds.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleFaucetRequest}
      isLoading={isLoading}
      disabled={isLoading}
      variant="secondary" // Or a more fitting variant
      size="md"
      className={styles.faucetButton}
      iconLeft={<Droplets size={18} />} // Example icon
    >
      Get Paper USDC
    </Button>
  );
};

export default PaperFaucetButton;