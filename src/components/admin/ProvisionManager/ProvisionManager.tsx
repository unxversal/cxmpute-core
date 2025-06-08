"use client";

import React, { useState, useEffect } from 'react';
import styles from './ProvisionManager.module.css';
import ThemeCard from '@/components/dashboard/ThemeCard/ThemeCard';
import DashboardButton from '@/components/dashboard/DashboardButton/DashboardButton';
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Unplug, 
  CheckSquare,
  MapPin,
  Server,
  Activity
} from 'lucide-react';

interface ProvisionManagerProps {
  adminId: string;
}

interface ProvisionRecord {
  provisionId: string;
  providerId: string;
  providerEmail?: string;
  provisionEndpoint?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  services?: string[];
  status: 'online' | 'offline' | 'unknown';
  tier?: string;
  lastHeartbeat?: string;
  createdDate?: string;
}

interface DisconnectModalData {
  isOpen: boolean;
  selectedProvisions: string[];
}

const ProvisionManager: React.FC<ProvisionManagerProps> = ({ adminId }) => {
  const [provisions, setProvisions] = useState<ProvisionRecord[]>([]);
  const [filteredProvisions, setFilteredProvisions] = useState<ProvisionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [selectedProvisions, setSelectedProvisions] = useState<Set<string>>(new Set());
  const [disconnectModal, setDisconnectModal] = useState<DisconnectModalData>({ isOpen: false, selectedProvisions: [] });
  const [disconnectLoading, setDisconnectLoading] = useState(false);

  // Load provisions on mount
  useEffect(() => {
    fetchProvisions();
  }, []);

  // Filter provisions when search/filter changes
  useEffect(() => {
    filterProvisions();
  }, [provisions, searchQuery, statusFilter]);

  const fetchProvisions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/provisions');
      if (response.ok) {
        const data = await response.json();
        setProvisions(data.provisions || []);
      }
    } catch (error) {
      console.error('Error fetching provisions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProvisions = () => {
    let filtered = provisions;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(provision => 
        provision.provisionId.toLowerCase().includes(query) ||
        provision.providerId.toLowerCase().includes(query) ||
        provision.providerEmail?.toLowerCase().includes(query) ||
        provision.location?.country?.toLowerCase().includes(query) ||
        provision.location?.city?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(provision => provision.status === statusFilter);
    }

    setFilteredProvisions(filtered);
  };

  const toggleProvisionSelection = (provisionId: string) => {
    const newSelected = new Set(selectedProvisions);
    if (newSelected.has(provisionId)) {
      newSelected.delete(provisionId);
    } else {
      newSelected.add(provisionId);
    }
    setSelectedProvisions(newSelected);
  };

  const selectAllVisibleProvisions = () => {
    const visibleIds = filteredProvisions.map(p => p.provisionId);
    setSelectedProvisions(new Set(visibleIds));
  };

  const clearSelection = () => {
    setSelectedProvisions(new Set());
  };

  const openDisconnectModal = () => {
    setDisconnectModal({
      isOpen: true,
      selectedProvisions: Array.from(selectedProvisions)
    });
  };

  const closeDisconnectModal = () => {
    setDisconnectModal({ isOpen: false, selectedProvisions: [] });
  };

  const handleDisconnectProvisions = async () => {
    setDisconnectLoading(true);
    try {
      const response = await fetch('/api/admin/provisions/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provisionIds: disconnectModal.selectedProvisions,
          adminId
        })
      });

      if (response.ok) {
        // Refresh provisions and clear selection
        fetchProvisions();
        clearSelection();
        closeDisconnectModal();
      }
    } catch (error) {
      console.error('Error disconnecting provisions:', error);
    } finally {
      setDisconnectLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'online': return styles.statusBadge + ' ' + styles.online;
      case 'offline': return styles.statusBadge + ' ' + styles.offline;
      case 'unknown': return styles.statusBadge + ' ' + styles.unknown;
      default: return styles.statusBadge;
    }
  };

  // const formatDate = (dateString?: string) => {
  //   if (!dateString) return 'Unknown';
  //   return new Date(dateString).toLocaleString();
  // };

  // Calculate stats
  const totalProvisions = provisions.length;
  const onlineProvisions = provisions.filter(p => p.status === 'online').length;
  const offlineProvisions = provisions.filter(p => p.status === 'offline').length;
  const unknownProvisions = provisions.filter(p => p.status === 'unknown').length;

  return (
    <div className={styles.provisionManagerContainer}>
      {/* Overview Stats */}
      <ThemeCard className={styles.overviewCard}>
        <h3>📊 Provision Overview</h3>
        <div className={styles.overviewGrid}>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{totalProvisions}</div>
            <div className={styles.statLabel}>Total Provisions</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{onlineProvisions}</div>
            <div className={styles.statLabel}>Online</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{offlineProvisions}</div>
            <div className={styles.statLabel}>Offline</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{unknownProvisions}</div>
            <div className={styles.statLabel}>Unknown</div>
          </div>
        </div>
      </ThemeCard>

      {/* Provisions Management */}
      <ThemeCard className={styles.provisionsCard}>
        <h3>🖥️ Active Provisions</h3>
        <p>Manage provider provisions and connections</p>

        {/* Controls */}
        <div className={styles.provisionsControls}>
          <div className={styles.searchFilter}>
            <input
              type="text"
              placeholder="Search provisions..."
              className={styles.filterInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className={styles.filterSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'online' | 'offline')}
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
            <DashboardButton
              variant="secondary"
              onClick={selectAllVisibleProvisions}
              iconLeft={<CheckSquare size={16} />}
              text="Select All"
            />
          </div>

          <div className={styles.bulkActions}>
            {selectedProvisions.size > 0 && (
              <>
                <span>{selectedProvisions.size} selected</span>
                <DashboardButton
                  variant="secondary"
                  onClick={clearSelection}
                  text="Clear"
                />
                <DashboardButton
                  variant="primary"
                  onClick={openDisconnectModal}
                  iconLeft={<Unplug size={16} />}
                  text={`Disconnect (${selectedProvisions.size})`}
                />
              </>
            )}
          </div>
        </div>

        {/* Provisions List */}
        {loading ? (
          <div className={styles.loadingState}>Loading provisions...</div>
        ) : filteredProvisions.length === 0 ? (
          <div className={styles.emptyState}>
            <Server size={48} />
            <p>No provisions found</p>
            <p>Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className={styles.provisionsList}>
            {filteredProvisions.map((provision) => (
              <div 
                key={provision.provisionId} 
                className={`${styles.provisionItem} ${selectedProvisions.has(provision.provisionId) ? styles.selected : ''}`}
              >
                <div className={styles.provisionHeader}>
                  <div className={styles.provisionInfo}>
                    <div className={styles.provisionId}>{provision.provisionId}</div>
                    <div className={styles.provisionMeta}>
                      <div className={styles.providerInfo}>
                        Provider: <span className={styles.providerEmail}>{provision.providerEmail || provision.providerId}</span>
                      </div>
                      <div className={getStatusBadgeClass(provision.status)}>
                        {provision.status === 'online' && <Wifi size={14} />}
                        {provision.status === 'offline' && <WifiOff size={14} />}
                        {provision.status === 'unknown' && <Activity size={14} />}
                        {provision.status}
                      </div>
                      {provision.tier && (
                        <div className={styles.tierBadge}>
                          Tier: {provision.tier}
                        </div>
                      )}
                      {provision.location && (
                        <div className={styles.locationInfo}>
                          <MapPin size={14} />
                          {provision.location.city}, {provision.location.country}
                        </div>
                      )}
                    </div>

                    {provision.services && provision.services.length > 0 && (
                      <div className={styles.servicesInfo}>
                        <div className={styles.servicesLabel}>Services:</div>
                        <div className={styles.servicesList}>
                          {provision.services.map((service, index) => (
                            <span key={index} className={styles.serviceTag}>
                              {service}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={styles.provisionActions}>
                    <input
                      type="checkbox"
                      className={styles.provisionCheckbox}
                      checked={selectedProvisions.has(provision.provisionId)}
                      onChange={() => toggleProvisionSelection(provision.provisionId)}
                    />
                    <DashboardButton
                      variant="secondary"
                      onClick={() => {
                        setSelectedProvisions(new Set([provision.provisionId]));
                        openDisconnectModal();
                      }}
                      iconLeft={<Unplug size={14} />}
                      text="Disconnect"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ThemeCard>

      {/* Disconnect Confirmation Modal */}
      {disconnectModal.isOpen && (
        <div className={styles.modalOverlay} onClick={closeDisconnectModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                <Unplug size={20} />
                Disconnect Provisions
              </h3>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.warningText}>
                <AlertTriangle size={20} />
                <div>
                  <p><strong>Warning!</strong></p>
                  <p>
                    You are about to disconnect {disconnectModal.selectedProvisions.length} provision(s).
                    This will remove them from all service pools and stop routing requests to them.
                  </p>
                </div>
              </div>
              
              <div className={styles.provisionList}>
                {disconnectModal.selectedProvisions.map((provisionId) => (
                  <div key={provisionId} className={styles.provisionListItem}>
                    {provisionId}
                  </div>
                ))}
              </div>
              
              <p>This action can be reversed by having the providers restart their services.</p>
            </div>
            
            <div className={styles.modalActions}>
              <DashboardButton
                variant="secondary"
                onClick={closeDisconnectModal}
                disabled={disconnectLoading}
                text="Cancel"
              />
              <DashboardButton
                variant="primary"
                onClick={handleDisconnectProvisions}
                disabled={disconnectLoading}
                text={disconnectLoading ? 'Disconnecting...' : 'Disconnect Provisions'}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProvisionManager; 