import { useMemo, useCallback } from 'react';
import { Message, PaginatedResponse } from '@/models';
import { useMessageStore } from '@/stores';

/**
 * Manages message list state and combining optimistic with backend messages
 */
export function useChatMessages(
  conversationId: number,
  data: { pages: PaginatedResponse<Message>[] } | undefined
) {
  const { optimisticMessages } = useMessageStore();

  // Extract backend messages from paginated data
  const messages = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page: PaginatedResponse<Message>) => page.data);
  }, [data]);

  // Get optimistic messages for this conversation
  const conversationOptimisticMessages = useMemo(
    () =>
      Array.from(optimisticMessages.values()).filter(
        (msg) => msg.conversationId === conversationId
      ),
    [optimisticMessages, conversationId]
  );

  // Combine optimistic and backend messages, deduplicate
  const combinedMessages = useMemo(() => {
    // Place optimistic messages first (they're usually the newest) then backend messages (already newest-first)
    const combined = [...conversationOptimisticMessages, ...(messages || [])];
    const seen = new Set<number>();
    const deduped: Message[] = [];
    for (const msg of combined) {
      if (!seen.has(msg.id)) {
        seen.add(msg.id);
        deduped.push(msg);
      }
    }
    return deduped;
  }, [messages, conversationOptimisticMessages]);

  const keyExtractor = useCallback((item: Message) => {
    return `msg-${item.id}`;
  }, []);

  const scrollToReply = useCallback((message: Message, flatListRef: any) => {
    if (!message.replyTo || !message.replyTo.id) return;
    const index = combinedMessages.findIndex((msg) => msg.id === message.replyTo!.id);
    if (index !== -1) {
      flatListRef.current?.scrollToIndex({ index, animated: false });
    }
  }, [combinedMessages]);

  return {
    messages,
    conversationOptimisticMessages,
    combinedMessages,
    keyExtractor,
    scrollToReply,
  };
}
