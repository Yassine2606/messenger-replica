import { useQuery, useMutation, useQueryClient, UseQueryResult, useInfiniteQuery, UseInfiniteQueryResult } from '@tanstack/react-query';
import { Message, MessageType, User } from '@/models';
import { messageQueryKeys } from '@/lib/query-keys';
import { messageService } from '@/services';
import { useMessageStore, useAuthStore } from '@/stores';

interface UseGetMessagesOptions {
  limit?: number;
  before?: number;
  after?: number;
}

/**
 * Hook to fetch messages for a conversation with real-time updates
 */
export function useGetMessages(
  conversationId: number | null,
  options: UseGetMessagesOptions = {},
  enabled = true
) {
  return useQuery({
    queryKey: messageQueryKeys.byConversation(conversationId || 0),
    queryFn: async () => {
      if (!conversationId) throw new Error('Conversation ID is required');
      return messageService.getMessages(conversationId, options);
    },
    enabled: enabled && !!conversationId,
    staleTime: Infinity, // Invalidate via socket events only
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to fetch messages with infinite scroll/pagination
 */
export function useInfiniteMessages(
  conversationId: number | null,
  enabled = true
) {
  return useInfiniteQuery({
    queryKey: messageQueryKeys.byConversation(conversationId || 0),
    queryFn: async ({ pageParam }: { pageParam?: number }) => {
      if (!conversationId) throw new Error('Conversation ID is required');
      return messageService.getMessages(conversationId, {
        limit: 20,
        before: pageParam,
      });
    },
    enabled: enabled && !!conversationId,
    initialPageParam: undefined as any,
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < 20) return undefined;
      // Use the ID of the oldest message as the 'before' cursor
      return lastPage[0]?.id;
    },
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Force refetch when invalidated, even with staleTime: Infinity
    refetchOnMount: false,
  });
}

interface SendMessageInput {
  conversationId: number;
  type: MessageType;
  content?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaDuration?: number;
  waveform?: number[]; // Audio waveform for audio messages
  replyToId?: number;
}

/**
 * Hook to send a message with optimistic updates and real-time confirmation
 */
export function useSendMessage(conversationId: number) {
  const queryClient = useQueryClient();
  const { addOptimisticMessage, confirmOptimisticMessage, removeOptimisticMessage } = useMessageStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const message = await messageService.sendMessage(input);
      return message;
    },
    onMutate: async (input) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: messageQueryKeys.byConversation(conversationId),
      });

      // Create plain sender object (avoid Zustand proxy issues)
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      let sender: Partial<User> | undefined;
      if (user) {
        sender = {
          id: Number(user.id),
          name: String(user.name),
          email: String(user.email),
        };
      }
      
      // Create optimistic message - store will assign unique negative ID
      const optimisticMessage: Message = {
        id: 0, // Placeholder, will be overwritten by store
        conversationId,
        senderId: user?.id ? Number(user.id) : 0,
        sender,
        type: input.type as MessageType,
        content: input.content ? String(input.content) : undefined,
        mediaUrl: input.mediaUrl ? String(input.mediaUrl) : undefined,
        mediaMimeType: input.mediaMimeType ? String(input.mediaMimeType) : undefined,
        mediaDuration: input.mediaDuration ? Number(input.mediaDuration) : undefined,
        waveform: input.waveform ? Array.from(input.waveform) : undefined,
        replyToId: input.replyToId ? Number(input.replyToId) : undefined,
        isDeleted: false,
        reads: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to store (which will assign unique negative ID)
      addOptimisticMessage(tempId, optimisticMessage, conversationId);

      // Get the actual optimistic message with correct ID from store
      const { getOptimisticMessage } = useMessageStore.getState();
      const actualOptimisticMessage = getOptimisticMessage(tempId) || optimisticMessage;

      // Don't update cache - the chat screen will combine real messages from cache
      // with optimistic messages from the store to avoid duplication
      
      return { tempId, optimisticMessage: actualOptimisticMessage };
    },
    onSuccess: (message, input, context) => {
      if (context) {
        // Confirm optimistic message - remove from store and add actual message to cache
        confirmOptimisticMessage(context.tempId, message);

        // Update cache with actual message
        queryClient.setQueryData(messageQueryKeys.byConversation(conversationId), (old: any) => {
          if (!old || !old.pages) return { pages: [[message]], pageParams: [] };
          const lastPageIndex = old.pages.length - 1;
          const newPages = [...old.pages];
          if (lastPageIndex >= 0 && Array.isArray(newPages[lastPageIndex])) {
            // Add the actual message from server
            newPages[lastPageIndex] = [...newPages[lastPageIndex], message];
          } else {
            newPages.push([message]);
          }
          return { ...old, pages: newPages };
        });
      }
    },
    onError: (error, input, context) => {
      console.error('onError: Failed to send message:', error);
      if (context) {
        // Revert optimistic update from store
        removeOptimisticMessage(context.tempId);
      }
    },
  });
}

/**
 * Hook to delete a message
 */
export function useDeleteMessage(conversationId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: number) => {
      await messageService.deleteMessage(messageId);
    },
    onSuccess: (_, messageId) => {
      // Update cache for infinite query (which uses pages structure)
      queryClient.setQueryData(messageQueryKeys.byConversation(conversationId), (old: any) => {
        if (!old || !old.pages) return old;
        
        const newPages = old.pages.map((page: Message[]) =>
          page.map((m: Message) => (m.id === messageId ? { ...m, isDeleted: true } : m))
        );
        
        return { ...old, pages: newPages };
      });
    },
  });
}

/**
 * Hook to search messages
 */
export function useSearchMessages(conversationId: number | null, query: string, enabled = false) {
  return useQuery({
    queryKey: [...messageQueryKeys.byConversation(conversationId || 0), 'search', query],
    queryFn: async () => {
      if (!conversationId) throw new Error('Conversation ID is required');
      return messageService.searchMessages(conversationId, query);
    },
    enabled: enabled && !!conversationId && !!query,
  });
}
