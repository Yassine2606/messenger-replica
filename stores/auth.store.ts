import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthResponse } from '@/models';
import { authService, apiClient } from '@/services';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isHydrating: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Async actions
  initializeAuth: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadProfile: () => Promise<void>;
  updateProfile: (data: { name?: string; avatarUrl?: string; status?: string }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isHydrating: true,
  error: null,

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  initializeAuth: async () => {
    try {
      const stored = await AsyncStorage.getItem('auth_token');
      if (stored) {
        set({ token: stored });
        apiClient.setToken(stored);
      }
    } catch (error) {
      console.error('[Auth] Failed to load token:', error);
    } finally {
      set({ isHydrating: false });
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.register({ email, password, name });
      await AsyncStorage.setItem('auth_token', response.token);
      apiClient.setToken(response.token);
      set({ user: response.user, token: response.token, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Registration failed',
        isLoading: false,
      });
      throw error;
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login({ email, password });
      await AsyncStorage.setItem('auth_token', response.token);
      apiClient.setToken(response.token);
      set({ user: response.user, token: response.token, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false,
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await authService.logout();
      await AsyncStorage.removeItem('auth_token');
      apiClient.clearToken();
      set({ user: null, token: null, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Logout failed',
        isLoading: false,
      });
      throw error;
    }
  },

  loadProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.getProfile();
      set({ user, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load profile',
        isLoading: false,
      });
      throw error;
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.updateProfile(data);
      set({ user, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update profile',
        isLoading: false,
      });
      throw error;
    }
  },
}));
