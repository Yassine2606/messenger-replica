import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuthStore } from '@/stores';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/services';

interface AuthContextType {
  isHydrated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isHydrated, setIsHydrated] = React.useState(false);
  const { setToken, token } = useAuthStore();

  useEffect(() => {
    const loadToken = async () => {
      try {
        const stored = await AsyncStorage.getItem('auth_token');
        if (stored) {
          setToken(stored);
          apiClient.setToken(stored);
        }
      } catch (error) {
        console.error('[Auth] Failed to load token:', error);
      } finally {
        setIsHydrated(true);
      }
    };

    loadToken();
  }, [setToken]);

  // Save token to AsyncStorage and sync ApiClient when it changes
  useEffect(() => {
    const saveToken = async () => {
      try {
        if (token) {
          await AsyncStorage.setItem('auth_token', token);
          apiClient.setToken(token);
        } else {
          await AsyncStorage.removeItem('auth_token');
          apiClient.clearToken();
        }
      } catch (error) {
        console.error('[Auth] Failed to save token:', error);
      }
    };

    if (isHydrated) {
      saveToken();
    }
  }, [token, isHydrated]);

  return (
    <AuthContext.Provider value={{ isHydrated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
