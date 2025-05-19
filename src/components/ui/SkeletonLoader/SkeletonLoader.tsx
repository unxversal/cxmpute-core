// src/components/ui/SkeletonLoader/SkeletonLoader.tsx
import React from 'react';
import styles from './SkeletonLoader.module.css';

interface SkeletonLoaderProps {
  type?: 'text' | 'title' | 'avatar' | 'rectangle' | 'circle';
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number; // Number of skeleton lines/items to render
  style?: React.CSSProperties;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type = 'text',
  width,
  height,
  className = '',
  count = 1,
  style,
}) => {
  const skeletons = [];

  for (let i = 0; i < count; i++) {
    const specificStyle: React.CSSProperties = { ...style };
    let typeClass = styles.text; // Default

    if (width) specificStyle.width = typeof width === 'number' ? `${width}px` : width;
    if (height) specificStyle.height = typeof height === 'number' ? `${height}px` : height;

    switch (type) {
      case 'title':
        typeClass = styles.title;
        if (!height) specificStyle.height = '24px'; // Default height for title
        if (!width) specificStyle.width = '60%';
        break;
      case 'avatar':
      case 'circle':
        typeClass = styles.circle;
        if (!width && !height) {
          specificStyle.width = '40px';
          specificStyle.height = '40px';
        } else if (width && !height) {
          specificStyle.height = typeof width === 'number' ? `${width}px` : width;
        } else if (height && !width) {
          specificStyle.width = typeof height === 'number' ? `${height}px` : height;
        }
        break;
      case 'rectangle':
        typeClass = styles.rectangle;
        if (!height) specificStyle.height = '80px'; // Default height for rectangle
        if (!width) specificStyle.width = '100%';
        break;
      case 'text':
      default:
        typeClass = styles.text;
        if (!height) specificStyle.height = '16px'; // Default height for text line
        if (!width && i < count -1 && count > 1) specificStyle.width = '100%'; // Full width for multi-line text
        else if (!width && count > 1) specificStyle.width = '80%'; // Last line shorter
        else if (!width) specificStyle.width = '100%';
        break;
    }

    skeletons.push(
      <div
        key={i}
        className={`${styles.skeleton} ${typeClass} ${className}`}
        style={specificStyle}
        aria-busy="true"
        aria-live="polite"
      />
    );
  }

  if (count > 1) {
    return <div className={styles.skeletonWrapper}>{skeletons}</div>;
  }
  return skeletons[0];
};

export default SkeletonLoader;