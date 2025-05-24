// src/app/dashboard/page.tsx
import React from 'react';
import { auth, login } from "@/app/actions"; // Import your server actions for auth
import Dashboard from "@/components/dashboard/Dashboard"; // The main orchestrator component
import styles from "./dashboard.module.css"; // Styles for this page container
import Image from "next/image";
import Link from "next/link";
import type { AuthenticatedUserSubject } from "@/lib/auth";
import Button from '@/components/ui/Button/Button';

export default async function DashboardPage() {
  const userSubject = await auth() as AuthenticatedUserSubject | false; // Cast for type safety

  // If not authenticated, redirect to the login flow.
  // The `login` server action itself handles the redirection to the OpenAuth provider.
  // So, simply calling it will initiate the login process if needed.
  // Or, you might redirect to a page that has a login button.
  if (!userSubject) {
    
    // If the intent is that this page should *always* show something but guide to login if not authed:
      return (
        <main className={styles.container}>
          <div className={styles.unauthenticatedPrompt}>
            <h2>Access Denied</h2>
            <p>Please log in to view your dashboard.</p>
            <form action={login}>
               <Button type="submit" variant="primary" size="lg">Log In</Button>
            </form>
          </div>
        </main>
      );
    
  }

  // If authenticated, render the Dashboard
  return (
    <main className={styles.container}> {/* styles.container is from the new dashboard.module.css */}
      <div className={styles.backgroundPattern} /> {/* Re-add if you want this visual */}

      {/* This is the top bar with logo and logout, consistent across dashboard views */}
      <div className={styles.titleCard}>
        <Link className={styles.logo} href="/">
          <Image src="/images/1.png" alt="cxmpute logo" height={50} width={50} /> {/* Smaller logo */}
          <h1>CXMPUTE</h1>
        </Link>
        {/* Logout button - if userSubject is guaranteed here, we can show it */}
        <form action={login /* This should be logout action here */ }> 
            <button type="submit" className={styles.buttonLogin /* Should be styles.buttonLogout */}> 
                Log out 
                {/* SVG icon for logout */}
            </button>
        </form>
      </div>
      
      {/* Render the main Dashboard component, passing the user's properties */}
      <Dashboard subject={userSubject.properties} />
    </main>
  );
}