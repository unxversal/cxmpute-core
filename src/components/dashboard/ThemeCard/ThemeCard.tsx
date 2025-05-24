// src/components/dashboard/ThemeCard/ThemeCard.tsx
"use client";

import React, { ReactNode } from 'react';
import styles from './ThemeCard.module.css';

interface ThemeCardProps {
  title?: string;
  children: ReactNode;
  className?: string; // For additional custom styling on the root card element
  headerActions?: ReactNode; // For elements like buttons or icons in the header
  cardStyle?: React.CSSProperties; // For dynamic inline styles (e.g., backgroundColor)
  titleClassName?: string; // For custom styling of the title
  contentClassName?: string; // For custom styling of the content wrapper
  noHoverEffect?: boolean; // Option to disable the hover transform/shadow effect
}

const ThemeCard: React.FC<ThemeCardProps> = ({
  title,
  children,
  className = '',
  headerActions,
  cardStyle,
  titleClassName = '',
  contentClassName = '',
  noHoverEffect = false,
}) => {
  return (
    <div
      className={`${styles.themeCardBase} ${noHoverEffect ? styles.noHover : ''} ${className}`}
      style={cardStyle}
    >
      {(title || headerActions) && (
        <div className={styles.cardHeader}>
          {title && <h3 className={`${styles.cardTitle} ${titleClassName}`}>{title}</h3>}
          {headerActions && <div className={styles.headerActionsContainer}>{headerActions}</div>}
        </div>
      )}
      <div className={`${styles.cardContent} ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
};

export default ThemeCard;