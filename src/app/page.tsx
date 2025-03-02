import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <Image src="/dolphinhero.png" alt="cxmpute logo" height={70} width={70}/>
        </div>

      </header>
      {/* Who is cxmpute for */}
      <div className={styles.content}></div>
    </div>

  );
}
