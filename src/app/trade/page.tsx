// src/app/trade/page.tsx
import { auth } from "@/app/actions"; // Your server-side auth function
import { redirect } from "next/navigation";
import { AuthProvider } from "@/contexts/AuthContext"; // Import AuthProvider
import { TradingModeProvider } from "@/contexts/TradingModeContext";
import { MarketProvider } from "@/contexts/MarketContext";
import { WebSocketProvider } from "@/contexts/WebsocketContext";
import { AccountProvider } from "@/contexts/AccountContext";
import TradeDashboard from "@/components/trade/TradeDashboard"; // This component will be built next
import styles from "./trade.module.css"; // Create this file

export default async function TradePage() {
  const userSubject = await auth(); // Fetches user subject on the server

  if (!userSubject) {
    // Redirect to login or a relevant page if not authenticated
    // Ensure your login page is correctly set up
    redirect("/dashboard"); // Or your actual login page, e.g., /login
  }

  return (
    // Pass the server-fetched userSubject to AuthProvider
    // This makes the user data available to all nested client components via useAuth()
    <AuthProvider user={userSubject}>
      <TradingModeProvider initialMode="PAPER"> {/* Default to PAPER mode */}
        <MarketProvider>
          <WebSocketProvider>
            <AccountProvider>
              <main className={styles.tradePageMain}>
                {/* TradeDashboard will be a client component */}
                <TradeDashboard />
              </main>
            </AccountProvider>
          </WebSocketProvider>
        </MarketProvider>
      </TradingModeProvider>
    </AuthProvider>
  );
}