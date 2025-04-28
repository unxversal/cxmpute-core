// app/dashboard/page.tsx
import Dashboard from "@/components/dashboard/Dashboard";
import { auth, login, logout } from "../actions";
import styles from "./dashboard.module.css";
import Image from "next/image";
import Link from "next/link";

export default async function DashboardPage() {
  // -- server-side check for an existing session
  const user = await auth();

  return (
    <main className={styles.container}>
      <div className={styles.backgroundPattern}></div>
      <div className={styles.titleCard}>
        <Link className={styles.logo} href="/">
          <Image src="/images/1.png" alt="cxmpute logo" height={70} width={70} />
          <h1>CXMPUTE</h1>
        </Link>

      {user ? (
        // Logged-in → show "Log out"
        <form action={logout}>
          <button type="submit" className={styles.buttonLogout}>
            Log&nbsp;out
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm4.28 10.28a.75.75 0 000-1.06l-3-3a.75.75 0 10-1.06 1.06l1.72 1.72H8.25a.75.75 0 000 1.5h5.69l-1.72 1.72a.75.75 0 101.06 1.06l3-3z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </form>
      ) : (
        // Not logged-in → show "Log in"
        <form action={login}>
          <button type="submit" className={styles.buttonLogin}>
            Log&nbsp;in
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm4.28 10.28a.75.75 0 000-1.06l-3-3a.75.75 0 10-1.06 1.06l1.72 1.72H8.25a.75.75 0 000 1.5h5.69l-1.72 1.72a.75.75 0 101.06 1.06l3-3z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </form>
      )}
      </div>
      <Dashboard />
    </main>
  );
}
