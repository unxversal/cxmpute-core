// src/app/page.tsx (Root Page - Server Component)
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/app/actions"; // Your server-side auth function
import LandingPage from "@/components/LandingPage/LandingPage"; // Your extracted landing page
import TradePageContent from "@/components/trade/TradePageContent"; // The trading dashboard wrapper
import type { AuthenticatedUserSubject } from "@/lib/auth";

// Define your main domain and trade subdomain
const MAIN_DOMAIN = "cxmpute.cloud"; // Configure in .env

export default async function RootPage() {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const userSubject = await auth() as AuthenticatedUserSubject | false; // Cast for clarity

  if (host.startsWith("trade.")) { // or host === TRADE_SUBDOMAIN
    if (userSubject) {
      // User is on trade.example.com and logged in
      return <TradePageContent />;
    } else {
      // User is on trade.example.com but NOT logged in
      // Redirect to the main domain's dashboard/login page
      const mainDomainUrl = headersList.get("x-forwarded-proto") === "https" ? "https://" : "http://";
      redirect(`${mainDomainUrl}${MAIN_DOMAIN}/dashboard`); // Redirect to example.com/dashboard
    }
  } else {
    // User is on example.com (or any other non-trade subdomain)
    // This part no longer needs to check auth for rendering the landing page itself.
    // Specific sections *within* LandingPage (if any) that require auth would handle it internally or be passed userSubject.
    return <LandingPage />;
  }
}