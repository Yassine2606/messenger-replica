import { useQuery, useMutation, useQueryClient, UseQueryResult, useInfiniteQuery } from '@tanstack/react-query';
import { Conversation, PaginatedResponse, GetConversationsOptions } from '@/models';
import { conversationQueryKeys } from '@/lib/query-keys';
import { conversationService } from '@/services';

/**
 * Hook to fetch all conversations for current user with real-time updates via socket
 */
export function useGetConversations(
  options: GetConversationsOptions = {},
  enabled = true
): UseQueryResult<PaginatedResponse<Conversation>, Error> {
  return useQuery({
    queryKey: conversationQueryKeys.list(options),
    queryFn: async () => conversationService.getConversations(options),
    enabled,
    staleTime: Infinity, // Socket handles all updates
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to fetch single conversation by ID with real-time updates via socket
 */
export function useGetConversation(
  conversationId: number | null,
  enabled = true
): UseQueryResult<Conversation, Error> {
  return useQuery({
    queryKey: conversationQueryKeys.detail(conversationId || 0),
    queryFn: async () => {
      if (!conversationId) throw new Error('Conversation ID is required');
      return conversationService.getConversation(conversationId);
    },
    enabled: enabled && !!conversationId,
    staleTime: Infinity, // Socket handles all updates
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to fetch conversations with infinite scroll/pagination
 */
export function useInfiniteConversations(enabled = true) {
  return useInfiniteQuery({
    queryKey: conversationQueryKeys.infinite(),
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      return conversationService.getConversations({
        limit: 20,
        before: pageParam,
      });
    },
    enabled,
    initialPageParam: undefined as any,
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination.hasNext) return undefined;
      // Use the composite cursor from pagination metadata
      return lastPage.pagination.nextCursor;
    },
    getPreviousPageParam: (firstPage) => {
      if (!firstPage.pagination.hasPrevious) return undefined;
      // Use the previous cursor for backwards pagination
      return firstPage.pagination.previousCursor;
    },
    staleTime: Infinity, // Invalidate via socket events only
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnMount: false,
  });
}

/**
 * Hook to create or get existing 1:1 conversation
 * Optimistic: add to cache immediately, socket confirms with first message
 */
export function useCreateOrGetConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (otherUserId: number) => {
      return conversationService.createOrGetConversation(otherUserId);
    },
    onSuccess: (conversation) => {
      // Optimistic: add to infinite conversations cache immediately
      queryClient.setQueryData(conversationQueryKeys.infinite(), (old: any) => {
        if (!old?.pages) return old;
        const exists = old.pages[0]?.data?.some((c: any) => c.id === conversation.id);
        if (exists) return old; // Already exists
        
        return {
          ...old,
          pages: [
            {
              ...old.pages[0],
              data: [conversation, ...(old.pages[0]?.data || [])],
            },
            ...old.pages.slice(1),
          ],
        };
      });

      // Also set detail cache
      queryClient.setQueryData(conversationQueryKeys.detail(conversation.id), conversation);
    },
  });
}

/**
 * Hook to leave a conversation (remove current user from it)
 * Optimistic: remove from cache immediately, socket confirms deletion
 */
export function useLeaveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: number) => {
      return conversationService.leaveConversation(conversationId);
    },
    onMutate: async (conversationId: number) => {
      // Cancel any in-flight requests
      await queryClient.cancelQueries({ queryKey: conversationQueryKeys.all });

      // Optimistically remove from infinite conversations cache
      const previousData = queryClient.getQueryData(conversationQueryKeys.infinite());
      queryClient.setQueryData(conversationQueryKeys.infinite(), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.filter((c: any) => c.id !== conversationId),
          })),
        };
      });

      // Remove detail cache
      queryClient.removeQueries({ queryKey: conversationQueryKeys.detail(conversationId) });

      return { previousData };
    },
    onError: (error, conversationId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(conversationQueryKeys.infinite(), context.previousData);
      }
    },
    onSuccess: () => {
      // Re-sync conversations list from server
      queryClient.invalidateQueries({ queryKey: conversationQueryKeys.list() });
    },
  });
}
