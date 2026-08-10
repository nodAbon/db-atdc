'use client';

import { useState, useEffect } from 'react';

export function usePersistentTheme(defaultTheme = 'dark') {
  const [theme, setThemeState] = useState(defaultTheme);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('db_atdc_theme');
      if (saved === 'light' || saved === 'dark') {
        setThemeState(saved);
        document.documentElement.setAttribute('data-theme', saved);
      } else {
        document.documentElement.setAttribute('data-theme', defaultTheme);
      }
    } catch {
      document.documentElement.setAttribute('data-theme', defaultTheme);
    }
  }, [defaultTheme]);

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
