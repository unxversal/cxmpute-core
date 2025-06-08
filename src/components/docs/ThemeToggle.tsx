"use client"

import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import styles from './ThemeToggle.module.css';

interface ThemeToggleProps {
  onThemeChange: (theme: 'light' | 'dark') => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ onThemeChange }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check if there's a saved theme preference
    const savedTheme = localStorage.getItem('docs-theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      onThemeChange(savedTheme);
    } else {
      // Default to light mode
      setTheme('light');
      onThemeChange('light');
    }
  }, [onThemeChange]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    onThemeChange(newTheme);
    localStorage.setItem('docs-theme', newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className={styles.themeToggle}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}; 