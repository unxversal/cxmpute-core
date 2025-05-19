import Button from "@/components/button/button";
import styles from "./page.module.css";
import Link from "next/link";

export default function Docs() {
  return (
    <main className={styles.main}>
      <div className={styles.docWrapper}>
        <h1>Cxmpute Documentation</h1>
        <p>
          Hey there! Our comprehensive Cxmpute docs are coming soon. We’re busy putting together all the details you need to unlock the full potential of our platform. In the meantime, fill out our form to be the first to know when our docs go live and to get the latest updates.
        </p>
        <p>
          <a href="https://tally.so/r/w86DQY" target="_blank" rel="noopener noreferrer">
            <Button text="Notify Me!" backgroundColor="#20a191" />
          </a>
        </p>
        <Link href="/">
          <Button text="Back to Home" backgroundColor="#20a191" />
        </Link>
      </div>
    </main>
  );
}
