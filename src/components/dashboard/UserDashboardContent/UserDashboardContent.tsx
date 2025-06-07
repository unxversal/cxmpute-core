/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/dashboard/UserDashboardContent/UserDashboardContent.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import styles from './UserDashboardContent.module.css';
import DashboardButton from '../DashboardButton/DashboardButton'; // New themed button
import ThemeCard from '../ThemeCard/ThemeCard'; // New themed card
import ViewApiKeyModal from '../ViewApiKeyModal/ViewApiKeyModal';
import VirtualApiKeysManagerModal from '../VirtualApiKeysManagerModal/VirtualApiKeysManagerModal';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { AuthenticatedUserSubject } from '@/lib/auth';
import { KeyRound, BarChart3, Copy, Gift, Zap, Activity, Settings, HelpCircle, FileText, Speech, MessageCircleCode, ScanText, PocketKnife, BrainCircuit } from 'lucide-react'; // Added more icons
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader'; // Keep for loading state (should be light-themed)
import ReferralSection from '../ReferralSection';
import { NotificationBanner } from '../../notifications/NotificationBanner';

// Define the structure of the subject properties this component expects
interface UserDashboardProps {
  subject: AuthenticatedUserSubject['properties'];
}

interface UserSummary {
  apiKeys: any[]; // Define more strictly if ApiKeyInfo is stable
  credits: number;
  rewards: number;
}

