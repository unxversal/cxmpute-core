/* eslint-disable @typescript-eslint/no-explicit-any */
// src/contexts/WalletContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { ethers, BrowserProvider, Signer, Eip1193Provider } from 'ethers';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster'; // Assuming path
import { AlertTriangle, Info } from 'lucide-react';

// Define the window.ethereum type if not already globally available
declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
        isMetaMask?: boolean;
        request: (...args: any[]) => Promise<any>;
        on: (event: string, callback: (...args: any[]) => void) => void;
        removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

type WalletStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR' | 'NO_PROVIDER';

interface WalletContextType {
  status: WalletStatus;
  account: string | null;
  signer: Signer | null;
  provider: BrowserProvider | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  error: string | null;
  isMetaMaskAvailable: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<WalletStatus>('DISCONNECTED');
  const [account, setAccount] = useState<string | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMetaMaskAvailable, setIsMetaMaskAvailable] = useState<boolean>(false);
  const [isClient, setIsClient] = useState(false);


  useEffect(() => {
    setIsClient(true);
    if (typeof window !== "undefined" && window.ethereum) {
      setIsMetaMaskAvailable(true);
    } else {
      setIsMetaMaskAvailable(false);
      if (isClient) setStatus('NO_PROVIDER'); // Set status only after client check
    }
  }, [isClient]);

  const _clearState = useCallback(() => {
    setAccount(null);
    setSigner(null);
    setProvider(null); // Also clear provider instance
    setError(null);
    setStatus('DISCONNECTED');
  }, []);

  const connectWallet = useCallback(async () => {
    if (!isClient) return; // Should not happen if button is rendered only on client

    if (!window.ethereum) {
      notify.error('Wallet provider (e.g., MetaMask) not detected. Please install a wallet extension.');
      setError('Wallet provider not detected.');
      setStatus('NO_PROVIDER');
      return;
    }

    setStatus('CONNECTING');
    setError(null);
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum, 'any');
      
      // Check if already connected (e.g., page reload)
      const previouslyConnectedAccounts = await browserProvider.send('eth_accounts', []);
      let accountsToConnect: string[];

      if (previouslyConnectedAccounts && previouslyConnectedAccounts.length > 0) {
        accountsToConnect = previouslyConnectedAccounts;
         console.log("WalletContext: Found previously connected accounts:", accountsToConnect);
      } else {
        accountsToConnect = await browserProvider.send('eth_requestAccounts', []);
         console.log("WalletContext: Requested new accounts:", accountsToConnect);
      }
      
      if (accountsToConnect && accountsToConnect.length > 0) {
        const currentSigner = await browserProvider.getSigner(accountsToConnect[0]);
        setAccount(accountsToConnect[0]);
        setSigner(currentSigner);
        setProvider(browserProvider);
        setStatus('CONNECTED');
        notify.success(`Wallet connected: ${accountsToConnect[0].substring(0,6)}...`);
      } else {
        throw new Error('No accounts found or permission denied.');
      }
    } catch (err: any) {
      console.error('WalletContext: Error connecting wallet:', err);
      const message = err.message?.includes('User rejected the request')
        ? 'Connection request rejected.'
        : err.message || 'Failed to connect wallet.';
      setError(message);
      notify.error(message);
      _clearState(); // Reset state on error
      setStatus('ERROR');
    }
  }, [isClient, _clearState]);

  const disconnectWallet = useCallback(() => {
    _clearState();
    notify('Wallet disconnected from app.', { icon: <Info size={18} /> });
    // Note: True "disconnect" often requires the user to do it from their wallet extension.
    // For libraries like WalletConnect, you would call their disconnect method here.
  }, [_clearState]);


  // Event Handlers for account and chain changes
  useEffect(() => {
    if (!isClient || !window.ethereum || !window.ethereum.on) {
      return;
    }

    const handleAccountsChanged = async (accounts: string[]) => {
      console.log("WalletContext: accountsChanged", accounts);
      if (accounts.length === 0) {
        notify.error('Wallet disconnected or locked by user.');
        disconnectWallet();
      } else if (accounts[0] !== account) {
        // Account switched, re-initialize connection state with new account
        notify.success(`Account switched to: ${accounts[0].substring(0,6)}...`);
        // Re-trigger connection logic for the new account
        if (window.ethereum) { // Ensure provider is still available
            try {
                const newProvider = new ethers.BrowserProvider(window.ethereum, 'any');
                const newSigner = await newProvider.getSigner(accounts[0]);
                setAccount(accounts[0]);
                setSigner(newSigner);
                setProvider(newProvider);
                setStatus('CONNECTED'); // Ensure status reflects connection
            } catch (e) {
                console.error("WalletContext: Error updating signer on account change:", e);
                disconnectWallet();
            }
        }
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16);
      notify(`Network changed to Chain ID: ${chainId}. Re-initializing provider.`, {
        icon: <AlertTriangle size={18} color="#f8cb46" />,
      });
      // Re-initialize provider and signer to reflect new chain
      if (window.ethereum) { // Ensure provider is still available
        const newProvider = new ethers.BrowserProvider(window.ethereum, 'any'); // 'any' will try to auto-detect
        setProvider(newProvider);
        if (account) {
          newProvider.getSigner(account)
            .then(newSigner => setSigner(newSigner))
            .catch(e => {
              console.error("WalletContext: Error updating signer on chain change:", e);
              // Decide if disconnect is appropriate if signer can't be obtained.
              // Potentially, the user is on an unsupported chain.
              setError(`Error with new network (ID: ${chainId}). Please connect to Peaq.`);
              // disconnectWallet(); // Optionally disconnect
            });
        } else {
            setSigner(null); // No account, so no signer
        }
      }
    };
    
    const handleDisconnect = (disconnectError?: { code: number; message: string }) => {
        console.log("WalletContext: Ethereum provider disconnect event", disconnectError);
        notify.error("Wallet disconnected by provider.");
        disconnectWallet();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect); // Some providers emit this

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [account, disconnectWallet, isClient]); // `provider` removed to avoid re-subscribing on its change

  return (
    <WalletContext.Provider
      value={{ status, account, signer, provider, connectWallet, disconnectWallet, error, isMetaMaskAvailable }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};