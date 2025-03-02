import Image from "next/image";
import styles from "./page.module.css";
import Button from "@/components/button/button";

const cxmputeGreen = "#20a191";
const cxmputePink = "#fe91e8";
const cxmputeYellow = "f8cb46";
const cxmputePurple = "#91a8eb";
const cxmputeRed = "#d64989";
const cxmputeSand = "#d4d4cb";
const cxmputeSlate = "#d4d4cb";
const cxmputeBeige = "#f9f5f2";
const cxmputeBeigerBeige = "#fdede3";


export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <Image src="/1.png" alt="cxmpute logo" height={70} width={70}/>
          <h1>CXMPUTE</h1>
        </div>
        <div className={styles.menu}>
          <ul>
            <li><a href="/download">
              <Button text="DOWNLOAD" backgroundColor="#f0f0f0" />
            </a></li>
            <li><a href="/docs">DOCUMENTATION</a></li>
            <li><a href="/dashboard">OPEN DASHBOARD</a></li>
          </ul>
        </div>
      </header>
      {/* Who is cxmpute for */}
      <div className={styles.content}></div>
    </div>

  );
}
