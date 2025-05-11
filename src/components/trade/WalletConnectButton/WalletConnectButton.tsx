/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/WalletConnectButton/WalletConnectButton.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ethers, BrowserProvider, Eip1193Provider, Signer } from 'ethers';
import styles from './WalletConnectButton.module.css';
import Button from '@/components/ui/Button/Button'; // Your UI Button
import { Wallet, LogOut, AlertTriangle } from 'lucide-react';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
// Optional: If you create a WalletContext
// import { useWallet } from '@/contexts/WalletContext';

// Helper to shorten addresses
const shortenAddress = (address: string, chars = 4): string => {
  if (!address) return '';
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
};

// Define the window.ethereum type if not already globally available
declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
        isMetaMask?: boolean;
        request: (...args: any[]) => Promise<any>; // More specific typing can be added
        on: (event: string, callback: (...args: any[]) => void) => void;
        removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

const WalletConnectButton: React.FC = () => {
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null); // To store the signer
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false); // To ensure window.ethereum is accessed only client-side

  // This state is to ensure window.ethereum is available
  useEffect(() => {
    setIsClient(true);
  }, []);

  const isWalletConnected = !!currentAccount;

  const connectWallet = useCallback(async () => {
    if (!isClient || !window.ethereum) {
      notify.error('Wallet provider (e.g., MetaMask) not detected. Please install a wallet extension.');
      setError('Wallet provider not detected.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum, 'any'); // 'any' for automatic network detection or specific chainId
      
      // Request accounts
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      
      if (accounts && accounts.length > 0) {
        const currentSigner = await browserProvider.getSigner(accounts[0]);
        setCurrentAccount(accounts[0]);
        setSigner(currentSigner);
        setProvider(browserProvider);
        notify.success(`Wallet connected: ${shortenAddress(accounts[0])}`);
        
        // TODO: Potentially call a backend API to link this wallet address
        // to the user's Cxmpute account if not already linked.
        // This would involve the signature flow discussed for WalletLinker.
        // For now, this component only handles the connection.
      } else {
        throw new Error('No accounts found. Please ensure your wallet is unlocked and connected.');
      }

    } catch (err: any) {
      console.error('Error connecting wallet:', err);
      const message = err.message?.includes('User rejected the request')
        ? 'Connection request rejected.'
        : err.message || 'Failed to connect wallet.';
      setError(message);
      notify.error(message);
      setCurrentAccount(null);
      setSigner(null);
      setProvider(null);
    } finally {
      setIsLoading(false);
    }
  }, [isClient]);

  const disconnectWallet = useCallback(() => {
    // Note: True "disconnect" often requires the user to do it from their wallet extension.
    // This function primarily clears the app's state.
    setCurrentAccount(null);
    setSigner(null);
    setProvider(null);
    setError(null);
    notify('Wallet disconnected from app.');
    // If using WalletConnect or other libraries, they might have specific disconnect methods.
    // For example: if (provider?.provider.isWalletConnect) provider.provider.disconnect();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (isClient && window.ethereum && window.ethereum.on) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // MetaMask is locked or the user has disconnected all accounts
          notify.error('Wallet disconnected or locked.');
          disconnectWallet();
        } else if (accounts[0] !== currentAccount) {
          // Account changed, re-initialize
          notify.success(`Account switched to: ${shortenAddress(accounts[0])}`);
          // Re-connect with the new account logic (similar to connectWallet)
          // For simplicity, we can just update the account and re-fetch signer.
          // A more robust solution would re-trigger the connection flow or use wagmi hooks.
          async function updateSigner() {
            if (provider) {
                try {
                    const newSigner = await provider.getSigner(accounts[0]);
                    setCurrentAccount(accounts[0]);
                    setSigner(newSigner);
                } catch (e) {
                    console.error("Error getting new signer on account change:", e);
                    disconnectWallet();
                }
            }
          }
          updateSigner();
        }
      };

      const handleChainChanged = (chainIdHex: string) => {
        // chainIdHex is like "0x1" or "0x8276" (for Peaq mainnet: 3338 -> 0xd0a)
        const chainId = parseInt(chainIdHex, 16);
        notify.info(`Network changed to chain ID: ${chainId}. Please ensure it's Peaq network.`);
        // You might want to force a reconnect or re-check provider network here
        // For simplicity, we'll just log it. Production apps often verify chainId.
        if (provider) {
            // Re-initialize provider to reflect new chain potentially
            const newProvider = new ethers.BrowserProvider(window.ethereum!, 'any');
            setProvider(newProvider);
            if(currentAccount) {
                newProvider.getSigner(currentAccount).then(setSigner).catch(console.error);
            }
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, [currentAccount, disconnectWallet, isClient, provider]);

  if (!isClient) {
    // Prevents SSR issues and hydration mismatch by not rendering button until client-side
    return <div className={styles.placeholderButton}>Loading Wallet Button...</div>;
  }
  
  if (!window.ethereum) {
    return (
      <Button variant="secondary" size="md" disabled className={styles.walletButton}>
        <AlertTriangle size={18} /> No Wallet Detected
      </Button>
    );
  }

  return (
    <div className={styles.walletButtonContainer}>
      {isWalletConnected ? (
        <div className={styles.connectedInfo}>
          <span className={styles.addressDisplay} title={currentAccount!}>
            <Wallet size={16} /> {shortenAddress(currentAccount!)}
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
          variant="primary"
          size="md"
          iconLeft={<Wallet size={18} />}
          className={styles.walletButton}
        >
          Connect Wallet
        </Button>
      )}
      {error && <p className={styles.errorMessage}>{error}</p>}
    </div>
  );
};

export default WalletConnectButton;