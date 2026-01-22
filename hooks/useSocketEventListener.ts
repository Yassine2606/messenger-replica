import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketClient } from '@/lib/socket';
import { messageQueryKeys, conversationQueryKeys } from '@/lib/query-keys';
import { prependMessageToPages } from '@/lib/message-cache';
import {
  UnifiedMessageEvent,
  UnifiedStatusUpdateEvent,
  UnifiedMessageDeletionEvent,
  SocketTypingPayload,
  SocketUserStatusPayload,
  Message
} from '@/models';
import { useUserStore, useAuthStore } from '@/stores';

/**
 * Socket-to-Query Bridge Hook
 * 
 * Listens to Socket.io events and updates React Query cache directly.
 * Preserves scroll position and pagination state.
 * Uses Zustand for ephemeral state only (typing, presence, connection).
 */
export function useSocketEventListener() {
  const queryClient = useQueryClient();
  const { addTypingUser, removeTypingUser, setUserStatus } = useUserStore();
  const { user: currentUser } = useAuthStore();
  const currentUserId = useMemo(() => currentUser?.id, [currentUser?.id]);

  useEffect(() => {
    // Helper: Get current user's unread count from updates
    const getCurrentUserUnreadCount = (updates: any[]) =>
      updates?.find(u => u.userId === currentUserId)?.unreadCount ?? 0;

    // ====== MESSAGE EVENTS ======

    const unsubMessage = socketClient.onMessageUnified((payload: UnifiedMessageEvent) => {
      const { conversationId, message, conversationUpdates } = payload;

      // Update messages cache (prepend to newest page). Deduplicate to avoid double inserts.
      queryClient.setQueryData(
        messageQueryKeys.byConversation(conversationId),
        (old: any) => {
          if (!old?.pages) return old;

          // Use helper to prepend and dedupe
          return prependMessageToPages(old, message as any);
        }
      );

      // Update conversations cache
      queryClient.setQueryData(conversationQueryKeys.infinite(), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((c: any) =>
              c.id === conversationId
                ? { ...c, lastMessage: message, unreadCount: getCurrentUserUnreadCount(conversationUpdates) }
                : c
            ),
          })),
        };
      });
    });

    const unsubStatus = socketClient.onStatusUnified((payload: UnifiedStatusUpdateEvent) => {
      const { conversationId, updates, conversationUpdates } = payload;

      // Update message reads
      queryClient.setQueryData(messageQueryKeys.byConversation(conversationId), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((msg: Message) => {
              const update = updates.find(u => u.messageId === msg.id);
              return !update ? msg : {
                ...msg,
                reads: (msg.reads || []).map(r =>
                  r.userId === update.userId
                    ? { ...r, status: update.status, createdAt: update.readAt }
                    : r
                ),
              };
            }),
          })),
        };
      });

      // Update conversation with new unread counts
      queryClient.setQueryData(conversationQueryKeys.infinite(), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((c: any) => {
              if (c.id !== conversationId) return c;
              const lastMsg = c.lastMessage;
              return {
                ...c,
                unreadCount: getCurrentUserUnreadCount(conversationUpdates),
                lastMessage: !lastMsg ? lastMsg : {
                  ...lastMsg,
                  reads: (lastMsg.reads || []).map((r: any) => {
                    const u = updates.find(st => st.messageId === lastMsg.id && st.userId === r.userId);
                    return u ? { ...r, status: u.status, createdAt: u.readAt } : r;
                  }),
                },
              };
            }),
          })),
        };
      });
    });

    const unsubDelete = socketClient.onMessageDeleted((payload: UnifiedMessageDeletionEvent) => {
      const { conversationId, deletedMessageIds } = payload;

      // Mark deleted in messages cache
      queryClient.setQueryData(messageQueryKeys.byConversation(conversationId), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((m: Message) =>
              deletedMessageIds.includes(m.id) ? { ...m, isDeleted: true } : m
            ),
          })),
        };
      });

      // Mark deleted in conversations lastMessage
      queryClient.setQueryData(conversationQueryKeys.infinite(), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((c: any) =>
              c.id === conversationId && c.lastMessage && deletedMessageIds.includes(c.lastMessage.id)
                ? { ...c, lastMessage: { ...c.lastMessage, isDeleted: true } }
                : c
            ),
          })),
        };
      });
    });

    // ====== EPHEMERAL EVENTS (Zustand) ======

    const unsubTypingStart = socketClient.onTypingStart(({ conversationId, userId }: SocketTypingPayload) =>
      addTypingUser(conversationId, userId)
    );

    const unsubTypingStop = socketClient.onTypingStop(({ conversationId, userId }: SocketTypingPayload) =>
      removeTypingUser(conversationId, userId)
    );

    const unsubStatus2 = socketClient.onUserStatus(({ userId, status, lastSeen }: SocketUserStatusPayload) =>
      setUserStatus(userId, status, lastSeen || new Date().toISOString())
    );

    // Cleanup
    return () => {
      unsubMessage();
      unsubStatus();
      unsubDelete();
      unsubTypingStart();
      unsubTypingStop();
      unsubStatus2();
    };
  }, [queryClient, addTypingUser, removeTypingUser, setUserStatus, currentUserId]);
}
