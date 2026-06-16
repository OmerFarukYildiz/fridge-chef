// ============================================================
// Fridge Chef — Tema Bağlamı (Dark / Light Mode)
// ============================================================
// AsyncStorage ile tema tercihi kalıcı olarak saklanır.
// useTheme() hook'u ile tüm ekranlarda erişilebilir.
// ============================================================

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors, AppThemeColors } from '../constants/Colors';

const THEME_KEY = '@fridge_chef_theme';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  colors: AppThemeColors;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  isDark: false,
  colors: LightColors,
  toggleTheme: async () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light') {
        setTheme(stored);
      }
    });
  }, []);

  const toggleTheme = async () => {
    const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    await AsyncStorage.setItem(THEME_KEY, next);
  };

  const isDark = theme === 'dark';
  const colors = isDark ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
