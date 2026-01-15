import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark';

interface ThemeColors {
  // Backgrounds
  background: string;
  cardBackground: string;
  headerBackground: string;
  
  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  
  // Borders
  border: string;
  borderLight: string;
  
  // Accents
  primary: string;
  primaryLight: string;
  success: string;
  error: string;
  warning: string;
  
  // Special
  modalOverlay: string;
  shadow: string;
}

interface ThemeContextType {
  theme: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const lightColors: ThemeColors = {
  background: '#ffffff',
  cardBackground: '#f8fafc',
  headerBackground: '#f1f5f9',
  
  text: '#1e293b',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  
  primary: '#2563eb',
  primaryLight: '#93c5fd',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  
  modalOverlay: 'rgba(0, 0, 0, 0.5)',
  shadow: '#000000',
};

const darkColors: ThemeColors = {
  background: '#0f172a',
  cardBackground: '#1e293b',
  headerBackground: '#1e293b',
  
  text: '#ffffff',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',
  
  border: '#334155',
  borderLight: '#475569',
  
  primary: '#2563eb',
  primaryLight: '#93c5fd',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  
  modalOverlay: 'rgba(0, 0, 0, 0.7)',
  shadow: '#000000',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = theme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
      await AsyncStorage.setItem('theme', newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const colors = theme === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
