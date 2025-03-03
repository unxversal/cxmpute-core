import Button from "@/components/button/button";
import styles from "./page.module.css";
import Link from "next/link";

export default function Dashboard() {
  return (
    <main className={styles.main}>
      <div className={styles.docWrapper}>
        <h1>Cxmpute Dashboard</h1>
        <p>
          Hey there! Our dashboard is on its way—designed to give you an intuitive, powerful interface for managing your compute resources and tracking your rewards. While we’re putting the final touches on it, sign up to be the first to know when it goes live and to receive all the latest updates.
        </p>
        <p>
          <a href="https://tally.so/r/w86DQY" target="_blank" rel="noopener noreferrer">
            <Button text="Notify Me!" backgroundColor="#f8cb46" />
          </a>
        </p>
        <Link href="/">
          <Button text="Back to Home" backgroundColor="#f8cb46" />
        </Link>
      </div>
    </main>
  );
}
