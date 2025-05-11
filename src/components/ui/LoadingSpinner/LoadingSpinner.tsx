// src/components/ui/LoadingSpinner/LoadingSpinner.tsx
import React from 'react';
import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  size?: number; // Size in pixels
  color?: string; // Primary color of the spinner
  thickness?: number; // Border thickness
  className?: string; // For additional custom styling
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 32,
  color = '#60a5fa', // A light blue, good for dark themes
  thickness = 4,
  className = '',
}) => {
  const spinnerStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderWidth: `${thickness}px`,
    borderColor: color,
    borderTopColor: 'transparent', // Makes the spinning effect
  };

  return (
    <div
      className={`${styles.spinner} ${className}`}
      style={spinnerStyle}
      role="status"
      aria-label="Loading..."
    >
      <span className={styles.visuallyHidden}>Loading...</span>
    </div>
  );
};

export default LoadingSpinner;