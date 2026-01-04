import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationService } from '@/services';
import type { Conversation } from '@/models';

const CONVERSATIONS_KEY = ['conversations'] as const;
const CONVERSATION_KEY = (id: number) => ['conversations', id] as const;

/**
 * Get all conversations
 */
export function useConversations() {
  return useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: async () => {
      const result = await conversationService.getConversations();
      return result.sort((a, b) => {
        const aTime = new Date(a.lastMessageAt || a.updatedAt).getTime();
        const bTime = new Date(b.lastMessageAt || b.updatedAt).getTime();
        return bTime - aTime;
      });
    },
    staleTime: 30000, // 30 seconds
    retry: 1,
  });
}

/**
 * Get single conversation
 */
export function useConversation(conversationId: number) {
  return useQuery({
    queryKey: CONVERSATION_KEY(conversationId),
    queryFn: () => conversationService.getConversation(conversationId),
    enabled: !!conversationId,
  });
}

/**
 * Create or get conversation
 */
export function useCreateOrGetConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (otherUserId: number) =>
      conversationService.createOrGetConversation(otherUserId),
    onSuccess: (conversation) => {
      // Add to conversations list
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_KEY, (old = []) => {
        const exists = old.some((c) => c.id === conversation.id);
        return exists ? old : [conversation, ...old];
      });

      // Set individual conversation cache
      queryClient.setQueryData(CONVERSATION_KEY(conversation.id), conversation);
    },
  });
}

/**
 * Update conversation in cache (for real-time updates)
 */
export function useUpdateConversation() {
  const queryClient = useQueryClient();

  return (conversation: Conversation) => {
    // Update in list with proper sorting
    queryClient.setQueryData<Conversation[]>(CONVERSATIONS_KEY, (old = []) => {
      const filtered = old.filter((c) => c.id !== conversation.id);
      // Add updated conversation at the top (most recent)
      return [conversation, ...filtered];
    });

    // Update individual cache
    queryClient.setQueryData(CONVERSATION_KEY(conversation.id), conversation);
  };
}

/**
 * Mark conversation as read and update unread count
 */
export function useMarkConversationAsReadOptimistic() {
  const queryClient = useQueryClient();

  return (conversationId: number) => {
    // Optimistically update conversations list to set unreadCount to 0
    queryClient.setQueryData<Conversation[]>(CONVERSATIONS_KEY, (old = []) => {
      return old.map((conv) => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            unreadCount: 0,
          };
        }
        return conv;
      });
    });

    // Also update specific conversation cache
    queryClient.setQueryData<Conversation>(CONVERSATION_KEY(conversationId), (old) => {
      if (!old) return old;
      return {
        ...old,
        unreadCount: 0,
      };
    });
  };
}
