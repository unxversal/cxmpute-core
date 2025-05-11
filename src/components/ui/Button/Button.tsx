// src/components/ui/Button/Button.tsx
"use client";

import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner'; // Assuming it's in the same ui folder

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost'; // Styling variants
  size?: 'sm' | 'md' | 'lg'; // Size variants
  isLoading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  className?: string; // Allow custom classes
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  iconLeft,
  iconRight,
  className = '',
  disabled,
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <button
      className={`${styles.buttonBase} ${styles[variant]} ${styles[size]} ${className}`}
      disabled={isDisabled}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <LoadingSpinner size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} color="currentColor" thickness={2} />
      ) : (
        <>
          {iconLeft && <span className={styles.iconWrapper}>{iconLeft}</span>}
          <span className={styles.buttonText}>{children}</span>
          {iconRight && <span className={styles.iconWrapper}>{iconRight}</span>}
        </>
      )}
    </button>
  );
};

export default Button;