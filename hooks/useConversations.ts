import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Conversation } from '@/models';
import { conversationQueryKeys } from '@/lib/query-keys';
import { conversationService } from '@/services';

/**
 * Hook to fetch all conversations for current user with real-time updates via socket
 */
export function useGetConversations(enabled = true): UseQueryResult<Conversation[], Error> {
  return useQuery({
    queryKey: conversationQueryKeys.list(),
    queryFn: async () => {
      return conversationService.getConversations();
    },
    enabled,
    staleTime: Infinity, // Invalidate via socket events only
    gcTime: 5 * 60 * 1000, // 5 minutes
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
    staleTime: Infinity, // Invalidate via socket events only
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to create or get existing 1:1 conversation
 */
export function useCreateOrGetConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (otherUserId: number) => {
      return conversationService.createOrGetConversation(otherUserId);
    },
    onSuccess: (conversation) => {
      // Add to conversations list cache
      queryClient.setQueryData(conversationQueryKeys.list(), (old: Conversation[] | undefined) => {
        if (!old) return [conversation];
        // Replace if exists, otherwise add
        const exists = old.find((c) => c.id === conversation.id);
        return exists ? old.map((c) => (c.id === conversation.id ? conversation : c)) : [conversation, ...old];
      });

      // Set detail cache
      queryClient.setQueryData(conversationQueryKeys.detail(conversation.id), conversation);
    },
  });
}
