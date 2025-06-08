"use client";

import React, { useState, useEffect } from 'react';
import styles from './AccountManagement.module.css';
import ThemeCard from '@/components/dashboard/ThemeCard/ThemeCard';
import DashboardButton from '@/components/dashboard/DashboardButton/DashboardButton';
import ThemeModal from '@/components/dashboard/ThemeModal/ThemeModal';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { AuthenticatedUserSubject } from '@/lib/auth';
import { 
  Users, 
  Server, 
  Search,
  Ban,
  Trash2,
  AlertTriangle,
  RefreshCcw
} from 'lucide-react';

interface AccountManagementProps {
  subject: AuthenticatedUserSubject['properties'];
}

interface UserAccount {
  userId: string;
  email: string;
  providerId: string;
  credits: number;
  totalRewards: number;
  suspended?: boolean;
  lastActive?: string;
}

interface ProviderAccount {
  providerId: string;
  providerEmail: string;
  totalRewards: number;
  activeProvisions: number;
  suspended?: boolean;
  lastActive?: string;
}

type AccountType = 'user' | 'provider';

const AccountManagement: React.FC<AccountManagementProps> = ({ subject }) => {
  const [activeTab, setActiveTab] = useState<AccountType>('user');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [providers, setProviders] = useState<ProviderAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<(UserAccount | ProviderAccount) | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'delete' | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const [usersRes, providersRes] = await Promise.all([
        fetch('/api/admin/accounts/users'),
        fetch('/api/admin/accounts/providers')
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }

      if (providersRes.ok) {
        const providersData = await providersRes.json();
        setProviders(providersData.providers || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      notify.error('Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const executeAction = async () => {
    if (!selectedAccount || !actionType) return;

    setIsExecutingAction(true);
    try {
      const isUser = 'userId' in selectedAccount;
      const endpoint = `/api/admin/accounts/${actionType}`;
      const payload = {
        type: isUser ? 'user' : 'provider',
        id: isUser ? selectedAccount.userId : selectedAccount.providerId,
        adminEmail: subject.email
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${actionType} account`);
      }

      notify.success(`Account ${actionType}${actionType === 'suspend' ? 'ed' : 'd'} successfully`);
      setSelectedAccount(null);
      setActionType(null);
      await fetchAccounts();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : `Failed to ${actionType} account`);
    } finally {
      setIsExecutingAction(false);
    }
  };

  const openActionModal = (account: UserAccount | ProviderAccount, action: 'suspend' | 'delete') => {
    setSelectedAccount(account);
    setActionType(action);
  };

  const closeModal = () => {
    setSelectedAccount(null);
    setActionType(null);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.userId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProviders = providers.filter(provider => 
    provider.providerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    provider.providerId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderUserRow = (user: UserAccount) => (
    <div key={user.userId} className={`${styles.accountRow} ${user.suspended ? styles.suspended : ''}`}>
      <div className={styles.accountInfo}>
        <div className={styles.accountMain}>
          <strong>{user.email}</strong>
          {user.suspended && <span className={styles.suspendedBadge}>SUSPENDED</span>}
        </div>
        <div className={styles.accountDetails}>
          <span>ID: {user.userId}</span>
          <span>Credits: {user.credits?.toLocaleString() || 0}</span>
          <span>Rewards: {user.totalRewards?.toLocaleString() || 0}</span>
        </div>
      </div>
      <div className={styles.accountActions}>
        {!user.suspended && (
          <DashboardButton
            variant="danger"
            size="sm"
            iconLeft={<Ban size={14} />}
            text="Suspend"
            onClick={() => openActionModal(user, 'suspend')}
          />
        )}
        <DashboardButton
          variant="danger"
          size="sm"
          iconLeft={<Trash2 size={14} />}
          text="Delete"
          onClick={() => openActionModal(user, 'delete')}
        />
      </div>
    </div>
  );

  const renderProviderRow = (provider: ProviderAccount) => (
    <div key={provider.providerId} className={`${styles.accountRow} ${provider.suspended ? styles.suspended : ''}`}>
      <div className={styles.accountInfo}>
        <div className={styles.accountMain}>
          <strong>{provider.providerEmail}</strong>
          {provider.suspended && <span className={styles.suspendedBadge}>SUSPENDED</span>}
        </div>
        <div className={styles.accountDetails}>
          <span>ID: {provider.providerId}</span>
          <span>Provisions: {provider.activeProvisions || 0}</span>
          <span>Rewards: {provider.totalRewards?.toLocaleString() || 0}</span>
        </div>
      </div>
      <div className={styles.accountActions}>
        {!provider.suspended && (
          <DashboardButton
            variant="danger"
            size="sm"
            iconLeft={<Ban size={14} />}
            text="Suspend"
            onClick={() => openActionModal(provider, 'suspend')}
          />
        )}
        <DashboardButton
          variant="danger"
          size="sm"
          iconLeft={<Trash2 size={14} />}
          text="Delete"
          onClick={() => openActionModal(provider, 'delete')}
        />
      </div>
    </div>
  );

  return (
    <div className={styles.accountManagementContainer}>
      {/* Header Controls */}
      <ThemeCard className={styles.controlsCard}>
        <div className={styles.controlsContent}>
          <div className={styles.tabButtons}>
            <DashboardButton
              variant={activeTab === 'user' ? 'primary' : 'ghost'}
              iconLeft={<Users size={16} />}
              text={`Users (${users.length})`}
              onClick={() => setActiveTab('user')}
            />
            <DashboardButton
              variant={activeTab === 'provider' ? 'primary' : 'ghost'}
              iconLeft={<Server size={16} />}
              text={`Providers (${providers.length})`}
              onClick={() => setActiveTab('provider')}
            />
          </div>
          <div className={styles.searchSection}>
            <div className={styles.searchInput}>
              <Search size={16} />
              <input
                type="text"
                placeholder={`Search ${activeTab}s...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <DashboardButton
              variant="secondary"
              iconLeft={<RefreshCcw size={16} />}
              text="Refresh"
              onClick={fetchAccounts}
              isLoading={isLoading}
            />
          </div>
        </div>
      </ThemeCard>

      {/* Accounts List */}
      <ThemeCard title={`${activeTab === 'user' ? 'User' : 'Provider'} Accounts`} className={styles.accountsList}>
        {isLoading ? (
          <div className={styles.loadingState}>Loading accounts...</div>
        ) : (
          <div className={styles.accountsContainer}>
            {activeTab === 'user' 
              ? filteredUsers.map(renderUserRow)
              : filteredProviders.map(renderProviderRow)
            }
            {(activeTab === 'user' ? filteredUsers : filteredProviders).length === 0 && (
              <div className={styles.emptyState}>
                No {activeTab}s found{searchTerm && ' matching your search'}
              </div>
            )}
          </div>
        )}
      </ThemeCard>

      {/* Confirmation Modal */}
      {selectedAccount && actionType && (
        <ThemeModal
          isOpen={true}
          onClose={closeModal}
          title={
            <span className={styles.modalTitle}>
              <AlertTriangle size={22} className={styles.warningIcon} />
              Confirm {actionType === 'suspend' ? 'Suspension' : 'Deletion'}
            </span> as unknown as string
          }
          size="md"
          footerContent={
            <>
              <DashboardButton
                variant="secondary"
                text="Cancel"
                onClick={closeModal}
                disabled={isExecutingAction}
              />
              <DashboardButton
                variant="danger"
                text={`Yes, ${actionType === 'suspend' ? 'Suspend' : 'Delete'}`}
                onClick={executeAction}
                isLoading={isExecutingAction}
                disabled={isExecutingAction}
              />
            </>
          }
        >
          <div className={styles.confirmationContent}>
            <p>
              Are you sure you want to {actionType} this {('userId' in selectedAccount) ? 'user' : 'provider'} account?
            </p>
            <div className={styles.accountPreview}>
              <strong>
                {('userId' in selectedAccount) ? selectedAccount.email : selectedAccount.providerEmail}
              </strong>
              <br />
              <span className={styles.accountId}>
                ID: {('userId' in selectedAccount) ? selectedAccount.userId : selectedAccount.providerId}
              </span>
            </div>
            {actionType === 'delete' && (
              <div className={styles.warningText}>
                <AlertTriangle size={16} />
                This action cannot be undone. All data will be permanently removed.
              </div>
            )}
          </div>
        </ThemeModal>
      )}
    </div>
  );
};

export default AccountManagement; 