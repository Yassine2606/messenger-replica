import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketClient } from '@/lib/socket';
import { messageQueryKeys, conversationQueryKeys } from '@/lib/query-keys';
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
 * This hook implements the core pattern from the blueprint:
 * - Listen to Socket.io events
 * - Update React Query cache directly with setQueryData (not invalidation)
 * - Preserve scroll position and pagination state
 * - Use Zustand for ephemeral state only (typing, presence, connection)
 * 
 * Mount this hook in app/_layout.tsx for global event listening
 */
export function useSocketEventListener() {
  const queryClient = useQueryClient();
  const { addTypingUser, removeTypingUser, setUserStatus } = useUserStore();
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    // ============================================================
    // MESSAGE EVENTS
    // ============================================================

    /**
     * message:new - New message received
     * 
     * Instead of invalidating the entire query (which causes refetch),
     * we use setQueryData to manually add the message to the infinite scroll cache.
     * This preserves scroll position and pagination state.
     */
    const unsubscribeMessageNew = socketClient.onMessageUnified(
      (payload: UnifiedMessageEvent) => {
        const { conversationId, message, conversationUpdates } = payload;

        // Update the infinite messages query for this conversation
        queryClient.setQueryData(
          messageQueryKeys.byConversation(conversationId),
          (oldData: any) => {
            if (!oldData?.pages) return oldData;

            // Inverted FlatList: new messages appear at index 0 (bottom of screen)
            return {
              ...oldData,
              pages: [
                {
                  ...oldData.pages[0],
                  data: [message, ...oldData.pages[0].data],
                },
                ...oldData.pages.slice(1),
              ],
            };
          }
        );

        // Manually update conversations cache with new last message and unread counts
        // This is instant and doesn't require a refetch
        queryClient.setQueryData(
          conversationQueryKeys.infinite(),
          (oldData: any) => {
            if (!oldData?.pages) return oldData;

            // Find current user's unread count for this conversation
            const currentUserUnreadCount = conversationUpdates?.find(
              (update) => update.userId === currentUser?.id
            )?.unreadCount ?? 0;

            // Update the specific conversation in the cache
            const updatedPages = oldData.pages.map((page: any) => ({
              ...page,
              data: page.data.map((conv: any) => {
                if (conv.id === conversationId) {
                  return {
                    ...conv,
                    lastMessage: message,
                    unreadCount: currentUserUnreadCount,
                  };
                }
                return conv;
              }),
            }));

            return { ...oldData, pages: updatedPages };
          }
        );
      }
    );

    /**
     * message:status - Status updates (read/delivered)
     * 
     * Update message cache with new read/delivered status without full refetch.
     * Also update conversation cache with new unread counts and updated lastMessage.
     */
    const unsubscribeMessageStatus = socketClient.onStatusUnified(
      (payload: UnifiedStatusUpdateEvent) => {
        const { conversationId, updates, conversationUpdates } = payload;

        // Update message statuses in the cache
        queryClient.setQueryData(
          messageQueryKeys.byConversation(conversationId),
          (oldData: any) => {
            if (!oldData?.pages) return oldData;

            // Update read status for each message
            const updatedPages = oldData.pages.map((page: any) => ({
              ...page,
              data: page.data.map((msg: Message) => {
                const statusUpdate = updates.find((u) => u.messageId === msg.id);
                if (!statusUpdate) return msg;

                // Update the reads array with new status
                return {
                  ...msg,
                  reads: (msg.reads || []).map((read) =>
                    read.userId === statusUpdate.userId
                      ? { ...read, status: statusUpdate.status, createdAt: statusUpdate.readAt }
                      : read
                  ),
                };
              }),
            }));

            return { ...oldData, pages: updatedPages };
          }
        );

        // Update conversation with new unread counts and update lastMessage reads
        queryClient.setQueryData(
          conversationQueryKeys.infinite(),
          (oldData: any) => {
            if (!oldData?.pages) return oldData;

            // Find current user's unread count
            const currentUserUnreadCount = conversationUpdates?.find(
              (update) => update.userId === currentUser?.id
            )?.unreadCount ?? 0;

            // Update the specific conversation in the cache
            const updatedPages = oldData.pages.map((page: any) => ({
              ...page,
              data: page.data.map((conv: any) => {
                if (conv.id === conversationId) {
                  // Also update lastMessage's reads array to reflect new status
                  return {
                    ...conv,
                    unreadCount: currentUserUnreadCount,
                    lastMessage: conv.lastMessage
                      ? {
                          ...conv.lastMessage,
                          reads: (conv.lastMessage.reads || []).map((read: any) => {
                            const statusUpdate = updates.find((u) => u.messageId === conv.lastMessage.id && u.userId === read.userId);
                            return statusUpdate
                              ? { ...read, status: statusUpdate.status, createdAt: statusUpdate.readAt }
                              : read;
                          }),
                        }
                      : conv.lastMessage,
                  };
                }
                return conv;
              }),
            }));

            return { ...oldData, pages: updatedPages };
          }
        );
      }
    );

    /**
     * message:delete - Message was deleted
     * 
     * Remove or mark message as deleted in cache without refetch.
     */
    const unsubscribeMessageDeleted = socketClient.onMessageDeleted(
      (payload: UnifiedMessageDeletionEvent) => {
        const { conversationId, deletedMessageIds } = payload;

        queryClient.setQueryData(
          messageQueryKeys.byConversation(conversationId),
          (oldData: any) => {
            if (!oldData?.pages) return oldData;

            // Option 1: Mark as deleted (preserves message count)
            // Option 2: Remove from array (cleaner UI but lose pagination alignment)
            // Using Option 1 to preserve pagination state
            const updatedPages = oldData.pages.map((page: any) => ({
              ...page,
              data: page.data.map((msg: Message) =>
                deletedMessageIds.includes(msg.id) ? { ...msg, isDeleted: true } : msg
              ),
            }));

            return { ...oldData, pages: updatedPages };
          }
        );

        // Update conversations (potential new last message after deletion)
        queryClient.setQueryData(
          conversationQueryKeys.infinite(),
          (oldData: any) => {
            if (!oldData?.pages) return oldData;

            // If lastMessage was deleted, mark it as deleted instead of refetching
            const updatedPages = oldData.pages.map((page: any) => ({
              ...page,
              data: page.data.map((conv: any) => {
                if (conv.id === conversationId && conv.lastMessage && deletedMessageIds.includes(conv.lastMessage.id)) {
                  return {
                    ...conv,
                    lastMessage: { ...conv.lastMessage, isDeleted: true },
                  };
                }
                return conv;
              }),
            }));

            return { ...oldData, pages: updatedPages };
          }
        );
      }
    );

    // ============================================================
    // TYPING EVENTS (Ephemeral State - Use Zustand)
    // ============================================================

    const unsubscribeTypingStart = socketClient.onTypingStart((data: SocketTypingPayload) => {
      const { conversationId, userId } = data;
      addTypingUser(conversationId, userId);
    });

    const unsubscribeTypingStop = socketClient.onTypingStop((data: SocketTypingPayload) => {
      const { conversationId, userId } = data;
      removeTypingUser(conversationId, userId);
    });

    // ============================================================
    // PRESENCE EVENTS (Ephemeral State - Use Zustand)
    // ============================================================

    const unsubscribePresenceJoined = socketClient.onPresenceJoined((data: any) => {
      // User joined a conversation (only informational for now)
      // Could be used to show "User is typing" or "User is viewing" badges
    });

    const unsubscribePresenceLeft = socketClient.onPresenceLeft((data: any) => {
      // User left a conversation
    });

    // ============================================================
    // USER STATUS EVENTS (Ephemeral State - Use Zustand)
    // ============================================================

    const unsubscribeUserStatus = socketClient.onUserStatus((data: SocketUserStatusPayload) => {
      const { userId, status, lastSeen } = data;
      setUserStatus(userId, status, lastSeen || new Date().toISOString());
    });

    // Cleanup: Unsubscribe from all events
    return () => {
      unsubscribeMessageNew();
      unsubscribeMessageStatus();
      unsubscribeMessageDeleted();
      unsubscribeTypingStart();
      unsubscribeTypingStop();
      unsubscribePresenceJoined();
      unsubscribePresenceLeft();
      unsubscribeUserStatus();
    };
  }, [queryClient, addTypingUser, removeTypingUser, setUserStatus]);
}
