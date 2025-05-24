/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/dashboard/ProviderDashboardContent/ProviderDashboardContent.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import styles from './ProviderDashboardContent.module.css';
import DashboardButton from '../DashboardButton/DashboardButton';
import ThemeCard from '../ThemeCard/ThemeCard';
import ViewApiKeyModal from '../ViewApiKeyModal/ViewApiKeyModal';
import ThemeModal from '../ThemeModal/ThemeModal';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { AuthenticatedUserSubject } from '@/lib/auth';
import type { RewardEntry, ProvisionRecord } from '@/lib/interfaces';
import Link from 'next/link';
import { Server, KeyRound, RefreshCcw, Trash2, AlertTriangle, Power, HelpCircle, FileText, Loader } from 'lucide-react'; // Added Loader2

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
  
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isViewProviderAkModalOpen, setIsViewProviderAkModalOpen] = useState(false);
  const [isRefreshingProviderAk, setIsRefreshingProviderAk] = useState(false);
  const [currentProviderAk, setCurrentProviderAk] = useState<string | null>(subject.providerAk);

  const [provisionToDelete, setProvisionToDelete] = useState<ProvisionRecord | null>(null);
  const [isDeletingProvisionId, setIsDeletingProvisionId] = useState<string | null>(null);

  const fetchProviderDashboardData = useCallback(async (isRefreshAction = false) => {
    if (!subject.providerId) {
      setFetchError("Provider ID not found in your account. Please ensure you are registered as a provider.");
      setIsInitialLoading(false);
      return;
    }

    if (!isRefreshAction) {
      setIsInitialLoading(true);
    } else {
      setIsRefreshingData(true);
    }
    setFetchError(null);
    let loadingToastId: string | undefined;
    if (isRefreshAction) {
      loadingToastId = notify.loading("Refreshing provider data...");
    }

    try {
      const [earningsRes, provisionsRes] = await Promise.all([
        fetch(`/api/providers/${subject.providerId}/earnings`),
        fetch(`/api/providers/${subject.providerId}/provisions`)
      ]);

      let earningsError = null;
      let provisionsError = null;
      let newEarningsData: ProviderEarningsData | null = null;
      let newProvisionsData: ProvisionRecord[] = [];

      if (!earningsRes.ok) {
        const errData = await earningsRes.json().catch(() => ({}));
        earningsError = errData.error || "Failed to load earnings data.";
        console.error("Earnings fetch error:", earningsError);
      } else {
        newEarningsData = await earningsRes.json();
      }

      if (!provisionsRes.ok) {
        const errData = await provisionsRes.json().catch(() => ({}));
        provisionsError = errData.error || "Failed to load provisions data.";
        console.error("Provisions fetch error:", provisionsError);
      } else {
        const provisionsJson = await provisionsRes.json();
        newProvisionsData = provisionsJson.items || provisionsJson || [];
      }
      
      if (newEarningsData !== null || !isRefreshAction) {
        setEarningsData(newEarningsData || { total: 0, earnings: [] });
      }
      if (newProvisionsData.length > 0 || !isRefreshAction) {
        setProvisions(newProvisionsData);
      }

      const combinedError = [earningsError, provisionsError].filter(Boolean).join(' ');
      if (combinedError) {
        setFetchError(combinedError);
        if (isRefreshAction && loadingToastId) notify.error(combinedError || "Failed to refresh some data.", { id: loadingToastId });
        else if (isRefreshAction) notify.error(combinedError || "Failed to refresh some data.");
      } else if (isRefreshAction && loadingToastId) {
        notify.success("Provider data refreshed!", { id: loadingToastId });
      } else if (isRefreshAction) {
        notify.success("Provider data refreshed!");
      }

    } catch (error: any) {
      console.error("Error fetching provider dashboard data:", error);
      const errorMessage = error.message || "Could not load provider data.";
      setFetchError(errorMessage);
      if (isRefreshAction && loadingToastId) notify.error(errorMessage, { id: loadingToastId });
      else if (isRefreshAction) notify.error(errorMessage);
      if (!earningsData && !isRefreshAction) setEarningsData({ total: 0, earnings: [] }); // Ensure defaults if initial load failed completely
      if (provisions.length === 0 && !isRefreshAction) setProvisions([]);
    } finally {
      setIsInitialLoading(false);
      setIsRefreshingData(false);
      if (loadingToastId && isRefreshAction && !fetchError && !isInitialLoading) {
         notify.dismiss(loadingToastId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.providerId]); // Removed earningsData, provisions.length, fetchError as they could cause loops

  useEffect(() => {
    fetchProviderDashboardData(false);
    setCurrentProviderAk(subject.providerAk);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.providerId, subject.providerAk]);

  const handleRefreshProviderAk = async () => { /* ... (same) ... */
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
  
  // const handleCopyProviderId = () => { /* ... (same) ... */
  //   navigator.clipboard.writeText(subject.providerId)
  //     .then(() => notify.success("Provider ID copied!"))
  //     .catch(() => notify.error("Failed to copy Provider ID."));
  // };
  const initiateDeleteProvision = (provision: ProvisionRecord) => { /* ... (same) ... */
    setProvisionToDelete(provision);
  };
  const confirmDeleteProvision = async () => { /* ... (same, ensure fetchProviderDashboardData(true) is called on success) ... */
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
      fetchProviderDashboardData(true);
    } catch (err: any) {
      notify.dismiss(loadingToastId);
      console.error("Error deleting provision:", err);
      notify.error(err.message || "Could not delete provision.");
    } finally {
      setProvisionToDelete(null);
      setIsDeletingProvisionId(null);
    }
  };

  // --- Content Render Logic ---
  const renderEarningsContent = () => {
    if (isInitialLoading) {
      return (
        <>
          <div className={styles.totalEarnings}>Total Earned: <span className={styles.loadingPlaceholderText}>---</span></div>
          <h4 className={styles.subHeading}>Recent Earnings (Last 30 Days):</h4>
          <div className={`${styles.earningsListScrollable} ${styles.loadingPlaceholderContainer}`}>
            <Loader size={24} className={styles.spinningIcon} />
            <p>Loading earnings...</p>
          </div>
        </>
      );
    }
    if (fetchError && !earningsData?.earnings?.length) { // Show error if no data to display
      return <p className={styles.errorTextSmall}>{fetchError.includes("earnings") || fetchError.includes("Provider ID") ? fetchError : "Error loading earnings."}</p>;
    }
    if (earningsData) {
      return (
        <>
          <div className={styles.totalEarnings}>
            Total Earned: <span className={styles.earningsValue}>{(earningsData.total || 0).toLocaleString()} CXPT</span>
          </div>
          <h4 className={styles.subHeading}>Recent Earnings (Last 30 Days):</h4>
          {earningsData.earnings.length > 0 ? (
            <div className={styles.earningsListScrollable}>
              <div className={styles.earningsListHeader}>
                <span>Date</span>
                <span>Amount (CXPT)</span>
              </div>
              {earningsData.earnings.slice().reverse().map(entry => (
                <div key={entry.day} className={styles.earningRow}>
                  <span>{new Date(entry.day + "T00:00:00Z").toLocaleDateString(undefined, {year:'2-digit', month:'short', day:'numeric'})}</span>
                  <span className={styles.earningAmount}>+{entry.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.noDataTextSmall}>No recent earnings to display.</p>
          )}
        </>
      );
    }
    return <p className={styles.noDataTextSmall}>Earnings data unavailable.</p>;
  };

  const renderProvisionsContent = () => {
    if (isInitialLoading) {
      return (
        <div className={`${styles.provisionListScrollable} ${styles.loadingPlaceholderContainer}`}>
          <Loader size={24} className={styles.spinningIcon} />
          <p>Loading provisions...</p>
        </div>
      );
    }
    if (fetchError && provisions.length === 0) { // Show error if no data to display
      return (
        <div className={styles.messageContainer}>
          <AlertTriangle size={28} className={styles.errorIcon} />
          <p>{fetchError.includes("provisions") || fetchError.includes("Provider ID") ? fetchError : "Error loading provisions."}</p>
        </div>
      );
    }
    if (provisions.length === 0) {
      return (
        <div className={styles.messageContainer}>
          <Server size={28} className={styles.emptyIcon}/>
          <p>No active provisions found.</p>
          <Link href="/download" passHref legacyBehavior>
            <a><DashboardButton variant="primary" text="Add Your First Provision" iconLeft={<Power size={16}/>}/></a>
          </Link>
        </div>
      );
    }
    return (
      <div className={styles.provisionListScrollable}>
        {provisions.map(provision => (
          <div key={provision.provisionId} className={styles.provisionItem}>
            <div className={styles.provisionInfo}>
              <span className={styles.provisionId} title={provision.provisionId}>
                <Server size={16} className={styles.provisionIcon}/> {provision.provisionId.substring(0, 10)}...
              </span>
              <span className={styles.provisionMeta}>
                Type: {provision.deviceDiagnostics?.type || 'N/A'}
                {provision.deviceDiagnostics?.compute?.gpu && ` (${provision.deviceDiagnostics.compute.gpu.name.substring(0,15)}...)`}
              </span>
              <span className={styles.provisionMeta}>
                Location: {provision.location?.city || 'Unknown'}, {provision.location?.country || 'N/A'}
              </span>
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
    );
  };

  return (
    <div className={styles.providerDashboardContainer}>
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
            <div className={styles.earningsSummarySection}>
              <h2 className={styles.sectionTitleSmall}>Total Earnings</h2>
              {isInitialLoading || isRefreshingData ? <span className={styles.earningsNumberLoading}><Loader size={30} className={styles.spinningIconLarge}/></span> :
                <h1 className={styles.earningsNumber}>
                  {(earningsData?.total || 0).toLocaleString()} <span className={styles.cxptSymbol}>CXPT</span>
                </h1>
              }
              <DashboardButton text="Withdraw (Coming Soon)" disabled />
            </div>
          </div>
        </div>
      </ThemeCard>

      <div className={styles.bottomSection}>
        <div className={styles.provisionsListContainer}>
          <ThemeCard title="My Provisions" className={styles.fullHeightCard}
            headerActions={
                <DashboardButton
                    variant="ghost" size="sm"
                    onClick={() => fetchProviderDashboardData(true)}
                    isLoading={isRefreshingData && !isInitialLoading} // Show loading on button only if it's a refresh action
                    disabled={isInitialLoading || isRefreshingData}
                    iconLeft={<RefreshCcw size={14} />}
                    text="Refresh"
                />
            }
          >
            {renderProvisionsContent()}
          </ThemeCard>
        </div>

        <div className={styles.earningsDetailContainer}>
          <ThemeCard title="Earnings Breakdown" className={styles.fullHeightCard}>
            {renderEarningsContent()}
          </ThemeCard>
        </div>
      </div>

      {isViewProviderAkModalOpen && (
        <ViewApiKeyModal
          isOpen={isViewProviderAkModalOpen}
          onClose={() => setIsViewProviderAkModalOpen(false)}
          apiKeyType="Provider AK"
          currentApiKey={currentProviderAk}
          onRefresh={handleRefreshProviderAk}
          isLoadingRefresh={isRefreshingProviderAk}
          isLoadingKey={isInitialLoading && !currentProviderAk}
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