'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from '../page.module.css';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
}

export default function Tooltip({ content, children, delay = 150 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  const showTooltip = (event: React.MouseEvent) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Capture the bounding rect immediately to avoid null reference later
    const target = event.currentTarget;
    if (!target) return;
    
    const rect = target.getBoundingClientRect();
    const tooltipPosition = {
      x: rect.left - 8,
      y: rect.top + rect.height / 2
    };
    
    timeoutRef.current = setTimeout(() => {
      setPosition(tooltipPosition);
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={targetRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        style={{ display: 'inline-block' }}
      >
        {children}
      </div>
      
      {isVisible && (
        <div 
          className={styles.tooltip}
          style={{
            left: position.x,
            top: position.y,
          }}
        >
          {content}
          <div className={styles.tooltipArrow} />
        </div>
      )}
    </>
  );
} 