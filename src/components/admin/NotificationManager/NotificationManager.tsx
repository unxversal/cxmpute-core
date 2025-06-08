"use client";

import React, { useState, useEffect } from 'react';
import styles from './NotificationManager.module.css';
import ThemeCard from '@/components/dashboard/ThemeCard/ThemeCard';
import DashboardButton from '@/components/dashboard/DashboardButton/DashboardButton';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { AuthenticatedUserSubject } from '@/lib/auth';
import type { NotificationRecord } from '@/lib/interfaces';
import { 
  Bell, 
  Plus, 
  Edit, 
  Trash2,
  Eye,
  Calendar,
  Clock,
  MapPin,
  RefreshCcw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface NotificationManagerProps {
  subject: AuthenticatedUserSubject['properties'];
}

const NotificationManager: React.FC<NotificationManagerProps> = ({ subject }) => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState<NotificationRecord | null>(null);
  const [previewNotification, setPreviewNotification] = useState<NotificationRecord | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    bannerText: '',
    popupText: '',
    location: 'homepage' as 'homepage' | 'user-dashboard' | 'provider-dashboard',
    startDate: new Date().toISOString().split('T')[0],
    startTime: '00:00',
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    expiryTime: '23:59'
  });

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      notify.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const submitNotification = async () => {
    try {
      const startDateTime = `${formData.startDate}T${formData.startTime}:00.000Z`;
      const expiryDateTime = `${formData.expiryDate}T${formData.expiryTime}:59.999Z`;

      const payload = {
        ...formData,
        startDate: startDateTime,
        expiryDate: expiryDateTime,
        adminEmail: subject.email
      };

      const endpoint = editingNotification 
        ? `/api/admin/notifications/${editingNotification.notificationId}`
        : '/api/admin/notifications';
      
      const method = editingNotification ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save notification');
      }

      notify.success(`Notification ${editingNotification ? 'updated' : 'created'} successfully`);
      closeModal();
      await fetchNotifications();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to save notification');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/admin/notifications/${notificationId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      notify.success('Notification deleted successfully');
      await fetchNotifications();
    } catch {
      notify.error('Failed to delete notification');
    }
  };

  const openCreateModal = () => {
    setEditingNotification(null);
    setFormData({
      title: '',
      bannerText: '',
      popupText: '',
      location: 'homepage',
      startDate: new Date().toISOString().split('T')[0],
      startTime: '00:00',
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expiryTime: '23:59'
    });
    setShowCreateModal(true);
  };

  const openEditModal = (notification: NotificationRecord) => {
    setEditingNotification(notification);
    const startDate = new Date(notification.startDate);
    const expiryDate = new Date(notification.expiryDate);
    
    setFormData({
      title: notification.title,
      bannerText: notification.bannerText,
      popupText: notification.popupText,
      location: notification.location,
      startDate: startDate.toISOString().split('T')[0],
      startTime: startDate.toTimeString().slice(0, 5),
      expiryDate: expiryDate.toISOString().split('T')[0],
      expiryTime: expiryDate.toTimeString().slice(0, 5)
    });
    setShowCreateModal(true);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingNotification(null);
    setPreviewNotification(null);
  };

  const previewMarkdown = () => {
    const startDateTime = `${formData.startDate}T${formData.startTime}:00.000Z`;
    const expiryDateTime = `${formData.expiryDate}T${formData.expiryTime}:59.999Z`;
    
    setPreviewNotification({
      notificationId: 'preview',
      title: formData.title,
      bannerText: formData.bannerText,
      popupText: formData.popupText,
      location: formData.location,
      startDate: startDateTime,
      expiryDate: expiryDateTime,
      active: 'true',
      createdBy: subject.email,
      createdAt: new Date().toISOString()
    });
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const locationLabels = {
    'homepage': 'Homepage',
    'user-dashboard': 'User Dashboard',
    'provider-dashboard': 'Provider Dashboard'
  };

  const isActive = (notification: NotificationRecord) => {
    const now = new Date();
    const start = new Date(notification.startDate);
    const expiry = new Date(notification.expiryDate);
    return now >= start && now <= expiry;
  };

  return (
    <div className={styles.notificationManagerContainer}>
      {/* Header */}
      <ThemeCard className={styles.headerCard}>
        <div className={styles.headerContent}>
          <div>
            <h2>Notification Management</h2>
            <p>Create and manage system-wide notifications for different parts of the platform</p>
          </div>
          <div className={styles.headerActions}>
            <DashboardButton
              variant="secondary"
              iconLeft={<RefreshCcw size={16} />}
              text="Refresh"
              onClick={fetchNotifications}
              isLoading={isLoading}
            />
            <DashboardButton
              variant="primary"
              iconLeft={<Plus size={16} />}
              text="Create Notification"
              onClick={openCreateModal}
            />
          </div>
        </div>
      </ThemeCard>

      {/* Notifications List */}
      <ThemeCard title="Active & Scheduled Notifications" className={styles.notificationsList}>
        {isLoading ? (
          <div className={styles.loadingState}>Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <Bell size={48} />
            <h3>No notifications</h3>
            <p>Create your first notification to get started</p>
          </div>
        ) : (
          <div className={styles.notificationsContainer}>
            {notifications.map((notification) => (
              <div 
                key={notification.notificationId} 
                className={`${styles.notificationRow} ${isActive(notification) ? styles.active : styles.inactive}`}
              >
                <div className={styles.notificationInfo}>
                  <div className={styles.notificationHeader}>
                    <h4>{notification.title}</h4>
                    <div className={styles.statusBadge}>
                      {isActive(notification) ? 'ACTIVE' : 'SCHEDULED'}
                    </div>
                  </div>
                  <div className={styles.notificationMeta}>
                    <span className={styles.metaItem}>
                      <MapPin size={14} />
                      {locationLabels[notification.location]}
                    </span>
                    <span className={styles.metaItem}>
                      <Calendar size={14} />
                      {new Date(notification.startDate).toLocaleDateString()}
                    </span>
                    <span className={styles.metaItem}>
                      <Clock size={14} />
                      Expires: {new Date(notification.expiryDate).toLocaleDateString()}
                    </span>
                  </div>
                  <p className={styles.bannerPreview}>{notification.bannerText}</p>
                </div>
                <div className={styles.notificationActions}>
                  <DashboardButton
                    variant="ghost"
                    size="sm"
                    iconLeft={<Eye size={14} />}
                    text="Preview"
                    onClick={() => setPreviewNotification(notification)}
                  />
                  <DashboardButton
                    variant="secondary"
                    size="sm"
                    iconLeft={<Edit size={14} />}
                    text="Edit"
                    onClick={() => openEditModal(notification)}
                  />
                  <DashboardButton
                    variant="danger"
                    size="sm"
                    iconLeft={<Trash2 size={14} />}
                    text="Delete"
                    onClick={() => deleteNotification(notification.notificationId)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </ThemeCard>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingNotification ? 'Edit' : 'Create'} Notification</h3>
              <button className={styles.closeButton} onClick={closeModal}>×</button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Notification title"
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Location</label>
                                     <select
                     value={formData.location}
                     onChange={(e) => setFormData({...formData, location: e.target.value as 'homepage' | 'user-dashboard' | 'provider-dashboard'})}
                   >
                    <option value="homepage">Homepage</option>
                    <option value="user-dashboard">User Dashboard</option>
                    <option value="provider-dashboard">Provider Dashboard</option>
                  </select>
                </div>

                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>Banner Text (shown when collapsed)</label>
                  <input
                    type="text"
                    value={formData.bannerText}
                    onChange={(e) => setFormData({...formData, bannerText: e.target.value})}
                    placeholder="Short text shown in the banner"
                  />
                </div>

                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>Popup Content (Markdown supported)</label>
                  <textarea
                    value={formData.popupText}
                    onChange={(e) => setFormData({...formData, popupText: e.target.value})}
                    placeholder="Full content shown in popup (supports markdown)"
                    rows={6}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Expiry Time</label>
                  <input
                    type="time"
                    value={formData.expiryTime}
                    onChange={(e) => setFormData({...formData, expiryTime: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <DashboardButton
                variant="ghost"
                text="Preview"
                onClick={previewMarkdown}
              />
              <DashboardButton
                variant="secondary"
                text="Cancel"
                onClick={closeModal}
              />
              <DashboardButton
                variant="primary"
                text={editingNotification ? 'Update' : 'Create'}
                onClick={submitNotification}
              />
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewNotification && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Notification Preview</h3>
              <button className={styles.closeButton} onClick={closeModal}>×</button>
            </div>
            <div className={styles.previewContent}>
              <div className={styles.previewBanner}>
                <strong>Banner View:</strong>
                <div className={styles.bannerExample}>
                  {previewNotification.bannerText}
                </div>
              </div>
              <div className={styles.previewPopup}>
                <strong>Popup Content:</strong>
                <div className={styles.popupExample}>
                  <ReactMarkdown>{previewNotification.popupText}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationManager; 