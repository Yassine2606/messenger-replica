import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services';
import { useAuthStore } from '@/stores';

/**
 * Hook to register a new user
 */
export function useRegister() {
  const { setUser, setToken } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { email: string; password: string; name: string }) => {
      return authService.register(data);
    },
    onSuccess: (response) => {
      setUser(response.user);
      setToken(response.token);
      // Clear all queries on login
      queryClient.clear();
    },
  });
}

/**
 * Hook to login user
 */
export function useLogin() {
  const { setUser, setToken } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      return authService.login(data);
    },
    onSuccess: (response) => {
      setUser(response.user);
      setToken(response.token);
      // Clear all queries on login
      queryClient.clear();
    },
  });
}

/**
 * Hook to logout user
 */
export function useLogout() {
  const { setUser, setToken } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await authService.logout();
    },
    onSuccess: () => {
      setUser(null);
      setToken(null);
      // Clear all queries on logout
      queryClient.clear();
    },
  });
}
