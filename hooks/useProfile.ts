import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services';
import { useAuthStore } from '@/stores';

const PROFILE_QUERY_KEYS = {
  all: ['profile'] as const,
  current: () => [...PROFILE_QUERY_KEYS.all, 'current'] as const,
};

/**
 * Hook to fetch current user profile with real-time updates via socket
 */
export function useProfile(enabled = true) {
  const { setUser } = useAuthStore();

  return useQuery({
    queryKey: PROFILE_QUERY_KEYS.current(),
    queryFn: async () => {
      const user = await authService.getProfile();
      setUser(user);
      return user;
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

interface UpdateProfileData {
  name?: string;
  avatarUrl?: string;
  status?: string;
}

/**
 * Hook to update current user profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      return authService.updateProfile(data);
    },
    onSuccess: (updatedUser) => {
      // Update store
      setUser(updatedUser);

      // Update cache
      queryClient.setQueryData(PROFILE_QUERY_KEYS.current(), updatedUser);
    },
  });
}
