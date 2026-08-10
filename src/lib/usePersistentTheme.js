'use client';

import { useState, useEffect } from 'react';

export function usePersistentTheme(defaultTheme = 'light') {
  const [theme, setThemeState] = useState('light');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('db_atdc_theme') || localStorage.getItem('theme') || defaultTheme;
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
  }, [defaultTheme]);

  const setTheme = (nextTheme) => {
    const value = typeof nextTheme === 'function' ? nextTheme(theme) : nextTheme;
    setThemeState(value);
    try {
      localStorage.setItem('db_atdc_theme', value);
      localStorage.setItem('theme', value);
      document.documentElement.setAttribute('data-theme', value);
    } catch (e) {
      console.error(e);
    }
  };

  return [theme, setTheme];
}
