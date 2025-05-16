/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/trade/WalletLinker/WalletLinker.tsx
"use client";

import React, { useState, useEffect, ChangeEvent } from 'react';
import styles from './WalletLinker.module.css';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import { useAuth } from '@/contexts/AuthContext'; // To get userId and current linked wallet
import { useWallet } from '@/contexts/WalletContext'; // To get currently *connected* wallet via MetaMask etc. & signer
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import { ethers } from 'ethers';
import { Link2, Edit3, AlertTriangle } from 'lucide-react';

const MESSAGE_TO_SIGN_PREFIX = "Link this Peaq wallet to your Cxmpute account: ";

interface WalletLinkerProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletLinked: (newAddress: string) => void; // Callback after successful link
}

const WalletLinker: React.FC<WalletLinkerProps> = ({ isOpen, onClose, onWalletLinked }) => {
  const { user, isAuthenticated } = useAuth(); // User from primary auth (email, etc.)
  const {
    account: connectedMetaMaskAccount, // Account currently connected via WalletConnectButton/WalletContext
    signer: connectedMetaMaskSigner,
    status: walletContextStatus,
  } = useWallet();

  // This state holds the wallet address *currently stored* in the user's Cxmpute profile
  const [currentLinkedAddress, setCurrentLinkedAddress] = useState<string | null>(null);
  // This state holds the address from the input field, or the one connected via MetaMask
  const [addressToLink, setAddressToLink] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // To show input field

  useEffect(() => {
    if (isOpen && user?.properties.walletAddress) {
      setCurrentLinkedAddress(user.properties.walletAddress);
      setAddressToLink(user.properties.walletAddress); // Pre-fill with current linked
      setIsEditing(!user.properties.walletAddress); // Start in edit mode if no wallet linked
    } else if (isOpen) {
        setCurrentLinkedAddress(null);
        setAddressToLink('');
        setIsEditing(true); // No wallet linked, start in edit mode
    }
  }, [isOpen, user?.properties.walletAddress]);

  // If user connects a new wallet via MetaMask *while this modal is open*, update input
  useEffect(() => {
    if (isOpen && isEditing && connectedMetaMaskAccount && connectedMetaMaskAccount !== addressToLink) {
        setAddressToLink(connectedMetaMaskAccount);
    }
  }, [isOpen, isEditing, connectedMetaMaskAccount, addressToLink]);


  const handleAddressInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAddressToLink(e.target.value);
  };

  const handleLinkWallet = async () => {
    if (!isAuthenticated || !user?.properties.id) {
      notify.error("User not authenticated."); return;
    }
    if (!addressToLink || !ethers.isAddress(addressToLink)) {
      notify.error("Please enter a valid Peaq wallet address."); return;
    }

    // Step 1: Ensure the wallet user wants to link is the one connected via WalletContext (MetaMask)
    if (!connectedMetaMaskAccount || connectedMetaMaskAccount.toLowerCase() !== addressToLink.toLowerCase()) {
      notify.error(
        `Please connect to the wallet ${shortenAddress(addressToLink)} using the 'Connect Wallet' button before linking.`
      );
      // Optionally trigger connectWallet from WalletContext if desired
      // await connectWallet(); // This might auto-close modal, handle UX carefully
      return;
    }
    if (!connectedMetaMaskSigner) {
        notify.error("Wallet signer not available. Ensure your wallet is properly connected."); return;
    }

    setIsLoading(true);
    const messageToSign = `${MESSAGE_TO_SIGN_PREFIX}${user.properties.id}`; // Sign a message containing their unique Cxmpute ID

    try {
      const signature = await connectedMetaMaskSigner.signMessage(messageToSign);

      const response = await fetch(`/api/user/${user.properties.id}/link-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: addressToLink, // This is connectedMetaMaskAccount
          signature,
          messageToSign,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to link wallet.");
      }

      notify.success("Wallet linked successfully!");
      setCurrentLinkedAddress(addressToLink); // Update local display
      onWalletLinked(addressToLink); // Notify parent (e.g., to refresh AuthContext user)
      setIsEditing(false); // Go back to display mode
      onClose(); // Close modal

    } catch (err: any) {
      console.error("Error linking wallet:", err);
      notify.error(err.message || "An error occurred while linking the wallet.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    if (currentLinkedAddress) {
        setAddressToLink(currentLinkedAddress); // Pre-fill with current if editing
    }
    // If not connected via WalletContext, prompt to connect
    if (walletContextStatus !== 'CONNECTED' || !connectedMetaMaskAccount) {
        // connectWallet(); // This might be too abrupt, better to guide user.
        notify.error("Please connect the wallet you wish to link using the main 'Connect Wallet' button first.");
    } else if (connectedMetaMaskAccount) {
        setAddressToLink(connectedMetaMaskAccount); // Pre-fill with connected if editing/changing
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Link Peaq Wallet" size="md">
      <div className={styles.linkerContent}>
        {!isAuthenticated && <p className={styles.errorText}>Please log in to link a wallet.</p>}
        
        {isAuthenticated && currentLinkedAddress && !isEditing && (
          <div className={styles.currentWalletInfo}>
            <h4>Currently Linked Wallet:</h4>
            <p className={styles.addressDisplay} title={currentLinkedAddress}>
              <Link2 size={16} /> {shortenAddress(currentLinkedAddress)}
            </p>
            <Button variant="outline" size="sm" onClick={handleEdit} iconLeft={<Edit3 size={14}/>}>
              Change Linked Wallet
            </Button>
          </div>
        )}

        {isAuthenticated && isEditing && (
          <form onSubmit={(e) => { e.preventDefault(); handleLinkWallet(); }} className={styles.linkForm}>
            <p className={styles.instructions}>
              {currentLinkedAddress ? "To change your linked wallet, " : "To link a wallet, "}
              ensure the desired wallet is active in your browser extension (e.g., MetaMask), then confirm its address below and click &quot;Link Wallet&quot;.
              You will be asked to sign a message to prove ownership.
            </p>
            {walletContextStatus !== 'CONNECTED' && (
                <div className={`${styles.notice} ${styles.warningNotice}`}>
                    <AlertTriangle size={18}/> Your browser wallet is not connected to this site. Please use the main &quot;Connect Wallet&quot; button first.
                </div>
            )}
            <div className={styles.formGroup}>
              <label htmlFor="walletAddressInput">Peaq Wallet Address to Link:</label>
              <input
                type="text"
                id="walletAddressInput"
                className={styles.inputField}
                value={addressToLink}
                onChange={handleAddressInputChange}
                placeholder="0x..."
                // readOnly={!!connectedMetaMaskAccount} // If connected, make it read-only to ensure they link the connected one
                // title={connectedMetaMaskAccount ? "This is your currently connected wallet via browser extension." : "Enter or connect your desired Peaq wallet."}
              />
               {connectedMetaMaskAccount && connectedMetaMaskAccount.toLowerCase() !== addressToLink.toLowerCase() && addressToLink !== "" && (
                <p className={styles.warningTextSmall}>Warning: Address above does not match currently connected wallet ({shortenAddress(connectedMetaMaskAccount)}). Please switch accounts in your wallet or update the address.</p>
               )}
            </div>
            <div className={styles.modalActions}>
              {currentLinkedAddress && <Button type="button" variant="ghost" onClick={() => { setIsEditing(false); setAddressToLink(currentLinkedAddress); }}>Cancel Change</Button>}
              <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading || !ethers.isAddress(addressToLink) || (walletContextStatus === 'CONNECTED' && connectedMetaMaskAccount?.toLowerCase() !== addressToLink.toLowerCase())}>
                Link Wallet & Sign
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

// Helper to shorten addresses
const shortenAddress = (address: string, chars = 6): string => {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
};

export default WalletLinker;