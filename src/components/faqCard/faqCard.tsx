"use client";
import { useState } from "react";
import styles from "./faqCard.module.css";

interface FAQCardProps {
  question: string;
  answer: string;
}

export default function FAQCard({ question, answer }: FAQCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleAnswer = () => setIsOpen((prev) => !prev);

  return (
    <div className={styles.faqCard}>
      <div className={styles.faqCardHeader} onClick={toggleAnswer}>
        <h1>{question}</h1>
        <h1>{isOpen ? "-" : "+"}</h1>
      </div>
      {isOpen && (
        <div className={styles.faqCardText}>
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
}
