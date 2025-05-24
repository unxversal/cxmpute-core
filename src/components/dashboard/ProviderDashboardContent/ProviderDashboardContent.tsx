/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/dashboard/ProviderDashboardContent/ProviderDashboardContent.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import styles from './ProviderDashboardContent.module.css'; // Will use revised CSS
import DashboardButton from '../DashboardButton/DashboardButton';
import ThemeCard from '../ThemeCard/ThemeCard';
import ViewApiKeyModal from '../ViewApiKeyModal/ViewApiKeyModal';
import ThemeModal from '../ThemeModal/ThemeModal'; // For delete confirmation
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { AuthenticatedUserSubject } from '@/lib/auth';
import type { RewardEntry, ProvisionRecord } from '@/lib/interfaces';
import Link from 'next/link';
import { Server, KeyRound, RefreshCcw, Trash2, AlertTriangle, HelpCircle, FileText } from 'lucide-react';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';

interface ProviderDashboardProps {
  subject: AuthenticatedUserSubject['properties'];
}

interface ProviderEarningsData {
  total: number;
  earnings: RewardEntry[];
}

const ProviderDashboardContent: React.FC<ProviderDashboardProps> = ({ subject }) => {
  const [earningsData, setEarningsData] = useState<ProviderEarningsData | null>(null);
  const [provisions, setProvisions] = useState<ProvisionRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState({ earnings: true, provisions: true });
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isViewProviderAkModalOpen, setIsViewProviderAkModalOpen] = useState(false);
  const [isRefreshingProviderAk, setIsRefreshingProviderAk] = useState(false);
  const [currentProviderAk, setCurrentProviderAk] = useState<string | null>(subject.providerAk);

  const [provisionToDelete, setProvisionToDelete] = useState<ProvisionRecord | null>(null);
  const [isDeletingProvisionId, setIsDeletingProvisionId] = useState<string | null>(null);

  const fetchProviderDashboardData = useCallback(async (showLoadingToast = false) => {
    if (!subject.providerId) {
        setFetchError("Provider ID not found in your account.");
        setIsLoadingData({ earnings: false, provisions: false });
        return;
    }

    setIsLoadingData({ earnings: true, provisions: true });
    setFetchError(null);
    let loadingToastId: string | undefined;
    if (showLoadingToast) {
        loadingToastId = notify.loading("Refreshing provider data...");
    }

    try {
      const [earningsRes, provisionsRes] = await Promise.all([
        fetch(`/api/providers/${subject.providerId}/earnings`),
        fetch(`/api/providers/${subject.providerId}/provisions`)
      ]);

      let earningsError = null;
      let provisionsError = null;

      if (!earningsRes.ok) {
        const errData = await earningsRes.json().catch(() => ({}));
        earningsError = errData.error || "Failed to load earnings data.";
        console.error("Earnings fetch error:", earningsError);
        setEarningsData({ total: 0, earnings: [] }); // Set default on error
      } else {
        const earningsJson = await earningsRes.json();
        setEarningsData(earningsJson);
      }

      if (!provisionsRes.ok) {
        const errData = await provisionsRes.json().catch(() => ({}));
        provisionsError = errData.error || "Failed to load provisions data.";
        console.error("Provisions fetch error:", provisionsError);
        setProvisions([]); // Set default on error
      } else {
        const provisionsJson = await provisionsRes.json();
        setProvisions(provisionsJson.items || provisionsJson || []);
      }
      
      if (earningsError || provisionsError) {
          const combinedError = [earningsError, provisionsError].filter(Boolean).join(' ');
          setFetchError(combinedError);
          if (showLoadingToast) notify.error(combinedError || "Failed to refresh some data.", { id: loadingToastId });
      } else if (showLoadingToast) {
          notify.success("Provider data refreshed!", { id: loadingToastId });
      }

    } catch (error: any) {
      console.error("Error fetching provider dashboard data:", error);
      const errorMessage = error.message || "Could not load provider data.";
      setFetchError(errorMessage);
      if (showLoadingToast) notify.error(errorMessage, { id: loadingToastId });
      if (!earningsData) setEarningsData({ total: 0, earnings: [] });
      if (provisions.length === 0) setProvisions([]);
    } finally {
      setIsLoadingData({ earnings: false, provisions: false });
      if (loadingToastId && !showLoadingToast) notify.dismiss(loadingToastId);
    }
  }, [subject.providerId, earningsData, provisions.length]); // Dependencies updated

  useEffect(() => {
    fetchProviderDashboardData();
    setCurrentProviderAk(subject.providerAk);
  }, [subject.providerId, subject.providerAk, fetchProviderDashboardData]);


  const handleRefreshProviderAk = async () => { /* ... (same as UserDashboardContent) ... */
    if (!subject.providerId) return;
    setIsRefreshingProviderAk(true);
    const loadingToastId = notify.loading("Refreshing Provider API Key...");
    try {
      const response = await fetch(`/api/providers/${subject.providerId}/providerAk/refresh`, { method: 'POST' });
      const data = await response.json();
      notify.dismiss(loadingToastId);
      if (!response.ok) throw new Error(data.error || 'Failed to refresh Provider AK');
      setCurrentProviderAk(data.providerAk);
      notify.success("Provider API Key refreshed successfully!");
    } catch (error: any) {
      notify.dismiss(loadingToastId);
      notify.error(error.message || "Failed to refresh key.");
    } finally {
      setIsRefreshingProviderAk(false);
    }
  };

  const initiateDeleteProvision = (provision: ProvisionRecord) => {
    setProvisionToDelete(provision);
  };

  const confirmDeleteProvision = async () => {
    if (!provisionToDelete || !currentProviderAk) return;
    
    setIsDeletingProvisionId(provisionToDelete.provisionId);
    const loadingToastId = notify.loading(`Deleting provision ${provisionToDelete.provisionId.substring(0,6)}...`);

    try {
        const response = await fetch(`/api/providers/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provisionId: provisionToDelete.provisionId,
                providerAk: currentProviderAk, 
            }),
        });
        notify.dismiss(loadingToastId);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to delete provision.");
        notify.success(`Provision ${provisionToDelete.provisionId.substring(0,6)} deleted successfully.`);
        fetchProviderDashboardData();
    } catch (err: any) {
        notify.dismiss(loadingToastId);
        console.error("Error deleting provision:", err);
        notify.error(err.message || "Could not delete provision.");
    } finally {
        setProvisionToDelete(null);
        setIsDeletingProvisionId(null);
    }
  };


  return (
    <div className={styles.providerDashboardContainer}>
      {/* Hero Section - using ThemeCard */}
      <ThemeCard className={styles.heroCard}>
        <div className={styles.heroContent}>
          <div className={styles.heroLeft}>
            <h3 className={styles.emailDisplay}>{subject.email}</h3>
            <h1 className={styles.dashboardTitle}>Provider Dashboard</h1>
            <h2 className={styles.welcomeMessage}>Manage your compute provisions and track earnings.</h2>
            <div className={styles.heroButtonContainer}>
              <DashboardButton href="/docs/provider" target="_blank" rel="noopener noreferrer" variant="accentPurple" iconLeft={<FileText size={16}/>} text="Provider Docs" />
              <DashboardButton onClick={() => setIsViewProviderAkModalOpen(true)} variant="accentOrange" iconLeft={<KeyRound size={16}/>} text="View Provider AK" />
              <DashboardButton href="/maximize" target="_blank" rel="noopener noreferrer" variant="accentYellow" iconLeft={<HelpCircle size={16}/>} text="Maximize Earnings" />
            </div>
          </div>
          <div className={styles.heroRight}>
            {/* Top buttons are handled by DashboardToggle, removed from here */}
            <div className={styles.earningsSummarySection}>
              <h2 className={styles.sectionTitleSmall}>Total Earnings</h2>
              {isLoadingData.earnings ? <SkeletonLoader width={120} height={40} /> :
                <h1 className={styles.earningsNumber}>
                  {(earningsData?.total || 0).toLocaleString()} <span className={styles.cxptSymbol}>CXPT</span>
                </h1>
              }
              {/* Withdraw functionality might be added here later */}
              <DashboardButton text="Withdraw (Coming Soon)" disabled />
            </div>
          </div>
        </div>
      </ThemeCard>

      {/* Bottom Section: Provisions & Earnings Graph/Details */}
      <div className={styles.bottomSection}>
        <div className={styles.provisionsListContainer}>
          <ThemeCard title="My Provisions" className={styles.fullHeightCard}
            headerActions={
                <DashboardButton
                    variant="ghost" size="sm"
                    onClick={() => fetchProviderDashboardData(true)}
                    isLoading={isLoadingData.provisions && provisions.length > 0}
                    disabled={isLoadingData.provisions}
                    iconLeft={<RefreshCcw size={14} />}
                    text="Refresh"
                />
            }
          >
            {isLoadingData.provisions && provisions.length === 0 ? (
              <div className={styles.provisionItemSkeletonContainer}>
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={`skel-prov-${i}`} className={styles.provisionItemSkeleton}>
                    <div><SkeletonLoader count={1} width="60%" height="18px"/><SkeletonLoader count={1} width="80%" height="14px"/></div>
                    <SkeletonLoader width={80} height={30}/>
                  </div>
                ))}
              </div>
            ) : fetchError && provisions.length === 0 ? (
              <div className={styles.messageContainer}>
                <AlertTriangle size={28} className={styles.errorIcon} /> <p>{fetchError}</p>
              </div>
            ) : provisions.length === 0 ? (
              <div className={styles.messageContainer}>
                <Server size={28} className={styles.emptyIcon}/>
                <p>No active provisions found.</p>
                <Link href="/download" passHref legacyBehavior>
                    <a><DashboardButton variant="primary" text="Add Your First Provision"/></a>
                </Link>
              </div>
            ) : (
              <div className={styles.provisionListScrollable}>
                {provisions.map(provision => (
                  <div key={provision.provisionId} className={styles.provisionItem}>
                    <div className={styles.provisionInfo}>
                      <span className={styles.provisionId} title={provision.provisionId}>
                        <Server size={16} className={styles.provisionIcon}/> {provision.provisionId.substring(0, 10)}...
                      </span>
                      <span className={styles.provisionMeta}>
                        Type: {provision.deviceDiagnostics?.type || 'N/A'}
                        {provision.deviceDiagnostics?.compute.gpu && ` | GPU: ${provision.deviceDiagnostics.compute.gpu.name.substring(0,12)}...`}
                      </span>
                      <span className={styles.provisionMeta}>
                        Location: {provision.location?.city || 'Unknown City'}, {provision.location?.country || 'Unknown Country'}
                      </span>
                      {/* Placeholder for assigned models/services */}
                      {/* <span className={styles.provisionMeta}>Services: LLM, Embeddings</span> */}
                    </div>
                    <DashboardButton
                      variant="danger" size="sm"
                      onClick={() => initiateDeleteProvision(provision)}
                      isLoading={isDeletingProvisionId === provision.provisionId}
                      disabled={!!isDeletingProvisionId}
                      iconLeft={<Trash2 size={14}/>}
                      text="Delete"
                    />
                  </div>
                ))}
              </div>
            )}
          </ThemeCard>
        </div>

        <div className={styles.earningsDetailContainer}>
          <ThemeCard title="Earnings Breakdown" className={styles.fullHeightCard}>
            {isLoadingData.earnings ? <SkeletonLoader count={5} height="20px" /> :
             fetchError && !earningsData ? <p className={styles.errorTextSmall}>{fetchError}</p> :
             earningsData && earningsData.earnings.length > 0 ? (
              <div className={styles.earningsListScrollable}>
                <div className={styles.earningsListHeader}>
                    <span>Date</span>
                    <span>Amount (CXPT)</span>
                </div>
                {earningsData.earnings.slice().reverse().map(entry => ( // Show newest first
                  <div key={entry.day} className={styles.earningRow}>
                    <span>{new Date(entry.day + "T00:00:00Z").toLocaleDateString(undefined, {year:'2-digit', month:'short', day:'numeric'})}</span>
                    <span className={styles.earningAmount}>+{entry.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.noDataTextSmall}>No recent earnings to display.</p>
            )}
            {/* Placeholder for earnings chart */}
            {/* <div className={styles.graphPlaceholder}>Earnings Chart Coming Soon</div> */}
          </ThemeCard>
        </div>
      </div>

      {/* Modals */}
      {isViewProviderAkModalOpen && (
        <ViewApiKeyModal
          isOpen={isViewProviderAkModalOpen}
          onClose={() => setIsViewProviderAkModalOpen(false)}
          apiKeyType="Provider AK"
          currentApiKey={currentProviderAk}
          onRefresh={handleRefreshProviderAk}
          isLoadingRefresh={isRefreshingProviderAk}
          isLoadingKey={isLoadingData.earnings && !currentProviderAk}
        />
      )}
      {provisionToDelete && (
        <ThemeModal
          isOpen={!!provisionToDelete}
          onClose={() => setProvisionToDelete(null)}
          title={
            <span className={styles.modalTitleCustom}>
                <AlertTriangle size={22} className={styles.titleIconDelete}/> Confirm Delete Provision
            </span> as unknown as string
          }
          size="sm"
          footerContent={
            <>
                <DashboardButton variant="secondary" onClick={() => setProvisionToDelete(null)} disabled={!!isDeletingProvisionId} text="Cancel"/>
                <DashboardButton variant="danger" onClick={confirmDeleteProvision} isLoading={!!isDeletingProvisionId} disabled={!!isDeletingProvisionId} text="Yes, Delete"/>
            </>
          }
        >
          <div className={styles.deleteConfirmContent}>
            <p>
                Are you sure you want to delete provision <code className={styles.codeStyled}>{provisionToDelete.provisionId.substring(0,12)}...</code>?
            </p>
            <p className={styles.deleteConfirmWarning}>
                This will remove it from all service pools and it will stop earning rewards. This action cannot be undone.
            </p>
          </div>
        </ThemeModal>
      )}
    </div>
  );
};

export default ProviderDashboardContent;