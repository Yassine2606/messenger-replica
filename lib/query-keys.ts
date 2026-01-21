/**
 * Centralized React Query keys for the entire app
 * Prevents duplication and ensures consistent cache invalidation
 */

export const messageQueryKeys = {
  all: ['messages'] as const,
  byConversation: (conversationId: number, options?: { limit?: number; before?: number; after?: number }) =>
    [...messageQueryKeys.all, 'conversation', conversationId, options] as const,
  infinite: (conversationId: number, options?: { limit?: number; before?: number; after?: number }) =>
    [...messageQueryKeys.all, 'infinite', conversationId, options] as const,
};

export const conversationQueryKeys = {
  all: ['conversations'] as const,
  list: (options?: { limit?: number; before?: string; after?: string }) =>
    [...conversationQueryKeys.all, 'list', options] as const,
  infinite: (options?: { limit?: number; before?: string; after?: string }) =>
    [...conversationQueryKeys.all, 'infinite', options] as const,
  detail: (conversationId: number) =>
    [...conversationQueryKeys.all, 'detail', conversationId] as const,
};

export const userQueryKeys = {
  all: ['users'] as const,
  search: (query: string, options?: { limit?: number; before?: number; after?: number }) =>
    [...userQueryKeys.all, 'search', query, options] as const,
  detail: (userId: number) => [...userQueryKeys.all, 'detail', userId] as const,
  list: (options?: { limit?: number; before?: number; after?: number }) =>
    [...userQueryKeys.all, 'list', options] as const,
};

export const profileQueryKeys = {
  all: ['profile'] as const,
  current: () => [...profileQueryKeys.all, 'current'] as const,
};
