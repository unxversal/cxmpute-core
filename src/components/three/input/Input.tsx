import styles from "./input.module.css";

export default function Input() {

  return (
    <main className={styles.main}>
      <div className={styles.input}></div>
      <div className={styles.buttons}>
        <div className={styles.left}></div>
        <div className={styles.left}></div>
      </div>
    </main>
  );
}