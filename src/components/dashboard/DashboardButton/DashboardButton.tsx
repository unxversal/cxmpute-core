/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/dashboard/DashboardButton/DashboardButton.tsx
"use client";

import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import styles from './DashboardButton.module.css';

// Minimalist loading text/animation that fits the playful theme
const PlayfulLoadingSpinner = () => (
  <span className={styles.loadingDots}>
    <span>.</span><span>.</span><span>.</span>
  </span>
);

type DashboardButtonVariant =
  | "primary" // Green
  | "secondary" // Slate
  | "accentPurple"
  | "accentYellow"
  | "accentPink"
  | "accentOrange"
  | "danger" // Red
  | "ghost"
  | "linkStyle"; // Looks like text, acts like button/link

interface DashboardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  text?: string; // Alternative to children for simple text
  variant?: DashboardButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
  href?: string; // If provided, renders as an 'a' tag styled as a button
  target?: string;
  rel?: string;
  // backgroundColor prop is removed in favor of variants for thematic consistency
}

const DashboardButton: React.FC<DashboardButtonProps> = ({
  children,
  text,
  variant = 'secondary', // Default to slate for general use
  size = 'md',
  isLoading = false,
  iconLeft,
  iconRight,
  className = '',
  href,
  target,
  rel,
  disabled,
  onClick,
  type = 'button', // Default button type
  ...props
}) => {
  const isDisabled = disabled || isLoading;
  const content = text || children;

  const buttonClasses = [
    styles.buttonBase,
    styles[variant],
    styles[size],
    className,
    isLoading ? styles.loading : '',
  ].filter(Boolean).join(' ');

  const buttonContent = (
    <>
      {isLoading && <PlayfulLoadingSpinner />}
      {!isLoading && iconLeft && <span className={styles.iconWrapper}>{iconLeft}</span>}
      {!isLoading && <span className={styles.buttonText}>{content}</span>}
      {!isLoading && iconRight && <span className={styles.iconWrapper}>{iconRight}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} passHref legacyBehavior>
        <a
          className={buttonClasses}
          target={target}
          rel={rel}
          onClick={isDisabled ? (e) => e.preventDefault() : onClick as any} // Type assertion for anchor onClick
          aria-disabled={isDisabled}
          role="button" // For accessibility if it's styled like a button
          {...(props as any)} // Spread remaining props, careful with anchor-specific ones
        >
          {buttonContent}
        </a>
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={buttonClasses}
      disabled={isDisabled}
      onClick={onClick}
      aria-busy={isLoading}
      {...props}
    >
      {buttonContent}
    </button>
  );
};

export default DashboardButton;