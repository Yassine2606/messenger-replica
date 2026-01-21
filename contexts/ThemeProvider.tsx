import React, { createContext, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, ThemeColors, ThemeContextType } from '@/theme/types';
import { lightColors, darkColors } from '@/theme/colors';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app_theme_preference';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [theme, setTheme] = React.useState<Theme>('light');
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Initialize theme on mount: check saved preference, fall back to system, default to light
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
          setTheme(saved);
        } else if (systemColorScheme === 'dark' || systemColorScheme === 'light') {
          setTheme(systemColorScheme);
        }
      } catch (error) {
        console.error('[Theme] Failed to load theme preference:', error);
      } finally {
        setIsHydrated(true);
      }
    };

    initializeTheme();
  }, [systemColorScheme]);

  const toggleTheme = useCallback(async () => {
    try {
      const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.error('[Theme] Failed to save theme preference:', error);
    }
  }, [theme]);

  const colors: ThemeColors = theme === 'light' ? lightColors : darkColors;

  const contextValue = React.useMemo(
    () => ({ theme, colors, toggleTheme }),
    [theme, colors, toggleTheme]
  );

  if (!isHydrated) {
    return null;
  }

  return (
    <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
