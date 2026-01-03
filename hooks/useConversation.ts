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
      console.log('[useConversations] Fetching conversations...');
      try {
        const result = await conversationService.getConversations();
        console.log('[useConversations] Fetched', result.length, 'conversations');
        return result;
      } catch (error) {
        console.error('[useConversations] Error:', error);
        throw error;
      }
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
    // Update in list
    queryClient.setQueryData<Conversation[]>(CONVERSATIONS_KEY, (old = []) => {
      const index = old.findIndex((c) => c.id === conversation.id);
      if (index === -1) return [conversation, ...old];
      
      const newList = [...old];
      newList[index] = conversation;
      return newList;
    });

    // Update individual cache
    queryClient.setQueryData(CONVERSATION_KEY(conversation.id), conversation);
  };
}
