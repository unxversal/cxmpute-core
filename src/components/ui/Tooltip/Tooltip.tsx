// src/components/ui/Tooltip/Tooltip.tsx
import React, { ReactNode, useState } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: ReactNode; // What the tooltip displays
  children: ReactNode; // The element that triggers the tooltip on hover
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string; // For additional custom styling of the wrapper
  delay?: number; // Delay in ms before showing the tooltip
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  className = '',
  delay = 200, // Default delay
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isActuallyVisible, setIsActuallyVisible] = useState(false); // For delay
  let timeoutId: NodeJS.Timeout | null = null;

  const handleMouseEnter = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      setIsVisible(true);
      // Add a micro-delay for the CSS transition to pick up the change
      setTimeout(() => setIsActuallyVisible(true), 10);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsActuallyVisible(false);
    // Allow CSS transition to finish before setting isVisible to false
    setTimeout(() => setIsVisible(false), 150); // Match transition duration
  };

  return (
    <div
      className={`${styles.tooltipWrapper} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter} // For accessibility with keyboard navigation
      onBlur={handleMouseLeave}   // For accessibility
      tabIndex={0} // Make it focusable if the child isn't inherently
    >
      {children}
      {isVisible && (
        <div
          className={`${styles.tooltipBox} ${styles[position]} ${isActuallyVisible ? styles.visible : ''}`}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;