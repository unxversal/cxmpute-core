// src/components/trade/WalletConnectButton/WalletConnectButton.tsx
"use client";

import React from 'react';
import styles from './WalletConnectButton.module.css';
import Button from '@/components/ui/Button/Button';
import { useWallet } from '@/contexts/WalletContext'; // Import the context hook
import { Wallet, LogOut, AlertTriangle, Loader2 } from 'lucide-react';

// Helper to shorten addresses
const shortenAddress = (address: string, chars = 4): string => {
  if (!address) return '';
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
};

const WalletConnectButton: React.FC = () => {
  const {
    status,
    account,
    connectWallet,
    disconnectWallet,
    error, // WalletContext now provides detailed error
    isMetaMaskAvailable,
  } = useWallet();

  const isLoading = status === 'CONNECTING';
  const isConnected = status === 'CONNECTED' && !!account;

  if (!isMetaMaskAvailable && status === 'NO_PROVIDER') {
    return (
      <Button variant="secondary" size="md" disabled className={styles.walletButton}>
        <AlertTriangle size={18} /> No Wallet Detected
      </Button>
    );
  }
  
  if (status === 'DISCONNECTED' && !isMetaMaskAvailable) {
     // Initial state before client check for window.ethereum finishes
     return <div className={styles.placeholderButton}>Checking Wallet...</div>;
  }


  return (
    <div className={styles.walletButtonContainer}>
      {isConnected ? (
        <div className={styles.connectedInfo}>
          <span className={styles.addressDisplay} title={account!}>
            <Wallet size={16} /> {shortenAddress(account!)}
          </span>
          <Button
            onClick={disconnectWallet}
            variant="outline"
            size="sm"
            className={styles.disconnectButton}
            iconLeft={<LogOut size={14} />}
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <Button
          onClick={connectWallet}
          isLoading={isLoading}
          disabled={isLoading || status === 'NO_PROVIDER'}
          variant="primary"
          size="md"
          iconLeft={isLoading ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />}
          className={styles.walletButton}
        >
          {isLoading ? 'Connecting...' : 'Connect Wallet'}
        </Button>
      )}
      {status === 'ERROR' && error && <p className={styles.errorMessage}>{error}</p>}
    </div>
  );
};

export default WalletConnectButton;