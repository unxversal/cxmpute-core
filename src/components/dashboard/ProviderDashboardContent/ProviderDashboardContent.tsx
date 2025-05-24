/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/dashboard/ProviderDashboardContent/ProviderDashboardContent.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import styles from './ProviderDashboardContent.module.css';
import Button from '@/components/ui/Button/Button';
import ViewApiKeyModal from '../ViewApiKeyModal/ViewApiKeyModal';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { AuthenticatedUserSubject } from '@/lib/auth';
import type { RewardEntry, ProvisionRecord } from '@/lib/interfaces';
import Link from 'next/link';
import { DollarSign, Server, KeyRound, Copy, Trash2, AlertTriangle, Power } from 'lucide-react';
import SkeletonLoader from '@/components/ui/SkeletonLoader/SkeletonLoader';
import Modal from '@/components/ui/Modal/Modal'; // For delete confirmation

interface ProviderDashboardProps {
  subject: AuthenticatedUserSubject['properties'];
}

interface ProviderEarningsData {
  total: number;
  earnings: RewardEntry[]; // Past 30 days
}

const ProviderDashboardContent: React.FC<ProviderDashboardProps> = ({ subject }) => {
  const [earningsData, setEarningsData] = useState<ProviderEarningsData | null>(null);
  const [provisions, setProvisions] = useState<ProvisionRecord[]>([]);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(true);
  const [isLoadingProvisions, setIsLoadingProvisions] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isViewProviderAkModalOpen, setIsViewProviderAkModalOpen] = useState(false);
  const [isRefreshingProviderAk, setIsRefreshingProviderAk] = useState(false);
  const [currentProviderAk, setCurrentProviderAk] = useState<string | null>(subject.providerAk);

  const [provisionToDelete, setProvisionToDelete] = useState<ProvisionRecord | null>(null);
  const [isDeletingProvision, setIsDeletingProvision] = useState<string | null>(null);


  const fetchProviderDashboardData = useCallback(async (showLoadingToast = false) => {
    if (!subject.providerId) return;

    setIsLoadingEarnings(true);
    setIsLoadingProvisions(true);
    setFetchError(null);
    let loadingToastId: string | undefined;
    if (showLoadingToast) {
        loadingToastId = notify.loading("Refreshing provider data...");
    }

    try {
      const [earningsRes, provisionsRes] = await Promise.all([
        fetch(`/api/providers/${subject.providerId}/earnings`),
        fetch(`/api/providers/${subject.providerId}/provisions`) // NEW API Endpoint
      ]);

      if (!earningsRes.ok) {
        const errData = await earningsRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load earnings data.");
      }
      const earningsJson = await earningsRes.json();
      setEarningsData(earningsJson);

      if (!provisionsRes.ok) {
        const errData = await provisionsRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load provisions data.");
      }
      const provisionsJson = await provisionsRes.json(); // Assuming it returns { items: ProvisionRecord[] } or ProvisionRecord[]
      setProvisions(provisionsJson.items || provisionsJson || []);
      
      if (showLoadingToast) notify.success("Provider data refreshed!");

    } catch (error: any) {
      console.error("Error fetching provider dashboard data:", error);
      setFetchError(error.message || "Could not load provider data.");
      if (showLoadingToast) notify.error(error.message || "Could not refresh data.");
      // Set defaults on error to prevent breaking UI
      if (!earningsData) setEarningsData({ total: 0, earnings: [] });
      if (provisions.length === 0) setProvisions([]);
    } finally {
      setIsLoadingEarnings(false);
      setIsLoadingProvisions(false);
      if (loadingToastId) notify.dismiss(loadingToastId);
    }
  }, [subject.providerId, earningsData, provisions.length]); // Added missing deps

  useEffect(() => {
    fetchProviderDashboardData();
    setCurrentProviderAk(subject.providerAk);
  }, [subject.providerAk, fetchProviderDashboardData]);

  const handleRefreshProviderAk = async (): Promise<string | null> => {
    if (!subject.providerId) return null;
    setIsRefreshingProviderAk(true);
    const loadingToastId = notify.loading("Refreshing Provider API Key...");
    try {
      const response = await fetch(`/api/providers/${subject.providerId}/providerAk/refresh`, { method: 'POST' });
      const data = await response.json();
      notify.dismiss(loadingToastId);
      if (!response.ok) throw new Error(data.error || 'Failed to refresh Provider AK');
      
      setCurrentProviderAk(data.providerAk);
      notify.success("Provider API Key refreshed successfully!");
      return data.providerAk;
    } catch (error: any) {
      notify.dismiss(loadingToastId);
      notify.error(error.message || "Failed to refresh key.");
      return null;
    } finally {
      setIsRefreshingProviderAk(false);
    }
  };
  
  const handleCopyReferralCode = () => {
    navigator.clipboard.writeText(subject.providerId)
      .then(() => notify.success("Referral Code (Provider ID) copied!"))
      .catch(() => notify.error("Failed to copy referral code."));
  };

  const initiateDeleteProvision = (provision: ProvisionRecord) => {
    setProvisionToDelete(provision);
  };

  const confirmDeleteProvision = async () => {
    if (!provisionToDelete || !currentProviderAk) return;
    
    setIsDeletingProvision(provisionToDelete.provisionId);
    const loadingToastId = notify.loading(`Deleting provision ${provisionToDelete.provisionId.substring(0,6)}...`);

    try {
        // This API expects providerAk in the body for auth, not just path param
        const response = await fetch(`/api/providers/delete`, {
            method: 'POST', // or DELETE if your route supports it
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provisionId: provisionToDelete.provisionId,
                providerAk: currentProviderAk, 
            }),
        });
        const result = await response.json();
        notify.dismiss(loadingToastId);
        if (!response.ok) {
            throw new Error(result.error || "Failed to delete provision.");
        }
        notify.success(`Provision ${provisionToDelete.provisionId.substring(0,6)} deleted successfully.`);
        fetchProviderDashboardData(); // Refresh list
    } catch (err: any) {
        notify.dismiss(loadingToastId);
        console.error("Error deleting provision:", err);
        notify.error(err.message || "Could not delete provision.");
    } finally {
        setProvisionToDelete(null);
        setIsDeletingProvision(null);
    }
  };


  return (
    <div className={styles.dashboardContentGrid}>
      {/* Provider Actions & Info Column */}
      <div className={`${styles.infoCard} ${styles.providerActionsCard}`}>
        <h3 className={styles.cardTitle}><KeyRound size={20}/> Provider Settings</h3>
        <div className={styles.keyActionItem}>
          <p>Your primary Provider API Key for node authentication.</p>
          <Button variant="secondary" size="sm" onClick={() => setIsViewProviderAkModalOpen(true)}>
            View Provider AK
          </Button>
        </div>
        <div className={styles.keyActionItem}>
            <p>Share your Provider ID for referrals or support.</p>
            <div className={styles.referralCodeBox}>
                <span className={styles.referralCodeText} title={subject.providerId}>{subject.providerId}</span>
               <Button variant="ghost" size="sm" onClick={handleCopyReferralCode} iconLeft={<Copy size={14}/>}>
                    Copy Referral Code
                </Button>
            </div>
        </div>
        <Link href="/download" passHref legacyBehavior>
            <a className={styles.fullWidthLinkButton}>
                <Button variant="primary" size="md" className={styles.fullWidthButton} iconLeft={<Power size={16}/>}>
                    Download Provider App / Add New Provision
                </Button>
            </a>
        </Link>
      </div>

      {/* Earnings Card */}
      <div className={`${styles.infoCard} ${styles.earningsCard}`}>
        <h3 className={styles.cardTitle}><DollarSign size={20}/> Earnings</h3>
        {isLoadingEarnings ? (
          <>
            <SkeletonLoader width="60%" height="24px" style={{ marginBottom: '10px' }} />
            <SkeletonLoader count={3} height="16px" />
          </>
        ) : fetchError ? (
          <p className={styles.errorTextSmall}>{fetchError}</p>
        ) : earningsData ? (
          <>
            <div className={styles.totalEarnings}>
              Total Earned: <span className={styles.earningsValue}>{earningsData.total.toLocaleString()} CXPT</span>
            </div>
            <h4 className={styles.subHeading}>Recent Earnings (Last 30 Days):</h4>
            {earningsData.earnings.length > 0 ? (
              <ul className={styles.earningsList}>
                {earningsData.earnings.slice(-7).reverse().map(entry => ( // Show last 7 days
                  <li key={entry.day}>
                    <span>{new Date(entry.day + "T00:00:00Z").toLocaleDateString(undefined, { month:'short', day:'numeric'})}:</span>
                    <span>{entry.amount.toLocaleString()} CXPT</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.noDataText}>No earnings recorded yet.</p>
            )}
          </>
        ) : null}
      </div>

      {/* Provisions Card - Spans full width if only two columns, or takes its place in 3-col */}
      <div className={`${styles.infoCard} ${styles.provisionsCard}`}>
        <h3 className={styles.cardTitle}><Server size={20}/> My Provisions ({provisions.length})</h3>
        {isLoadingProvisions ? (
          <div className={styles.provisionList}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={`skel-prov-${i}`} className={styles.provisionItemSkeleton}>
                <SkeletonLoader count={2} />
                <SkeletonLoader width={80} height={28} />
              </div>
            ))}
          </div>
        ) : fetchError && provisions.length === 0 ? ( // Show error only if no provisions loaded
            <div className={styles.errorMessageContainer}>
              <AlertTriangle size={24} /> <p>{fetchError}</p>
            </div>
        ) : provisions.length === 0 ? (
          <p className={styles.noDataText}>No active provisions found. Download the app to start providing!</p>
        ) : (
          <div className={styles.provisionList}>
            {provisions.map(provision => (
              <div key={provision.provisionId} className={styles.provisionItem}>
                <div className={styles.provisionInfo}>
                  <span className={styles.provisionId} title={provision.provisionId}>ID: {provision.provisionId.substring(0, 12)}...</span>
                  <span className={styles.provisionMeta}>
                    Type: {provision.deviceDiagnostics?.type || 'N/A'}
                    {provision.deviceDiagnostics?.compute?.gpu && ` (${provision.deviceDiagnostics.compute.gpu.name.substring(0,15)}...)`}
                  </span>
                  <span className={styles.provisionMeta}>
                    Location: {provision.location?.city || 'N/A'}, {provision.location?.country || 'N/A'}
                  </span>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => initiateDeleteProvision(provision)}
                  isLoading={isDeletingProvision === provision.provisionId}
                  disabled={!!isDeletingProvision}
                  iconLeft={<Trash2 size={14}/>}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
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
        />
      )}
      {provisionToDelete && (
        <Modal
          isOpen={!!provisionToDelete}
          onClose={() => setProvisionToDelete(null)}
          title={`Confirm Delete Provision`}
          size="sm"
        >
            <p className={styles.confirmDeleteText}>
                Are you sure you want to delete provision <strong>{provisionToDelete.provisionId.substring(0,8)}...</strong>?
            </p>
            <p className={styles.confirmDeleteWarning}>
                This will remove it from the network. This action cannot be undone.
            </p>
            <div className={styles.deleteModalFooter}>
                <Button variant="outline" onClick={() => setProvisionToDelete(null)} disabled={!!isDeletingProvision}>Cancel</Button>
                <Button variant="danger" onClick={confirmDeleteProvision} isLoading={!!isDeletingProvision} disabled={!!isDeletingProvision}>Yes, Delete Provision</Button>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default ProviderDashboardContent;