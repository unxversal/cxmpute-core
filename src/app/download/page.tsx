import Button from "@/components/button/button";
import styles from "./page.module.css";
import Link from "next/link";

export default function Download() {
  return (
    <main className={styles.main}>
      <div className={styles.docWrapper}>
        <h1>Download Cxmpute</h1>
        <p>
          Hey there! The Cxmpute provider app is in the works and will be available soon. In the meantime, sign up to get the download link and receive the latest, most exciting updates as soon as we go live. We can’t wait to welcome you to the Cxmpute family!
        </p>
        <p>
          <a href="https://tally.so/r/w86DQY" target="_blank" rel="noopener noreferrer">
            <Button text="Keep Me in the Loop" backgroundColor="#20a191" />
          </a>
        </p>
        <Link href="/">
          <Button text="Back to Home" backgroundColor="#20a191" />
        </Link>
      </div>
    </main>
  );
}
