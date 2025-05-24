// src/app/dashboard/page.tsx
import React from 'react';
import { auth, login, logout } from "@/app/actions"; // Assuming actions.ts is in src/app/
import Dashboard from "@/components/dashboard/Dashboard"; 
import styles from "./dashboard.module.css"; // Page level styles
import Image from "next/image";
import Link from "next/link";
import type { AuthenticatedUserSubject } from "@/lib/auth";
import DashboardButton from '@/components/dashboard/DashboardButton/DashboardButton'; // Import the themed button
import { LogOut } from 'lucide-react'; // For logout icon
import Button from '@/components/button/button';

export default async function DashboardPage() {
  const userSubject = await auth() as AuthenticatedUserSubject | false; 

  if (!userSubject) {
    
    // If the intent is that this page should *always* show something but guide to login if not authed:
      return (
        <main className={styles.container}>
          <div className={styles.backgroundPattern} />

          <div className={styles.unauthenticatedPrompt}>
            <Link className={styles.logoLink} href="/">
              <Image src="/images/1.png" alt="Cxmpute Logo" height={50} width={50} />
              <h1 className={styles.logoText}>CXMPUTE</h1>
            </Link>
            {/* <h2>Access Denied</h2> */}
            <p>Please log in to view your dashboard.</p>
            <form action={login}>
               <Button text="Log In" backgroundColor="#20a191" />
            </form>
          </div>
          
        </main>
      );
    
  }
  return (
    <main className={styles.pageContainer}> {/* Renamed for clarity if needed, or use .container */}
      <div className={styles.backgroundPattern} />

      <header className={styles.pageHeader}>
        <Link className={styles.logoLink} href="/">
          <Image src="/images/1.png" alt="Cxmpute Logo" height={50} width={50} />
          <h1 className={styles.logoText}>CXMPUTE</h1>
        </Link>
        
        <form action={logout}>
            <DashboardButton 
                type="submit" 
                variant="secondary" // Example: Slate color for logout
                size="md"
                iconLeft={<LogOut size={16} />}
                text="Log Out"
                className={styles.logoutButton} // For any specific positioning
            />
        </form>
      </header>
      
      {/* Render the main Dashboard orchestrator component */}
      <Dashboard subject={userSubject.properties} />
    </main>
  );
}