// Helper to get themed colors (from original UserDashboard.tsx)
const cxmputeGreen = "var(--cxmpute-green, #20a191)";
const cxmputePink = "var(--cxmpute-pink, #fe91e8)";
const cxmputeYellow = "var(--cxmpute-yellow, #f8cb46)";
const cxmputePurple = "var(--cxmpute-purple, #91a8eb)";
const cxmputeOrange = "var(--cxmpute-orange, #f76707)";
const cxmputeSlate = "var(--cxmpute-slate, #d4d4cb)";

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
        const errData = await response.json().catch(() => ({}));
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
      setUserSummary({ apiKeys: [], credits: 0, rewards: 0 });
    } finally {
      setIsLoadingSummary(false);
    }
  }, [subject.id]);

  useEffect(() => {
    fetchUserSummaryData();
    setCurrentUserAk(subject.userAk);
  }, [subject.userAk, fetchUserSummaryData]);

  const handleRefreshUserAk = async () => { /* ... (same as before) ... */
    if (!subject.id) return;
    setIsRefreshingUserAk(true);
    const loadingToastId = notify.loading("Refreshing User API Key...");
    try {
      const response = await fetch(`/api/user/${subject.id}/userAk/refresh`, { method: 'POST' });
      const data = await response.json();
      notify.dismiss(loadingToastId);
      if (!response.ok) throw new Error(data.error || 'Failed to refresh User AK');
      setCurrentUserAk(data.userAk);
      notify.success("User API Key refreshed successfully!");
    } catch (error: any) {
      notify.dismiss(loadingToastId);
      notify.error(error.message || "Failed to refresh key.");
    } finally {
      setIsRefreshingUserAk(false);
    }
  };

  const handleCopyReferralCode = (codeToCopy: string, type: string) => {
    navigator.clipboard.writeText(codeToCopy)
      .then(() => notify.success(`${type} copied to clipboard!`))
      .catch(() => notify.error(`Failed to copy ${type}.`));
  };

  // Define service cards based on SystemProvisionReference or a custom list
  const serviceCardsData = [
    { title: "Text-to-Speech", description: "Convert text into natural-sounding speech with multiple voice options.", icon: <Speech size={24}/>, color: cxmputePurple, docLink: "/docs/text-to-speech" }, // Gift as placeholder
    { title: "Text-to-Text", description: "Utilize SOTA open-source text generation models for cheaper, faster results. Over 100+ languages supported.", icon: <MessageCircleCode size={24}/>, color: cxmputeOrange, docLink: "/docs/text-to-text" },
    { title: "Embeddings", description: "Generate text embeddings for semantic search, RAG, and classification.", icon: <Zap size={24}/>, color: cxmputeGreen, docLink: "/docs/embeddings" },
    { title: "Web Scraping", description: "Leverage our distributed network to scrape web data efficiently and bypass blocks.", icon: <ScanText size={24}/>, color: 'var(--cxmpute-red)', docLink: "/docs/scraping" }, // Settings as placeholder
    { title: "Tool Use & JSON", description: "Utilize the latest and most capable models with tool use, function calling abilities, and JSON schema support.", icon: <PocketKnife size={24}/>, color: cxmputeYellow, docLink: "/docs/tool-use-json" }, // HelpCircle as placeholder
    { title: "Advanced LLMs", description: "Explore models capable of reasoning, multimodal support, and finetunes for coding and math use cases.", icon: <BrainCircuit size={24}/>, color: cxmputePink, docLink: "/docs/advanced-llms" }, // FileText as placeholder
  ];


  return (
    <div className={styles.userDashboardContainer}>
      {/* Notifications */}
      <NotificationBanner location="user_dashboard" />
      
      {/* Hero Section - using ThemeCard */}
      <ThemeCard className={styles.heroCard}>
        <div className={styles.heroContent}>
          <div className={styles.heroLeft}>
            <h3 className={styles.emailDisplay}>{subject.email}</h3>
            <h1 className={styles.dashboardTitle}>User Dashboard</h1>
            <h2 className={styles.welcomeMessage}>Welcome to Cxmpute! Manage your account and explore services.</h2>
            <div className={styles.heroButtonContainer}>
              <DashboardButton href="/docs" target="_blank" rel="noopener noreferrer" variant="accentPurple" iconLeft={<FileText size={16}/>} text="Documentation" />
              <DashboardButton onClick={() => setIsVirtualKeysModalOpen(true)} variant="accentOrange" iconLeft={<KeyRound size={16}/>} text="Manage API Keys" />
              {/* "Manage Account" could link to a future profile settings page */}
              <DashboardButton href="#" iconLeft={<Settings size={16}/>} text="Manage Account" disabled title="Account management coming soon"/>
            </div>
          </div>
          <div className={styles.heroRight}>
            {/* Top buttons are now part of DashboardToggle, so removed from here */}
            <div className={styles.creditsSection}>
              <h2 className={styles.sectionTitleSmall}>Your Credits</h2>
              {isLoadingSummary ? <SkeletonLoader width={100} height={40} /> : 
                <h1 className={styles.creditsNumber}>{userSummary?.credits.toLocaleString() || '0'}</h1>
              }
              <DashboardButton variant="accentYellow" text="Load Credits (Coming Soon)" disabled/>
            </div>
          </div>
        </div>
      </ThemeCard>

      {/* Referral Section */}
      <ReferralSection 
        userId={subject.id}
        userType="user"
        hasReferrer={false} // TODO: Check if user has a referrer from API
      />

      {/* Bottom Section: Service Cards & Graph/Stats Placeholder */}
      <h2 className={styles.sectionTitle}>Explore Our Services</h2>

      <div className={styles.bottomSection}>
        <div className={styles.serviceCardsContainer}>
            <div className={styles.cardsGrid}>
            {serviceCardsData.map(card => (
                <ThemeCard key={card.title} cardStyle={{ backgroundColor: card.color }} className={styles.serviceCard}>
                    <div className={styles.serviceCardIconWrapper}>{card.icon}</div>
                    <h3 className={styles.serviceCardTitle}>{card.title}</h3>
                    <p className={styles.serviceCardDescription}>{card.description}</p>
                    <div className={styles.serviceCardButtonContainer}>
                        <DashboardButton href={card.docLink} target="_blank" rel="noopener noreferrer" variant="secondary" text="Learn More" size="sm" />
                    </div>
                </ThemeCard>
            ))}
            </div>
        </div>

        <div className={styles.secondaryInfoContainer}>
             <ThemeCard title="Referral Codes" className={styles.referralInfoCard}>
                 <p>Your User ID (for referrals):</p>
                 <div className={styles.codeBox}>
                     <span>{subject.id}</span>
                     <DashboardButton variant="ghost" size="sm" onClick={() => handleCopyReferralCode(subject.id, "User ID")} iconLeft={<Copy size={14}/>} />
                 </div>
            </ThemeCard>

            <ThemeCard title="Rewards" className={styles.rewardsInfoCard}>
                 <BarChart3 size={20} />
                 <p>Total Points Earned:</p>
                 {isLoadingSummary ? <SkeletonLoader width={100} height={30} /> : 
                    <h2 className={styles.rewardsAmount}>{userSummary?.rewards.toLocaleString() || '0'}</h2>
                 }
                 <p className={styles.rewardsHint}>Rewards are typically distributed for platform activities and referrals.</p>
                  <DashboardButton text="Learn more about rewards" href="/docs/rewards" target="_blank" rel="noopener noreferrer" size="sm" style={{ marginTop: '10px' }} variant='primary'/>
            </ThemeCard>
        </div>
      </div>

      {/* Modals */}
      {isViewUserAkModalOpen && (
        <ViewApiKeyModal
          isOpen={isViewUserAkModalOpen}
          onClose={() => setIsViewUserAkModalOpen(false)}
          apiKeyType="User AK"
          currentApiKey={currentUserAk}
          onRefresh={handleRefreshUserAk}
          isLoadingRefresh={isRefreshingUserAk}
          isLoadingKey={isLoadingSummary && !currentUserAk}
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