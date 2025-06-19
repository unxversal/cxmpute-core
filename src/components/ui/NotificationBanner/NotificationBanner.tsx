"use client";

import React, { useState, useEffect, useCallback } from 'react';
import styles from './NotificationBanner.module.css';
import { X, ChevronDown, ChevronUp, Bell } from 'lucide-react';

interface NotificationRecord {
  notificationId: string;
  title: string;
  content: string;
  motif: 'homepage' | 'userDashboard' | 'providerDashboard';
  startDate: string;
  endDate?: string;
  status: 'active' | 'scheduled' | 'expired';
  isActive: boolean;
}

interface NotificationBannerProps {
  motif: 'homepage' | 'userDashboard' | 'providerDashboard';
  className?: string;
}

const NotificationBanner: React.FC<NotificationBannerProps> = ({ motif, className = '' }) => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set());
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());

  // Use `useCallback` to memoize the fetch function so it doesn't get recreated on
  // every render. If the function reference changes every render it will trigger
  // the `useEffect` below continuously, causing the flood of repeated requests
  // you've been seeing in the logs.
  const fetchActiveNotifications = useCallback(async () => {
    try {
      const response = await fetch(`/api/notifications/active?motif=${motif}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [motif]);

  // Call the memoized fetch function only when `motif` changes (or on mount).
  useEffect(() => {
    fetchActiveNotifications();
  }, [fetchActiveNotifications]);

  const toggleExpanded = (notificationId: string) => {
    const newExpanded = new Set(expandedNotifications);
    if (newExpanded.has(notificationId)) {
      newExpanded.delete(notificationId);
    } else {
      newExpanded.add(notificationId);
    }
    setExpandedNotifications(newExpanded);
  };

  const dismissNotification = (notificationId: string) => {
    const newDismissed = new Set(dismissedNotifications);
    newDismissed.add(notificationId);
    setDismissedNotifications(newDismissed);
    
    // Store dismissed notifications in localStorage
    const storageKey = `dismissed_notifications_${motif}`;
    const existingDismissed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const updatedDismissed = [...existingDismissed, notificationId];
    localStorage.setItem(storageKey, JSON.stringify(updatedDismissed));
  };

  const renderMarkdown = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  // Load dismissed notifications from localStorage
  useEffect(() => {
    const storageKey = `dismissed_notifications_${motif}`;
    const dismissed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    setDismissedNotifications(new Set(dismissed));
  }, [motif]);

  // Filter out dismissed notifications
  const visibleNotifications = notifications.filter(
    notification => !dismissedNotifications.has(notification.notificationId)
  );

  if (loading || visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.notificationBanners} ${className}`}>
      {visibleNotifications.map((notification) => {
        const isExpanded = expandedNotifications.has(notification.notificationId);
        
        return (
          <div key={notification.notificationId} className={styles.notificationBanner}>
            <div className={styles.bannerHeader} onClick={() => toggleExpanded(notification.notificationId)}>
              <div className={styles.bannerLeft}>
                <Bell size={16} className={styles.bellIcon} />
                <span className={styles.bannerTitle}>{notification.title}</span>
              </div>
              <div className={styles.bannerRight}>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <button
                  className={styles.dismissButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissNotification(notification.notificationId);
                  }}
                  title="Dismiss notification"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            
            {isExpanded && (
              <div className={styles.bannerContent}>
                <div 
                  className={styles.contentText}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(notification.content) }}
                />
                {notification.endDate && (
                  <div className={styles.bannerFooter}>
                    <small>Valid until: {new Date(notification.endDate).toLocaleDateString()}</small>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default NotificationBanner; 