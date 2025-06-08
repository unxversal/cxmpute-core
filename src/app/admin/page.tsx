"use client";

import React, { useEffect, useState } from 'react';
import { auth } from '@/app/actions';
import { redirect } from 'next/navigation';
import AdminDashboardContent from '@/components/admin/AdminDashboardContent/AdminDashboardContent';
import { ADMIN_EMAILS } from '@/lib/privateutils';
import type { AuthenticatedUserSubject } from '@/lib/auth';

export default function AdminPage() {
  const [subject, setSubject] = useState<AuthenticatedUserSubject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userSubject = await auth();
        
        if (!userSubject || userSubject.type !== "user") {
          redirect('/');
          return;
        }

        // Check if user is admin
        const isAdmin = userSubject.properties.admin && 
                       ADMIN_EMAILS.includes(userSubject.properties.email);

        if (!isAdmin) {
          redirect('/dashboard');
          return;
        }

        setSubject(userSubject as AuthenticatedUserSubject);
        setIsAuthorized(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        redirect('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'var(--font-roboto)'
      }}>
        <div>Loading admin dashboard...</div>
      </div>
    );
  }

  if (!isAuthorized || !subject) {
    return null; // This will not render as we redirect above
  }

  return <AdminDashboardContent subject={subject.properties} />;
} 