import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuthStore } from '@/stores';
import * as SecureStore from 'expo-secure-store';

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
        const stored = await SecureStore.getItemAsync('authToken');
        if (stored) {
          setToken(stored);
        }
      } catch (error) {
        console.error('[Auth] Failed to load token:', error);
      } finally {
        setIsHydrated(true);
      }
    };

    loadToken();
  }, [setToken]);

  // Save token to secure storage when it changes
  useEffect(() => {
    const saveToken = async () => {
      try {
        if (token) {
          await SecureStore.setItemAsync('authToken', token);
        } else {
          await SecureStore.deleteItemAsync('authToken');
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
