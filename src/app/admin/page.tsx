import React from 'react';
import { auth, login, logout } from "@/app/actions";
import { isAdminUser } from '../../lib/admin';
import { AdminDashboard } from '../../components/admin/AdminDashboard';
import type { AuthenticatedUserSubject } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import Button from '@/components/button/button';
import DashboardButton from '@/components/dashboard/DashboardButton/DashboardButton';
import { LogOut } from 'lucide-react';
import styles from "../dashboard/dashboard.module.css";

export default async function AdminPage() {
  const userSubject = await auth() as AuthenticatedUserSubject | false;

  if (!userSubject) {
    return (
      <main className={styles.container}>
        <div className={styles.backgroundPattern} />
        <div className={styles.unauthenticatedPrompt}>
          <Link className={styles.logoLink} href="/">
            <Image src="/images/1.png" alt="Cxmpute Logo" height={50} width={50} />
            <h1 className={styles.logoText}>CXMPUTE</h1>
          </Link>
          <h2 className="text-xl font-semibold text-red-600 mb-2">Admin Access Required</h2>
          <p>Please log in with an admin account to access the admin dashboard.</p>
          <form action={login}>
            <Button text="Log In" backgroundColor="#dc2626" />
          </form>
        </div>
      </main>
    );
  }

  const userEmail = userSubject.properties.email;
  
  if (!isAdminUser(userEmail)) {
    return (
      <main className={styles.container}>
        <div className={styles.backgroundPattern} />
        <div className={styles.unauthenticatedPrompt}>
          <Link className={styles.logoLink} href="/">
            <Image src="/images/1.png" alt="Cxmpute Logo" height={50} width={50} />
            <h1 className={styles.logoText}>CXMPUTE</h1>
          </Link>
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
          <p>You don't have permission to access the admin dashboard.</p>
          <Link href="/dashboard">
            <Button text="Go to Dashboard" backgroundColor="#2563eb" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.pageContainer}>
      <div className={styles.backgroundPattern} />
      
      <header className={styles.pageHeader}>
        <Link className={styles.logoLink} href="/">
          <Image src="/images/1.png" alt="Cxmpute Logo" height={50} width={50} />
          <h1 className={styles.logoText}>CXMPUTE ADMIN</h1>
        </Link>
        
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <DashboardButton 
              variant="secondary"
              size="md"
              text="User Dashboard"
            />
          </Link>
          
          <form action={logout}>
            <DashboardButton 
              type="submit" 
              variant="secondary"
              size="md"
              iconLeft={<LogOut size={16} />}
              text="Log Out"
              className={styles.logoutButton}
            />
          </form>
        </div>
      </header>
      
      <AdminDashboard userEmail={userEmail} />
    </main>
  );
} 