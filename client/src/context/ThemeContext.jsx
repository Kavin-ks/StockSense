import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'stocksense-theme';

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme() {
  if (typeof window === 'undefined') return 'system';
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark' || val === 'system') return val;
  } catch (e) {}
  return 'system';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  // Keep system theme updated if user changes OS preferences
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemTheme(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  // Apply to DOM and persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {}
  }, [theme, resolvedTheme]);

  const setTheme = (next) => {
    setThemeState(next);
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const current = prev === 'system' ? systemTheme : prev;
      return current === 'dark' ? 'light' : 'dark';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
