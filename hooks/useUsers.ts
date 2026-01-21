import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { User, PaginatedResponse, SearchUsersOptions, GetAllUsersOptions } from '@/models';
import { userService } from '@/services';
import { userQueryKeys } from '@/lib/query-keys';

/**
 * Hook to search users by name or email with real-time results
 */
export function useSearchUsers(
  query: string,
  options: SearchUsersOptions = {},
  enabled = true
): UseQueryResult<PaginatedResponse<User>, Error> {
  return useQuery({
    queryKey: userQueryKeys.search(query, options),
    queryFn: async () => {
      if (!query.trim()) return { data: [], pagination: { hasNext: false, hasPrevious: false } };
      return userService.searchUsers(query, options);
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
    queryKey: userQueryKeys.detail(userId || 0),
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
export function useGetAllUsers(
  options: GetAllUsersOptions = {},
  enabled = true
): UseQueryResult<PaginatedResponse<User>, Error> {
  return useQuery({
    queryKey: userQueryKeys.list(options),
    queryFn: async () => {
      return userService.getAllUsers(options);
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
