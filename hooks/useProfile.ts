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
 * Socket broadcasts user:status updates in real-time
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      return authService.updateProfile(data);
    },
    onSuccess: (updatedUser) => {
      // Update store and cache immediately (socket will broadcast confirmation)
      setUser(updatedUser);
      queryClient.setQueryData(PROFILE_QUERY_KEYS.current(), updatedUser);
    },
    onError: (error) => {
      console.error('useUpdateProfile: Error occurred:', error);
    },
  });
}
