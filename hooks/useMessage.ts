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
 */
export function useInfiniteMessages(conversationId: number) {
  return useInfiniteQuery({
    queryKey: MESSAGES_KEY(conversationId),
    queryFn: ({ pageParam }) =>
      messageService.getMessages(conversationId, {
        limit: 30,
        before: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      if (lastPage.length === 0) return undefined;
      return lastPage[0].id; // Oldest message ID for pagination
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
      // Optimistically add message to cache immediately
      queryClient.setQueryData<Message[]>(
        MESSAGES_KEY(variables.conversationId),
        (old = []) => {
          // Check if message already exists (from socket)
          const exists = old.some((m) => m.id === message.id);
          if (exists) {
            return old;
          }
          return [...old, message];
        }
      );

      // Invalidate conversations list to update last message (not messages, we just updated them)
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
      queryClient.setQueriesData<Message[]>(
        { queryKey: ['messages'] },
        (old) =>
          old?.map((msg) =>
            msg.id === messageId ? { ...msg, isDeleted: true } : msg
          )
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
    queryClient.setQueryData<Message[]>(
      MESSAGES_KEY(message.conversationId),
      (old = []) => {
        // Prevent duplicates
        const exists = old.some((m) => m.id === message.id);
        return exists ? old : [...old, message];
      }
    );

    // Update infinite query if exists
    queryClient.setQueryData<any>(
      MESSAGES_KEY(message.conversationId),
      (old: any) => {
        if (!old?.pages) return old;

        const newPages = [...old.pages];
        const lastPage = newPages[newPages.length - 1];
        if (lastPage) {
          const exists = lastPage.some((m: Message) => m.id === message.id);
          if (!exists) {
            newPages[newPages.length - 1] = [...lastPage, message];
          }
        }

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
    queryClient.setQueryData<Message[]>(
      MESSAGES_KEY(conversationId),
      (old = []) =>
        old.map((msg) => {
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
        })
    );

    // Update infinite query if exists
    queryClient.setQueryData<any>(
      MESSAGES_KEY(conversationId),
      (old: any) => {
        if (!old?.pages) return old;

        const newPages = old.pages.map((page: Message[]) =>
          page.map((msg) => {
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
          })
        );

        return { ...old, pages: newPages };
      }
    );
  };
}
