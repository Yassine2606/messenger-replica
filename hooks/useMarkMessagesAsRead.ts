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

    // Find all unread messages from other users
    const unreadMessageIds = messages
      .filter((msg) => {
        // Skip if already marked
        if (markedRef.current.has(msg.id)) return false;
        // Skip own messages
        if (msg.senderId === userId) return false;
        // Skip if not sent status
        if (!msg.reads) return true;
        
        // Check if unread by current user
        const currentUserRead = msg.reads.find((r) => r.userId === userId);
        return !currentUserRead || currentUserRead.status !== 'read';
      })
      .map((msg) => msg.id);

    if (unreadMessageIds.length === 0) return;

    // Mark as read locally first (optimistic)
    unreadMessageIds.forEach((id) => markedRef.current.add(id));

    // Send to backend
    socketClient.markMessagesAsRead(conversationId, unreadMessageIds);
  }, [conversationId, messages, userId]);
}
