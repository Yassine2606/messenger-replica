/**
 * Centralized React Query keys for the entire app
 * Prevents duplication and ensures consistent cache invalidation
 */

export const messageQueryKeys = {
  all: ['messages'] as const,
  byConversation: (conversationId: number) =>
    [...messageQueryKeys.all, 'conversation', conversationId] as const,
};

export const conversationQueryKeys = {
  all: ['conversations'] as const,
  list: () => [...conversationQueryKeys.all, 'list'] as const,
  detail: (conversationId: number) => [...conversationQueryKeys.all, 'detail', conversationId] as const,
};

export const userQueryKeys = {
  all: ['users'] as const,
  detail: (userId: number) => [...userQueryKeys.all, 'detail', userId] as const,
  list: () => [...userQueryKeys.all, 'list'] as const,
};

export const profileQueryKeys = {
  all: ['profile'] as const,
  current: () => [...profileQueryKeys.all, 'current'] as const,
};
