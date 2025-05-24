/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/dashboard/UserDashboardContent/UserDashboardContent.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './UserDashboardContent.module.css';
import Button from '@/components/ui/Button/Button';
import ViewApiKeyModal from '../ViewApiKeyModal/ViewApiKeyModal';
import VirtualApiKeysManagerModal from '../VirtualApiKeysManagerModal/VirtualApiKeysManagerModal';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { AuthenticatedUserSubject } from '@/lib/auth'; // User subject type
import { SystemProvisionReference } from '@/lib/references'; // For listing services
import Link from 'next/link';
import { Wallet, KeyRound, BarChart3, Copy, Gift, Zap, ChevronRight } from 'lucide-react';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';

// Define the structure of the subject properties this component expects
interface UserDashboardProps {
  subject: AuthenticatedUserSubject['properties']; // Pass only the 'properties' part
}

interface UserSummary {
  apiKeys: any[]; // Define more strictly if ApiKeyInfo is stable
  credits: number;
  rewards: number; // Assuming this is CXPT or similar platform token
}

const UserDashboardContent: React.FC<UserDashboardProps> = ({ subject }) => {
  const [userSummary, setUserSummary] = useState<UserSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [isViewUserAkModalOpen, setIsViewUserAkModalOpen] = useState(false);
  const [isRefreshingUserAk, setIsRefreshingUserAk] = useState(false);
  const [currentUserAk, setCurrentUserAk] = useState<string | null>(subject.userAk);

  const [isVirtualKeysModalOpen, setIsVirtualKeysModalOpen] = useState(false);

  const fetchUserSummaryData = useCallback(async () => {
    if (!subject.id) return;
    setIsLoadingSummary(true);
    setSummaryError(null);
    try {
      const response = await fetch(`/api/user/${subject.id}/summary`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to load user summary.");
      }
      const data = await response.json();
      setUserSummary({
        apiKeys: data.apiKeys || [],
        credits: data.credits || 0,
        rewards: data.rewards || 0,
      });
    } catch (error: any) {
      console.error("Error fetching user summary:", error);
      setSummaryError(error.message || "Could not load summary data.");
      setUserSummary({ apiKeys: [], credits: 0, rewards: 0 }); // Set defaults on error
    } finally {
      setIsLoadingSummary(false);
    }
  }, [subject.id]);

  useEffect(() => {
    fetchUserSummaryData();
    setCurrentUserAk(subject.userAk); // Initialize or update if subject prop changes
  }, [subject.userAk, fetchUserSummaryData]);


  const handleRefreshUserAk = async (): Promise<string | null> => {
    if (!subject.id) return null;
    setIsRefreshingUserAk(true);
    const loadingToastId = notify.loading("Refreshing User API Key...");
    try {
      const response = await fetch(`/api/user/${subject.id}/userAk/refresh`, { method: 'POST' });
      const data = await response.json();
      notify.dismiss(loadingToastId);
      if (!response.ok) throw new Error(data.error || 'Failed to refresh User AK');
      
      setCurrentUserAk(data.userAk); // Update state with the new key
      notify.success("User API Key refreshed successfully!");
      return data.userAk;
    } catch (error: any) {
      notify.dismiss(loadingToastId);
      notify.error(error.message || "Failed to refresh key.");
      return null;
    } finally {
      setIsRefreshingUserAk(false);
    }
  };

  const handleCopyReferralCode = () => {
    navigator.clipboard.writeText(subject.id)
      .then(() => notify.success("Referral Code (User ID) copied!"))
      .catch(() => notify.error("Failed to copy referral code."));
  };
  
  // Memoize distinct service categories from SystemProvisionReference
  const serviceCategories = useMemo(() => {
    const categories = new Set<string>();
    SystemProvisionReference.forEach(service => {
        // Map endpoint to a more user-friendly category name
        if (service.endpoint.includes("chat") || service.endpoint.includes("text") ) categories.add("Language & Vision Models");
        else if (service.endpoint.includes("embeddings")) categories.add("Embeddings");
        else if (service.endpoint.includes("image")) categories.add("Image Generation");
        else if (service.endpoint.includes("video")) categories.add("Video Generation");
        else if (service.endpoint.includes("tts")) categories.add("Text-to-Speech (TTS)");
        else if (service.endpoint.includes("scrape")) categories.add("Web Scraping");
        else if (service.endpoint.includes("/m/")) categories.add("Multimodal Tools");
        else categories.add("Other Compute Services");
    });
    return Array.from(categories);
  }, []);


  return (
    <div className={styles.dashboardContentGrid}>
      {/* Column 1: Key Info & Actions */}
      <div className={`${styles.infoCard} ${styles.keyManagementCard}`}>
        <h3 className={styles.cardTitle}><KeyRound size={20}/> API Key Management</h3>
        <div className={styles.keyActionItem}>
          <p>Your primary User API Key for direct platform access.</p>
          <Button variant="secondary" size="sm" onClick={() => setIsViewUserAkModalOpen(true)}>
            View User AK
          </Button>
        </div>
        <div className={styles.keyActionItem}>
          <p>Manage virtual API keys with custom credit limits and permissions.</p>
          <Button variant="secondary" size="sm" onClick={() => setIsVirtualKeysModalOpen(true)}>
            Manage Virtual Keys
          </Button>
        </div>
         <div className={styles.keyActionItem}>
            <p>Your unique Trader API Key for DEX access.</p>
            <span className={styles.traderAkDisplay} title={subject.traderAk}>
                {subject.traderAk ? `${subject.traderAk.substring(0,4)}...${subject.traderAk.slice(-4)}` : 'N/A'}
                {subject.traderAk && <Copy size={14} onClick={() => navigator.clipboard.writeText(subject.traderAk).then(()=>notify.success("Trader AK Copied!"))} className={styles.copyIconSmall}/>}
            </span>
            <p className={styles.inputHintSmall}>
                This key is linked to your User AK. Refreshing User AK also refreshes this key.
            </p>
        </div>
      </div>

      {/* Column 2: Credits & Rewards */}
      <div className={styles.statsAndReferralColumn}>
        <div className={`${styles.infoCard} ${styles.statsCard}`}>
            <h3 className={styles.cardTitle}><BarChart3 size={20}/> Account Stats</h3>
            <div className={styles.statItem}>
                <span className={styles.statLabel}><Zap size={14}/> Credits Remaining:</span>
                {isLoadingSummary ? <SkeletonLoader width={80} height={20}/> : 
                <span className={styles.statValue}>{userSummary?.credits.toLocaleString() || '0'}</span>}
            </div>
            <div className={styles.statItem}>
                <span className={styles.statLabel}><Gift size={14}/> CXPT Rewards:</span>
                {isLoadingSummary ? <SkeletonLoader width={80} height={20}/> : 
                <span className={styles.statValue}>{userSummary?.rewards.toLocaleString() || '0'} CXPT</span>}
            </div>
            {summaryError && <p className={styles.errorTextSmall}>{summaryError}</p>}
            <Button variant="primary" size="sm" className={styles.fullWidthButton} disabled>
                Load Credits (Coming Soon)
            </Button>
        </div>

        <div className={`${styles.infoCard} ${styles.referralCard}`}>
            <h3 className={styles.cardTitle}><Wallet size={20} /> Referral Code</h3>
            <p>Share your User ID to invite others:</p>
            <div className={styles.referralCodeBox}>
                <span className={styles.referralCodeText} title={subject.id}>{subject.id}</span>
                <Button variant="ghost" size="sm" onClick={handleCopyReferralCode} iconLeft={<Copy size={14}/>} >
                    Copy Referral Code
                </Button>
            </div>
        </div>
      </div>
      

      {/* Row 2 (Full Width): Services List */}
      <div className={`${styles.infoCard} ${styles.servicesCard}`}>
        <h3 className={styles.cardTitle}>Explore Cxmpute Services</h3>
        <p>Access a wide range of decentralized compute services. Click to learn more.</p>
        <div className={styles.serviceList}>
            {serviceCategories.map(categoryName => (
                <Link href={`/docs/${categoryName.toLowerCase().replace(/ & | /g, '-').replace(/[^\w-]+/g, '')}`} key={categoryName} passHref legacyBehavior>
                    <a className={styles.serviceItem}>
                        <span>{categoryName}</span>
                        <ChevronRight size={16} />
                    </a>
                </Link>
            ))}
        </div>
      </div>
      
      {/* Modals */}
      {isViewUserAkModalOpen && (
        <ViewApiKeyModal
          isOpen={isViewUserAkModalOpen}
          onClose={() => setIsViewUserAkModalOpen(false)}
          apiKeyType="User AK"
          currentApiKey={currentUserAk} // Use state that can be updated
          onRefresh={handleRefreshUserAk}
          isLoadingRefresh={isRefreshingUserAk}
        />
      )}

      {isVirtualKeysModalOpen && (
        <VirtualApiKeysManagerModal
          isOpen={isVirtualKeysModalOpen}
          onClose={() => setIsVirtualKeysModalOpen(false)}
          userId={subject.id}
        />
      )}
    </div>
  );
};

export default UserDashboardContent;