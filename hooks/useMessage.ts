import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { messageService, type SendMessageData, type GetMessagesOptions } from '@/services';
import type { Message } from '@/models';

const MESSAGES_KEY = (conversationId: number) => ['messages', conversationId] as const;

/**
 * Get messages with pagination
 */
export function useMessages(conversationId: number, options: GetMessagesOptions = {}) {
  return useQuery({
    queryKey: [...MESSAGES_KEY(conversationId), options],
    queryFn: () => messageService.getMessages(conversationId, options),
    enabled: !!conversationId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get messages with infinite scroll
 * Initial load: gets 30 newest messages
 * Pagination: loads older messages
 */
export function useInfiniteMessages(conversationId: number) {
  return useInfiniteQuery({
    queryKey: MESSAGES_KEY(conversationId),
    queryFn: ({ pageParam }) =>
      messageService.getMessages(conversationId, {
        limit: 30,
        before: pageParam, // undefined on first load, then oldest message ID for next pages
      }),
    getNextPageParam: (lastPage) => {
      // lastPage is in chronological order (oldest→newest)
      // To get even older messages, use the ID of the oldest message (first in array)
      if (!lastPage || !Array.isArray(lastPage) || lastPage.length === 0) {
        return undefined;
      }
      return lastPage[0].id; // Oldest message ID for next pagination
    },
    initialPageParam: undefined as number | undefined,
    enabled: !!conversationId,
  });
}

/**
 * Send message (REST fallback)
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendMessageData) => messageService.sendMessage(data),
    onSuccess: (message, variables) => {
      // Add new message to infinite query cache
      queryClient.setQueryData<any>(
        MESSAGES_KEY(variables.conversationId),
        (oldData: any) => {
          if (!oldData || !oldData.pages) return oldData;
          
          // Check if message already exists in any page
          const messageExists = oldData.pages.some((page: any[]) =>
            page.some((msg: any) => msg.id === message.id)
          );

          if (messageExists) {
            return oldData; // Don't add duplicates
          }

          // Add message to first page (newest messages)
          // First page contains newest messages for display
          const newPages = [
            [...(oldData.pages[0] || []), message],
            ...(oldData.pages.slice(1) || []),
          ];

          return {
            ...oldData,
            pages: newPages,
            pageParams: oldData.pageParams,
          };
        }
      );

      // Invalidate conversations list to update last message
      queryClient.invalidateQueries({
        queryKey: ['conversations'],
      });
    },
  });
}

/**
 * Mark conversation as read
 */
export function useMarkConversationAsRead() {
  return useMutation({
    mutationFn: (conversationId: number) =>
      messageService.markConversationAsRead(conversationId),
  });
}

/**
 * Mark message as delivered
 */
export function useMarkMessageAsDelivered() {
  return useMutation({
    mutationFn: (messageId: number) =>
      messageService.markAsDelivered(messageId),
  });
}

/**
 * Delete message
 */
export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: number) => messageService.deleteMessage(messageId),
    onSuccess: (_, messageId) => {
      // Update all message caches to mark as deleted
      queryClient.setQueriesData<any>(
        { queryKey: ['messages'] },
        (old: any) => {
          // Handle infinite query format
          if (old?.pages && Array.isArray(old.pages)) {
            return {
              ...old,
              pages: old.pages.map((page: Message[]) =>
                page.map((msg) =>
                  msg.id === messageId ? { ...msg, isDeleted: true } : msg
                )
              ),
            };
          }
          // Handle regular query format
          if (Array.isArray(old)) {
            return old.map((msg) =>
              msg.id === messageId ? { ...msg, isDeleted: true } : msg
            );
          }
          return old;
        }
      );
    },
  });
}

/**
 * Add new message to cache (for real-time updates)
 */
export function useAddMessage() {
  const queryClient = useQueryClient();

  return (message: Message) => {
    // Update infinite query cache with new message
    queryClient.setQueryData<any>(
      MESSAGES_KEY(message.conversationId),
      (old: any) => {
        if (!old || !old.pages) return old;

        // Check if message already exists
        let messageExists = false;
        for (const page of old.pages) {
          if (page.some((m: Message) => m.id === message.id)) {
            messageExists = true;
            break;
          }
        }

        if (messageExists) return old;

        // Add to first page (most recent messages)
        const newPages = [...old.pages];
        newPages[0] = [message, ...newPages[0]];

        return { ...old, pages: newPages };
      }
    );
  };
}

/**
 * Update message status in cache (for read receipts)
 */
export function useUpdateMessageStatus() {
  const queryClient = useQueryClient();

  return (conversationId: number, messageId: number, userId: number, status: string, readAt?: string) => {
    // Update all message queries for this conversation
    queryClient.setQueriesData<Message[]>(
      { queryKey: MESSAGES_KEY(conversationId) },
      (old) => {
        if (!old || !Array.isArray(old)) return old || [];
        return old.map((msg) => {
          if (msg.id === messageId) {
            const reads = msg.reads || [];
            const readIndex = reads.findIndex((r) => r.userId === userId);

            if (readIndex >= 0) {
              reads[readIndex] = { ...reads[readIndex], status: status as any, readAt };
            } else {
              reads.push({
                id: 0,
                messageId,
                userId,
                status: status as any,
                readAt,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }

            return { ...msg, reads: [...reads] };
          }
          return msg;
        });
      }
    );

    // Update infinite query if exists (handled by setQueriesData above with partial key matcher)
  };
}
