// src/app/page.tsx (Root Page - Server Component)
import LandingPage from "@/components/LandingPage/LandingPage"; // Your main landing page component

// const MAIN_DOMAIN = "cxmpute.cloud"; // Example: If you need to reference it. Not used in this version.

export default async function RootPage() {
  // const headersList = await headers(); // Kept for potential other uses, remove if unused
  // const host = headersList.get("host") || "";
  // console.log("Host for RootPage:", host); // Debugging: Can be removed

  // --- User Flow Option 1: Always show LandingPage ---
  // The LandingPage component itself can have links to /dashboard or login prompts.
  // This is generally simpler for the root page.
  return <LandingPage />;

  // --- User Flow Option 2: Redirect authenticated users to /dashboard ---
  // If you prefer to send logged-in users directly to their dashboard
  // and only show the LandingPage to logged-out users, use this block instead.
  // Comment out the `return <LandingPage />;` line above if you use this.
  /*
  if (userSubject) {
    // User is authenticated, redirect them to their dashboard.
    redirect("/dashboard");
  } else {
    // User is not authenticated, show the landing page.
    return <LandingPage />;
  }
  */
}