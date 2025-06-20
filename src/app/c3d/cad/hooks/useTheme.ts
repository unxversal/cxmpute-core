'use client';

import { atom, useAtom } from 'jotai';
import { useEffect } from 'react';

type Theme = 'dark' | 'light';

// Theme atom
const themeAtom = atom<Theme>('dark');

// Persisted theme atom that syncs with localStorage
const persistedThemeAtom = atom(
  (get) => get(themeAtom),
  (get, set, newTheme: Theme) => {
    set(themeAtom, newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cad-theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  }
);

export function useTheme() {
  const [theme, setTheme] = useAtom(persistedThemeAtom);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('cad-theme') as Theme;
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const initialTheme = savedTheme || systemTheme;
      
      setTheme(initialTheme);
      document.documentElement.setAttribute('data-theme', initialTheme);
    }
  }, [setTheme]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light'
  };
} 