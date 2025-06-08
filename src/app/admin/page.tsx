"use client";

import React, { useState, useEffect } from 'react';
import { auth } from '../actions';
import { redirect } from 'next/navigation';
import styles from './admin.module.css';
import AdminDashboard from '@/components/admin/AdminDashboard/AdminDashboard';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import type { AuthenticatedUserSubject } from '@/lib/auth';

export default function AdminPage() {
  const [subject, setSubject] = useState<AuthenticatedUserSubject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const authenticatedSubject = await auth();
        
        if (!authenticatedSubject || authenticatedSubject.type !== "user") {
          redirect('/');
          return;
        }

        const userSubject = authenticatedSubject as AuthenticatedUserSubject;
        
        // Check if user is admin
        if (!userSubject.properties.admin) {
          notify.error('Access denied. Admin privileges required.');
          redirect('/dashboard');
          return;
        }

        setSubject(userSubject);
        setIsAuthorized(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        redirect('/');
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized || !subject) {
    return null; // Will redirect
  }

  return (
    <div className={styles.adminPageContainer}>
      <AdminDashboard subject={subject.properties} />
    </div>
  );
} 