import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services';
import { socketClient } from '@/lib/socket';
import { type User } from '@/models';

interface AuthContextType {
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await apiClient.initialize();
        const isAuth = apiClient.isAuthenticated();
        setIsAuthenticated(isAuth);

        // Connect socket only if authenticated (socket connect has built-in guard against duplicates)
        if (isAuth) {
          const token = await apiClient.getToken();
          if (token && !socketClient.isConnected()) {
            socketClient.connect(token);
          }
        }
      } catch (error) {
        console.error('[Auth] Initialization error:', error);
        setIsAuthenticated(false);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(
    (token: string, user: User) => {
      apiClient.setToken(token);
      // Connect socket only if not already connected
      if (!socketClient.isConnected()) {
        socketClient.connect(token);
      }
      queryClient.setQueryData(['auth', 'profile'], user);
      setIsAuthenticated(true);
    },
    [queryClient]
  );

  const logout = useCallback(async () => {
    await apiClient.clearToken();
    socketClient.disconnect();
    queryClient.clear();
    setIsAuthenticated(false);
  }, [queryClient]);

  const value: AuthContextType = {
    isAuthenticated,
    isInitialized,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
