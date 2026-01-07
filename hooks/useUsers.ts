import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { User } from '@/models';
import { userService } from '@/services';

const USER_QUERY_KEYS = {
  all: ['users'] as const,
  search: (query: string) => [...USER_QUERY_KEYS.all, 'search', query] as const,
  detail: (userId: number) => [...USER_QUERY_KEYS.all, userId] as const,
  list: () => [...USER_QUERY_KEYS.all, 'list'] as const,
};

/**
 * Hook to search users by name or email with real-time results
 */
export function useSearchUsers(query: string, enabled = true): UseQueryResult<User[], Error> {
  return useQuery({
    queryKey: USER_QUERY_KEYS.search(query),
    queryFn: async () => {
      if (!query.trim()) return [];
      return userService.searchUsers(query);
    },
    enabled: enabled && !!query.trim(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

/**
 * Hook to get user by ID with real-time updates
 */
export function useGetUser(userId: number | null, enabled = true): UseQueryResult<User, Error> {
  return useQuery({
    queryKey: USER_QUERY_KEYS.detail(userId || 0),
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      return userService.getUser(userId);
    },
    enabled: enabled && !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to get all users with real-time updates
 */
export function useGetAllUsers(enabled = true): UseQueryResult<User[], Error> {
  return useQuery({
    queryKey: USER_QUERY_KEYS.list(),
    queryFn: async () => {
      return userService.getAllUsers();
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}