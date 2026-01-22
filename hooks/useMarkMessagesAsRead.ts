import { useEffect, useRef } from 'react';
import { socketClient } from '@/lib/socket';
import { Message } from '@/models';

/**
 * Hook to mark messages as read when conversation is viewed
 * Sends read status to backend via socket and updates query cache
 */
export function useMarkMessagesAsRead(conversationId: number, messages: Message[], userId?: number) {
  const markedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!conversationId || !messages || !userId) return;

    // Limit scan to recent messages to avoid O(n) scans on very large lists
    const MAX_SCAN = 200;
    const unreadMessageIds: number[] = [];

    // Messages are returned newest-first (DESC). Scan the most recent messages and stop early
    // if we encounter a message that the user has already read to minimize work.
    for (let i = 0, scanned = 0; i < messages.length && scanned < MAX_SCAN; i++, scanned++) {
      const msg = messages[i];

      // Skip already-marked or own messages
      if (markedRef.current.has(msg.id)) continue;
      if (msg.senderId === userId) continue;

      const currentUserRead = msg.reads?.find((r) => r.userId === userId);
      if (currentUserRead && currentUserRead.status === 'read') {
        // Assume older messages are read as well; stop scanning
        break;
      }

      unreadMessageIds.push(msg.id);
    }

    if (unreadMessageIds.length === 0) return;

    // Mark as read locally first (optimistic)
    unreadMessageIds.forEach((id) => markedRef.current.add(id));

    // Send to backend
    socketClient.markMessagesAsRead(conversationId, unreadMessageIds);
  // Depend on cheap signals rather than the full array to avoid unnecessary triggers
  }, [conversationId, messages?.length, messages?.[0]?.id, userId]);
}
