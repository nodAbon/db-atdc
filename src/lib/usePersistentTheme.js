'use client';

import { useState, useEffect } from 'react';

export function usePersistentTheme(defaultTheme = 'light') {
  const [theme, setThemeState] = useState('light');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('db_atdc_theme');
      if (saved === 'dark') {
        setThemeState('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        setThemeState('light');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const setTheme = (nextTheme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem('db_atdc_theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
    } catch (e) {
      console.error(e);
    }
  };

  return [theme, setTheme];
}
