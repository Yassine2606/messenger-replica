import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryResult,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { Message, MessageType, User, PaginatedResponse } from '@/models';
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
): UseQueryResult<PaginatedResponse<Message>, Error> {
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
 * Hook to fetch messages with infinite scroll/pagination for inverted FlatList
 * 
 * For inverted FlatList (newest messages first on screen):
 * - Initial load: No cursor → backend returns newest messages in DESC order
 * - Pagination: User scrolls down (toward old messages) → onEndReached fires
 * - Use getPreviousPageParam to load older messages using 'before' cursor
 * - Pages array grows: [newest, ..., oldest] but items display reversed
 */
export function useInfiniteMessages(conversationId: number | null, enabled = true) {
  return useInfiniteQuery({
    queryKey: messageQueryKeys.byConversation(conversationId || 0),
    queryFn: async ({ pageParam }: { pageParam?: string | number }) => {
      if (!conversationId) throw new Error('Conversation ID is required');
      return messageService.getMessages(conversationId, {
        limit: 20,
        before: pageParam ? Number(pageParam) : undefined,
      });
    },
    enabled: enabled && !!conversationId,
    initialPageParam: undefined as any,
    getNextPageParam: () => undefined, // Not used - only paginate backward
    getPreviousPageParam: (firstPage) => {
      if (!firstPage.pagination.hasPrevious) return undefined;
      // Use previousCursor to load older messages
      return firstPage.pagination.previousCursor;
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
  waveform?: number[];
  replyToId?: number;
}

/**
 * Hook to send a message with optimistic updates.
 *
 * Flow:
 * 1. onMutate: Add optimistic message to Zustand store with 'sending' status
 * 2. API call in background
 * 3. onSuccess: Update message to 'sent' and add to React Query cache
 * 4. onError: Update message to 'failed' in store
 *
 * The chat screen combines real messages from cache + optimistic from store.
 */
export function useSendMessage(conversationId: number) {
  const queryClient = useQueryClient();
  const { addOptimisticMessage, updateMessageStatus, removeOptimisticMessage } =
    useMessageStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      return messageService.sendMessage(input);
    },
    onMutate: async (input) => {
      const tempId = `temp-${Date.now()}-${Math.random()}`;

      // Build sender object
      const sender: Partial<User> = {
        id: user?.id ? Number(user.id) : 0,
        name: user?.name ? String(user.name) : 'Unknown',
        email: user?.email ? String(user.email) : '',
      };

      // Create optimistic message
      const optimisticMessage: Message = {
        id: 0, // Store will assign negative ID
        conversationId,
        senderId: user?.id ? Number(user.id) : 0,
        sender,
        type: input.type,
        content: input.content,
        mediaUrl: input.mediaUrl,
        mediaMimeType: input.mediaMimeType,
        mediaDuration: input.mediaDuration,
        waveform: input.waveform,
        replyToId: input.replyToId,
        isDeleted: false,
        reads: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to store with 'sending' status
      addOptimisticMessage(tempId, optimisticMessage);

      return { tempId };
    },
    onSuccess: (serverMessage, input, context) => {
      if (!context) return;

      // Add server message to React Query cache
      queryClient.setQueryData(
        messageQueryKeys.byConversation(conversationId),
        (old: any) => {
          if (!old) {
            return {
              pages: [{ data: [serverMessage], pagination: { hasNext: false, hasPrevious: false } }],
              pageParams: [undefined],
            };
          }

          // Handle infinite query pages structure
          if (old.pages && Array.isArray(old.pages)) {
            const newPages = [...old.pages];
            const lastPageIdx = newPages.length - 1;

            // Append to last page
            if (lastPageIdx >= 0 && newPages[lastPageIdx]?.data) {
              const lastPageData = newPages[lastPageIdx].data || [];
              const exists = lastPageData.some((m: Message) => m.id === serverMessage.id);
              if (!exists) {
                newPages[lastPageIdx] = {
                  ...newPages[lastPageIdx],
                  data: [...lastPageData, serverMessage],
                };
              }
            }

            return { ...old, pages: newPages };
          }

          return old;
        }
      );

      // Remove optimistic message from store
      removeOptimisticMessage(context.tempId);
    },
    onError: (error, input, context) => {
      if (!context) return;
      // Message stays in store with failed status for retry UI
      // User can retry or dismiss
      console.error('Failed to send message:', error);
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
      // Update cache for infinite query (which uses pages structure with PaginatedResponse)
      queryClient.setQueryData(messageQueryKeys.byConversation(conversationId), (old: any) => {
        if (!old || !old.pages) return old;

        const newPages = old.pages.map((page: any) => {
          if (page?.data && Array.isArray(page.data)) {
            // PaginatedResponse structure
            return {
              ...page,
              data: page.data.map((m: Message) => (m.id === messageId ? { ...m, isDeleted: true } : m)),
            };
          }
          // Legacy array structure
          return (page || []).map((m: Message) => (m.id === messageId ? { ...m, isDeleted: true } : m));
        });

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
