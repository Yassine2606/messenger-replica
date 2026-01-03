import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services';
import { type User } from '@/models';

interface AuthContextType {
  isAuthenticated: boolean;
  // Legacy support for existing screens
  isLoading?: boolean;
  setUser?: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from stored token on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('[AuthContext] Starting initialization...');
        await apiClient.initialize();
        
        // If token exists, fetch profile and cache it
        if (apiClient.isAuthenticated()) {
          console.log('[AuthContext] Token found, fetching profile...');
          try {
            const user = await apiClient.get<User>('/auth/profile');
            console.log('[AuthContext] Profile fetched:', user.name);
            // Cache the user data immediately
            queryClient.setQueryData(['auth', 'profile'], user);
            // Small delay to ensure cache is set before routing
            await new Promise(resolve => setTimeout(resolve, 50));
            setIsAuthenticated(true);
            console.log('[AuthContext] Auth state set to true');
          } catch (error) {
            console.error('[AuthContext] Token invalid, clearing:', error);
            await apiClient.clearToken();
            queryClient.removeQueries({ queryKey: ['auth', 'profile'] });
            setIsAuthenticated(false);
          }
        } else {
          console.log('[AuthContext] No token found');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('[AuthContext] Error initializing auth:', error);
        setIsAuthenticated(false);
      } finally {
        console.log('[AuthContext] Initialization complete');
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [queryClient]);

  // Legacy setUser support - updates cache AND auth state
  const setUser = useCallback(
    (user: User | null) => {
      if (user) {
        queryClient.setQueryData(['auth', 'profile'], user);
        setIsAuthenticated(true);
      } else {
        queryClient.removeQueries({ queryKey: ['auth', 'profile'] });
        setIsAuthenticated(false);
      }
    },
    [queryClient]
  );

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    setUser,
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
