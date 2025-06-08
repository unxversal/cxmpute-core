"use client";

import React, { useState, useEffect } from 'react';
import styles from './NotificationManager.module.css';
import ThemeCard from '@/components/dashboard/ThemeCard/ThemeCard';
import DashboardButton from '@/components/dashboard/DashboardButton/DashboardButton';
import { Plus, Eye, EyeOff, Bell, Calendar, Edit3, Trash2 } from 'lucide-react';

interface NotificationManagerProps {
  adminId: string;
}

interface NotificationRecord {
  notificationId: string;
  title: string;
  content: string;
  motif: 'homepage' | 'userDashboard' | 'providerDashboard';
  startDate: string;
  endDate?: string;
  status: 'active' | 'scheduled' | 'expired';
  createdDate: string;
  createdBy: string;
  isActive: boolean;
}

interface NotificationForm {
  title: string;
  content: string;
  motif: 'homepage' | 'userDashboard' | 'providerDashboard';
  startDate: string;
  endDate: string;
}

const NotificationManager: React.FC<NotificationManagerProps> = ({ adminId }) => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState<NotificationForm>({
    title: '',
    content: '',
    motif: 'homepage',
    startDate: '',
    endDate: ''
  });

  // Load notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setNotificationsLoading(true);
    try {
      const response = await fetch('/api/admin/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleInputChange = (field: keyof NotificationForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const setQuickDuration = (hours: number) => {
    const now = new Date();
    const start = new Date(now.getTime() + 5 * 60000); // 5 minutes from now
    const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
    
    setForm(prev => ({
      ...prev,
      startDate: start.toISOString().slice(0, 16),
      endDate: end.toISOString().slice(0, 16)
    }));
  };

  const createNotification = async () => {
    if (!form.title.trim() || !form.content.trim() || !form.startDate) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          adminId
        })
      });

      if (response.ok) {
        // Reset form and refresh notifications
        setForm({
          title: '',
          content: '',
          motif: 'homepage',
          startDate: '',
          endDate: ''
        });
        fetchNotifications();
        setShowPreview(false);
      }
    } catch (error) {
      console.error('Error creating notification:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active': return styles.statusBadge + ' ' + styles.active;
      case 'scheduled': return styles.statusBadge + ' ' + styles.scheduled;
      case 'expired': return styles.statusBadge + ' ' + styles.expired;
      default: return styles.statusBadge;
    }
  };

  const getMotifBadgeClass = (motif: string) => {
    switch (motif) {
      case 'homepage': return styles.motifBadge + ' ' + styles.homepage;
      case 'userDashboard': return styles.motifBadge + ' ' + styles.userDashboard;
      case 'providerDashboard': return styles.motifBadge + ' ' + styles.providerDashboard;
      default: return styles.motifBadge;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderMarkdown = (content: string) => {
    // Simple markdown rendering for preview
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className={styles.notificationManagerContainer}>
      {/* Create Notification Section */}
      <ThemeCard className={styles.createCard}>
        <h3>📢 Create New Notification</h3>
        <p>Send platform-wide notifications to users on different pages</p>
        
        <div className={styles.createForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Title *</label>
              <input
                type="text"
                className={styles.formInput}
                placeholder="Enter notification title..."
                value={form.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label>Display Location *</label>
              <select
                className={styles.formSelect + ' ' + styles.motifSelect}
                value={form.motif}
                onChange={(e) => handleInputChange('motif', e.target.value as NotificationForm['motif'])}
              >
                <option value="homepage" className={styles.motifOption}>Homepage</option>
                <option value="userDashboard" className={styles.motifOption}>User Dashboard</option>
                <option value="providerDashboard" className={styles.motifOption}>Provider Dashboard</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Content * (Markdown supported)</label>
            <textarea
              className={styles.formTextarea}
              placeholder="Enter notification content... You can use **bold** and *italic* formatting."
              value={form.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Start Date & Time *</label>
              <div className={styles.dateTimeGroup}>
                <input
                  type="datetime-local"
                  className={styles.formInput + ' ' + styles.dateTimeInput}
                  value={form.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                />
                <div className={styles.durationButtons}>
                  <button
                    type="button"
                    className={styles.durationButton}
                    onClick={() => setQuickDuration(1)}
                  >
                    +1h
                  </button>
                  <button
                    type="button"
                    className={styles.durationButton}
                    onClick={() => setQuickDuration(6)}
                  >
                    +6h
                  </button>
                  <button
                    type="button"
                    className={styles.durationButton}
                    onClick={() => setQuickDuration(24)}
                  >
                    +1d
                  </button>
                  <button
                    type="button"
                    className={styles.durationButton}
                    onClick={() => setQuickDuration(168)}
                  >
                    +1w
                  </button>
                </div>
              </div>
            </div>
            
            <div className={styles.formGroup}>
              <label>End Date & Time (Optional)</label>
              <input
                type="datetime-local"
                className={styles.formInput + ' ' + styles.dateTimeInput}
                value={form.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <DashboardButton
              variant="secondary"
              onClick={() => setShowPreview(!showPreview)}
              iconLeft={showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
              text={showPreview ? "Hide Preview" : "Show Preview"}
            />
            <DashboardButton
              variant="primary"
              onClick={createNotification}
              disabled={loading || !form.title.trim() || !form.content.trim() || !form.startDate}
              iconLeft={<Plus size={16} />}
              text={loading ? "Creating..." : "Create Notification"}
            />
          </div>
        </div>
      </ThemeCard>

      {/* Preview Section */}
      {showPreview && form.title.trim() && form.content.trim() && (
        <ThemeCard className={styles.previewCard}>
          <h3>👀 Preview</h3>
          <p>How your notification will appear to users:</p>
          
          <div className={styles.previewContainer}>
            <div className={styles.previewBanner}>
              <div className={styles.previewBannerText}>
                <strong>{form.title}</strong>
              </div>
              <div className={styles.previewExpandIcon}>▼</div>
            </div>
            
            <div className={styles.previewPopup}>
              <h4>{form.title}</h4>
              <div 
                className={styles.previewContent}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) }}
              />
            </div>
          </div>
        </ThemeCard>
      )}

      {/* Active Notifications Section */}
      <ThemeCard className={styles.activeCard}>
        <h3>🔔 Active Notifications</h3>
        <p>Currently scheduled and active platform notifications</p>
        
        {notificationsLoading ? (
          <div className={styles.loadingState}>Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <Bell size={48} />
            <p>No notifications created yet</p>
            <p>Create your first notification above</p>
          </div>
        ) : (
          <div className={styles.notificationsList}>
            {notifications.map((notification) => (
              <div key={notification.notificationId} className={styles.notificationItem}>
                <div className={styles.notificationHeader}>
                  <div className={styles.notificationInfo}>
                    <h4 className={styles.notificationTitle}>{notification.title}</h4>
                    <div className={styles.notificationMeta}>
                      <div className={getMotifBadgeClass(notification.motif)}>
                        {notification.motif === 'homepage' && 'Homepage'}
                        {notification.motif === 'userDashboard' && 'User Dashboard'}
                        {notification.motif === 'providerDashboard' && 'Provider Dashboard'}
                      </div>
                      <div className={getStatusBadgeClass(notification.status)}>
                        {notification.status}
                      </div>
                    </div>
                    <p className={styles.notificationDates}>
                      <Calendar size={14} />
                      Start: {formatDate(notification.startDate)}
                      {notification.endDate && ` • End: ${formatDate(notification.endDate)}`}
                    </p>
                  </div>
                  
                  <div className={styles.notificationActions}>
                    <DashboardButton
                      variant="secondary"
                      iconLeft={<Edit3 size={14} />}
                      text="Edit"
                    />
                    <DashboardButton
                      variant="secondary"
                      iconLeft={<Trash2 size={14} />}
                      text="Delete"
                    />
                  </div>
                </div>
                
                <div className={styles.notificationBanner}>
                  {notification.content.substring(0, 100)}
                  {notification.content.length > 100 && '...'}
                </div>
              </div>
            ))}
          </div>
        )}
      </ThemeCard>
    </div>
  );
};

export default NotificationManager; 