import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'pff-theme';
const DEFAULT_THEME = 'neon';
const THEMES = ['neon', 'modern'];

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
});

function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.remove('theme-neon', 'theme-modern');
  root.classList.add(theme === 'modern' ? 'theme-modern' : 'theme-neon');
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(raw) ? raw : DEFAULT_THEME;
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (nextTheme) => {
    setThemeState(THEMES.includes(nextTheme) ? nextTheme : DEFAULT_THEME);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'modern' ? 'neon' : 'modern'));
  };

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
