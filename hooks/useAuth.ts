import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService, type LoginData, type RegisterData } from '@/services';
import { type User, type AuthResponse } from '@/models';

const AUTH_QUERY_KEY = ['auth'] as const;
const PROFILE_QUERY_KEY = ['auth', 'profile'] as const;

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LoginData): Promise<AuthResponse> => {
      const response = await authService.login(data);
      // Cache the user immediately
      queryClient.setQueryData(PROFILE_QUERY_KEY, response.user);
      return response;
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RegisterData): Promise<AuthResponse> => {
      const response = await authService.register(data);
      // Cache the user immediately
      queryClient.setQueryData(PROFILE_QUERY_KEY, response.user);
      return response;
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => authService.getProfile(),
    staleTime: Infinity, // Never consider stale - only refetch on explicit invalidation
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    retry: false, // Don't retry on auth errors
    refetchOnMount: false, // Don't refetch on mount
    refetchOnWindowFocus: false, // Don't refetch on focus
    refetchOnReconnect: false, // Don't refetch on reconnect
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name?: string;
      avatarUrl?: string;
      status?: string;
    }): Promise<User> => {
      return authService.updateProfile(data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, data);
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => authService.logout(),
  });
}
