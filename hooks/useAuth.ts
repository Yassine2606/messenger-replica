import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService, type LoginData, type RegisterData } from '@/services';
import { type User, type AuthResponse } from '@/models';

const AUTH_QUERY_KEY = ['auth'] as const;
const PROFILE_QUERY_KEY = ['auth', 'profile'] as const;

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LoginData): Promise<AuthResponse> => {
      return authService.login(data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, data.user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RegisterData): Promise<AuthResponse> => {
      return authService.register(data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, data.user);
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => authService.getProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes - don't refetch during this time
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
    retry: false, // Don't retry on auth errors
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    refetchOnWindowFocus: false, // Don't refetch on focus
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
}
