import { useQuery } from '@tanstack/react-query';
import { userService } from '@/services';

const USERS_SEARCH_KEY = (query: string) => ['users', 'search', query] as const;
const USER_KEY = (id: number) => ['users', id] as const;
const ALL_USERS_KEY = ['users', 'all'] as const;

/**
 * Search users
 */
export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: USERS_SEARCH_KEY(query),
    queryFn: () => userService.searchUsers(query),
    enabled: query.length >= 2,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get user by ID
 */
export function useUser(userId: number) {
  return useQuery({
    queryKey: USER_KEY(userId),
    queryFn: () => userService.getUser(userId),
    enabled: !!userId,
  });
}

/**
 * Get all users
 */
export function useAllUsers() {
  return useQuery({
    queryKey: ALL_USERS_KEY,
    queryFn: () => userService.getAllUsers(),
    staleTime: 300000, // 5 minutes
  });
}
