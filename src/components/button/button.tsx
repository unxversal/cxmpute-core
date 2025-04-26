import React from "react";
import styles from "./button.module.css";

type ButtonProps = {
  text: string;
  backgroundColor?: string;
  disabled?: boolean; // add this line
  onClick?: () => void;
};

const Button: React.FC<ButtonProps> = ({ text, backgroundColor = "white", disabled, onClick }) => {
  return (
    <button
      className={styles.button}
      style={{ backgroundColor }}
      disabled={disabled} // add this line
      onClick={onClick}
    >
      {text}
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
  );
};

export default Button;
