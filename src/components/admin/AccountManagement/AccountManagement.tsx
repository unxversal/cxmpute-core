"use client";

import React, { useState, useEffect } from 'react';
import styles from './AccountManagement.module.css';
import ThemeCard from '@/components/dashboard/ThemeCard/ThemeCard';
import DashboardButton from '@/components/dashboard/DashboardButton/DashboardButton';
import { Search, User, Building, AlertTriangle, Ban, Trash2, Shield, Clock } from 'lucide-react';

interface AccountManagementProps {
  adminId: string;
}

interface AccountResult {
  id: string;
  email: string;
  type: 'user' | 'provider';
  createdDate?: string;
  lastActive?: string;
  totalCredits?: number;
  totalEarnings?: number;
  isActive?: boolean;
}

interface SuspendedAccount {
  accountId: string;
  accountType: 'user' | 'provider';
  suspendedDate: string;
  suspendedBy: string;
  reason: string;
  isActive: boolean;
}

interface ConfirmModalData {
  type: 'suspend' | 'delete';
  account: AccountResult;
  isOpen: boolean;
}

const AccountManagement: React.FC<AccountManagementProps> = ({ adminId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AccountResult[]>([]);
  const [suspendedAccounts, setSuspendedAccounts] = useState<SuspendedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [suspendedLoading, setSuspendedLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalData>({ type: 'suspend', account: {} as AccountResult, isOpen: false });
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Load suspended accounts on mount
  useEffect(() => {
    fetchSuspendedAccounts();
  }, []);

  const fetchSuspendedAccounts = async () => {
    setSuspendedLoading(true);
    try {
      const response = await fetch('/api/admin/suspended-accounts');
      if (response.ok) {
        const data = await response.json();
        setSuspendedAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching suspended accounts:', error);
    } finally {
      setSuspendedLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/search-accounts?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.accounts || []);
      }
    } catch (error) {
      console.error('Error searching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const openConfirmModal = (type: 'suspend' | 'delete', account: AccountResult) => {
    setConfirmModal({ type, account, isOpen: true });
    setActionReason('');
  };

  const closeConfirmModal = () => {
    setConfirmModal({ type: 'suspend', account: {} as AccountResult, isOpen: false });
    setActionReason('');
  };

  const handleSuspendAccount = async () => {
    if (!actionReason.trim()) return;
    
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/suspend-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: confirmModal.account.id,
          accountType: confirmModal.account.type,
          reason: actionReason,
          adminId
        })
      });

      if (response.ok) {
        // Refresh suspended accounts and search results
        fetchSuspendedAccounts();
        if (searchQuery) handleSearch();
        closeConfirmModal();
      }
    } catch (error) {
      console.error('Error suspending account:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: confirmModal.account.id,
          accountType: confirmModal.account.type,
          adminId
        })
      });

      if (response.ok) {
        // Refresh search results and suspended accounts
        if (searchQuery) handleSearch();
        fetchSuspendedAccounts();
        closeConfirmModal();
      }
    } catch (error) {
      console.error('Error deleting account:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspendAccount = async (accountId: string, accountType: string) => {
    try {
      const response = await fetch('/api/admin/unsuspend-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, accountType, adminId })
      });

      if (response.ok) {
        fetchSuspendedAccounts();
        if (searchQuery) handleSearch();
      }
    } catch (error) {
      console.error('Error unsuspending account:', error);
    }
  };

  const isAccountSuspended = (accountId: string) => {
    return suspendedAccounts.some(suspended => suspended.accountId === accountId && suspended.isActive);
  };

  return (
    <div className={styles.accountManagementContainer}>
      {/* Search Section */}
      <ThemeCard className={styles.searchCard}>
        <div className={styles.searchSection}>
          <h3>🔍 Search Accounts</h3>
          <p>Search for users and providers by email, ID, or other criteria</p>
          
          <div className={styles.searchInputGroup}>
            <input
              type="text"
              placeholder="Enter email, user ID, provider ID..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <DashboardButton
              variant="primary"
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
              iconLeft={<Search size={16} />}
              text={loading ? "Searching..." : "Search"}
            />
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className={styles.searchResults}>
              <h4>Search Results ({searchResults.length})</h4>
              <div className={styles.resultsGrid}>
                {searchResults.map((account) => (
                  <div key={account.id} className={styles.accountCard}>
                    <div className={styles.accountInfo}>
                      <div className={styles.accountHeader}>
                        <div className={styles.accountType}>
                          {account.type === 'user' ? (
                            <><User size={14} />User</>
                          ) : (
                            <><Building size={14} />Provider</>
                          )}
                        </div>
                        {isAccountSuspended(account.id) && (
                          <div className={styles.suspendedBadge}>
                            <Ban size={14} />Suspended
                          </div>
                        )}
                      </div>
                      <p className={styles.accountEmail}>{account.email}</p>
                      <p className={styles.accountId}>ID: {account.id}</p>
                    </div>
                    
                    <div className={styles.accountActions}>
                      {!isAccountSuspended(account.id) ? (
                        <DashboardButton
                          variant="accentOrange"
                          onClick={() => openConfirmModal('suspend', account)}
                          iconLeft={<Ban size={14} />}
                          text="Suspend"
                        />
                      ) : (
                        <DashboardButton
                          variant="secondary"
                          onClick={() => handleUnsuspendAccount(account.id, account.type)}
                          iconLeft={<Shield size={14} />}
                          text="Unsuspend"
                        />
                      )}
                      <DashboardButton
                        variant="danger"
                        onClick={() => openConfirmModal('delete', account)}
                        iconLeft={<Trash2 size={14} />}
                        text="Delete"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ThemeCard>

      {/* Suspended Accounts Section */}
      <ThemeCard className={styles.suspendedCard}>
        <h3>🚫 Suspended Accounts</h3>
        <p>Currently suspended user and provider accounts</p>
        
        {suspendedLoading ? (
          <div className={styles.loadingState}>Loading suspended accounts...</div>
        ) : suspendedAccounts.length === 0 ? (
          <div className={styles.emptyState}>
            <Shield size={48} />
            <p>No suspended accounts</p>
          </div>
        ) : (
          <div className={styles.suspendedList}>
            {suspendedAccounts.map((suspended) => (
              <div key={suspended.accountId} className={styles.suspendedItem}>
                <div className={styles.suspendedInfo}>
                  <div className={styles.suspendedHeader}>
                    <div className={styles.suspendedType}>
                      {suspended.accountType === 'user' ? 'User' : 'Provider'}
                    </div>
                    <span className={styles.suspendedId}>{suspended.accountId}</span>
                  </div>
                  <p className={styles.suspendedReason}><strong>Reason:</strong> {suspended.reason}</p>
                  <p className={styles.suspendedDate}>
                    <Clock size={14} />
                    Suspended: {new Date(suspended.suspendedDate).toLocaleDateString()}
                  </p>
                </div>
                <DashboardButton
                  variant="secondary"
                  onClick={() => handleUnsuspendAccount(suspended.accountId, suspended.accountType)}
                  iconLeft={<Shield size={14} />}
                  text="Unsuspend"
                />
              </div>
            ))}
          </div>
        )}
      </ThemeCard>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className={styles.modalOverlay} onClick={closeConfirmModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                {confirmModal.type === 'suspend' ? (
                  <><Ban size={20} />Suspend Account</>
                ) : (
                  <><Trash2 size={20} />Delete Account</>
                )}
              </h3>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.warningText}>
                <AlertTriangle size={20} />
                <div>
                  <p><strong>Warning!</strong></p>
                  <p>
                    You are about to {confirmModal.type} the {confirmModal.account.type} account:
                  </p>
                </div>
              </div>
              
              <p><strong>Email:</strong> {confirmModal.account.email}</p>
              <p><strong>ID:</strong> {confirmModal.account.id}</p>
              
              {confirmModal.type === 'suspend' && (
                <div className={styles.reasonInput}>
                  <label>Reason for suspension (required):</label>
                  <textarea
                    className={styles.reasonTextarea}
                    placeholder="Enter the reason for suspending this account..."
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                  />
                </div>
              )}
              
              {confirmModal.type === 'delete' && (
                <p>
                  <strong>This action cannot be undone.</strong> All account data and associated 
                  provisions will be permanently deleted.
                </p>
              )}
            </div>
            
            <div className={styles.modalActions}>
              <DashboardButton
                variant="secondary"
                onClick={closeConfirmModal}
                text="Cancel"
              />
              <DashboardButton
                variant={confirmModal.type === 'suspend' ? 'primary' : 'secondary'}
                onClick={confirmModal.type === 'suspend' ? handleSuspendAccount : handleDeleteAccount}
                disabled={actionLoading || (confirmModal.type === 'suspend' && !actionReason.trim())}
                text={actionLoading ? 'Processing...' : confirmModal.type === 'suspend' ? 'Suspend Account' : 'Delete Account'}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagement; 