'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Bell } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export interface NotificationBannerProps {
  location: "homepage" | "user_dashboard" | "provider_dashboard";
}

interface Notification {
  notificationId: string;
  title: string;
  content: string;
  startDate: string;
  endDate: string;
}

export function NotificationBanner({ location }: NotificationBannerProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set());
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, [location]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`/api/notifications?location=${location}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

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
  };

  const activeNotifications = notifications.filter(
    notification => !dismissedNotifications.has(notification.notificationId)
  );

  if (loading || activeNotifications.length === 0) {
    return null;
  }

  const bannerStyles = {
    homepage: "bg-blue-50 border-blue-200 text-blue-800",
    user_dashboard: "bg-green-50 border-green-200 text-green-800", 
    provider_dashboard: "bg-purple-50 border-purple-200 text-purple-800"
  };

  const iconStyles = {
    homepage: "text-blue-600",
    user_dashboard: "text-green-600",
    provider_dashboard: "text-purple-600"
  };

  return (
    <div className="w-full">
      {activeNotifications.map((notification) => {
        const isExpanded = expandedNotifications.has(notification.notificationId);
        
        return (
          <div 
            key={notification.notificationId}
            className={`border-b ${bannerStyles[location]} transition-all duration-200`}
          >
            {/* Collapsed Banner */}
            <div className="flex items-center justify-between px-4 py-2 cursor-pointer hover:opacity-80">
              <div 
                className="flex items-center gap-3 flex-1"
                onClick={() => toggleExpanded(notification.notificationId)}
              >
                <Bell className={`h-4 w-4 ${iconStyles[location]}`} />
                <span className="text-sm font-medium truncate">
                  {notification.title}
                </span>
                {isExpanded ? (
                  <ChevronUp className={`h-4 w-4 ${iconStyles[location]}`} />
                ) : (
                  <ChevronDown className={`h-4 w-4 ${iconStyles[location]}`} />
                )}
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissNotification(notification.notificationId);
                }}
                className={`p-1 rounded hover:bg-black/10 ${iconStyles[location]}`}
                title="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-black/10">
                <div className="prose prose-sm max-w-none mt-3">
                  <ReactMarkdown>{notification.content}</ReactMarkdown>
                </div>
                <div className="mt-3 text-xs opacity-60">
                  Active until {new Date(notification.endDate).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
} 