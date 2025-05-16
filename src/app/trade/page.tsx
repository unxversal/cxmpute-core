// src/app/trade/page.tsx
import { auth } from "@/app/actions"; // <<< FIX: Import server action for authentication
import { redirect } from "next/navigation"; // <<< FIX: Import redirect from next/navigation
import { AuthProvider } from "@/contexts/AuthContext";
import { TradingModeProvider } from "@/contexts/TradingModeContext";
import TradeDashboard from "@/components/trade/TradeDashboard/TradeDashboard";
import styles from "./trade.module.css"; // Assuming you have this CSS file

export default async function TradePage() {
  const userSubject = await auth(); // Fetches user subject on the server

  if (!userSubject) {
    // Redirect to a login page or a general dashboard if not authenticated.
    // Ensure '/dashboard' is appropriate or change to your login route.
    // Example: if your OpenAuth callback redirects to /dashboard and that page
    // itself handles login if no session, this might be okay.
    // Or, you might have a specific /login page.
    redirect("/dashboard"); // Or your designated login page e.g. /auth/login
  }

  // The userSubject from `await auth()` is the complete subject object
  // which includes `type: "user"` and `properties: {...}`.
  // AuthProvider expects this structure or null.
  return (
    <AuthProvider user={userSubject}> {/* Pass the fetched user subject */}
      <TradingModeProvider initialMode="PAPER"> {/* Default to PAPER mode */}
        {/* The main className for the page can be on <main> or a div inside it */}
        <main className={styles.tradePageMain}>
          <TradeDashboard /> {/* TradeDashboard now wraps the other more specific contexts */}
        </main>
      </TradingModeProvider>
    </AuthProvider>
  );
}