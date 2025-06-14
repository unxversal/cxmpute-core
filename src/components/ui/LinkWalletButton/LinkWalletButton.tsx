"use client";

import React, { useState } from "react";
import DashboardButton from "@/components/dashboard/DashboardButton/DashboardButton";
import { notify } from "@/components/ui/NotificationToaster/NotificationToaster";

interface LinkWalletButtonProps {
  accountType: "user" | "provider";
  accountId: string;
  initialWalletAddress?: string | null;
  className?: string;
}

const LinkWalletButton: React.FC<LinkWalletButtonProps> = ({
  accountType,
  accountId,
  initialWalletAddress,
  className,
}) => {
  const [walletAddress, setWalletAddress] = useState<string | null>(
    initialWalletAddress ?? null
  );
  const [isLinking, setIsLinking] = useState(false);

  if (walletAddress) {
    return (
      <p className={className} style={{ fontSize: "0.85rem" }}>
        Wallet&nbsp;
        <span style={{ fontWeight: 600 }}>{`${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`}</span>
        &nbsp;linked ✅
      </p>
    );
  }

  const handleLink = async () => {
    if (isLinking) return;
    if (!(window as any).ethereum) {
      notify.error("No EVM wallet detected (MetaMask/WalletConnect)");
      return;
    }
    try {
      setIsLinking(true);
      // 1. Request accounts
      const [address] = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      if (!address) throw new Error("No address selected");

      // 2. Optional signature of accountId to prove ownership
      let signature: string | null = null;
      try {
        signature = await (window as any).ethereum.request({
          method: "personal_sign",
          params: [
            `Link wallet for Cxmpute account ${accountId}`,
            address,
          ],
        });
      } catch {
        // user may reject; continue without signature
      }

      // 3. Call backend
      const resp = await fetch("/api/v1/wallet/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType,
          accountId,
          walletAddress: address,
          signature,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Link failed");
      notify.success("Wallet linked!");
      setWalletAddress(address);
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || "Failed to link wallet");
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <DashboardButton
      variant="accentPurple"
      onClick={handleLink}
      disabled={isLinking}
      text={isLinking ? "Linking…" : "Link Wallet"}
      className={className}
    />
  );
};

export default LinkWalletButton; 