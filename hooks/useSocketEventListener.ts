import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketClient } from '@/lib/socket';
import { messageQueryKeys, conversationQueryKeys } from '@/lib/query-keys';
import { UnifiedMessageEvent, UnifiedStatusUpdateEvent, UnifiedMessageDeletionEvent, SocketTypingPayload, SocketUserStatusPayload } from '@/models';
import { useUserStore } from '@/stores';

// Global reference for socket activity tracking (shared across all hook instances)
let lastActivityTime = Date.now();

const resetActivityTimer = () => {
  lastActivityTime = Date.now();
};

/**
 * Hook to listen to socket events and invalidate/update queries accordingly
 * This hook should be used at the top level (layout or root screen)
 */
export function useSocketEventListener() {
  const queryClient = useQueryClient();
  const { addTypingUser, removeTypingUser, setUserPresence } = useUserStore();

  useEffect(() => {
    // Unified message event - invalidate queries and update UI atomically
    const unsubscribeMessageUnified = socketClient.onMessageUnified((payload: UnifiedMessageEvent) => {
      resetActivityTimer();
      const { conversationId } = payload;
      
      // Invalidate messages for the conversation
      queryClient.invalidateQueries({
        queryKey: messageQueryKeys.byConversation(conversationId),
        refetchType: 'all',
      });
      
      // Invalidate conversations list to update last message, timestamp, and unread counts
      queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.list(),
        refetchType: 'all',
      });

      // Force refetch conversations immediately (critical for real-time updates)
      queryClient.refetchQueries({
        queryKey: conversationQueryKeys.list(),
      }).catch((error) => {
        console.error('[Socket] Failed to refetch conversations on message:', error);
      });
    });

    // Unified status update event - handles read/delivered status changes with unread counts
    const unsubscribeStatusUnified = socketClient.onStatusUnified((payload: UnifiedStatusUpdateEvent) => {
      resetActivityTimer();
      const { conversationId } = payload;
      
      // Invalidate messages to reflect read/delivered status
      queryClient.invalidateQueries({
        queryKey: messageQueryKeys.byConversation(conversationId),
        refetchType: 'all',
      });
      
      // Invalidate conversations to update unread counts
      queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.list(),
        refetchType: 'all',
      });

      // Force refetch conversations immediately for real-time unread count updates
      queryClient.refetchQueries({
        queryKey: conversationQueryKeys.list(),
      }).catch((error) => {
        console.error('[Socket] Failed to refetch conversations on status update:', error);
      });
    });

    // Unified message deletion event - handles message deletions
    const unsubscribeMessageDeleted = socketClient.onMessageDeleted((payload: UnifiedMessageDeletionEvent) => {
      resetActivityTimer();
      const { conversationId } = payload;
      
      // Invalidate messages to reflect deletion
      queryClient.invalidateQueries({
        queryKey: messageQueryKeys.byConversation(conversationId),
        refetchType: 'all',
      });
      
      // Invalidate conversations to update unread counts if deleted message was unread
      queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.list(),
        refetchType: 'all',
      });

      // Force refetch conversations immediately for real-time updates
      queryClient.refetchQueries({
        queryKey: conversationQueryKeys.list(),
      }).catch((error) => {
        console.error('[Socket] Failed to refetch conversations on message deletion:', error);
      });
    });

    // Presence events - track user joining/leaving conversation
    const unsubscribePresenceJoined = socketClient.onPresenceJoined(() => {
      resetActivityTimer();
      // Presence changes don't require query invalidation (UI state only)
    });

    const unsubscribePresenceLeft = socketClient.onPresenceLeft(() => {
      resetActivityTimer();
      // Presence changes don't require query invalidation (UI state only)
    });

    // User status update - track online/offline status with lastSeen timestamp
    const unsubscribeUserStatus = socketClient.onUserStatus((payload: SocketUserStatusPayload) => {
      // Update user presence with lastSeen timestamp
      setUserPresence(payload.userId, payload.lastSeen || new Date().toISOString());
      
      // Invalidate conversations to refresh participant lastSeen display
      queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.list(),
        refetchType: 'all',
      });

      // Force refetch conversations immediately for real-time lastSeen updates
      queryClient.refetchQueries({
        queryKey: conversationQueryKeys.list(),
      }).catch((error) => {
        console.error('[Socket] Failed to refetch conversations on user status:', error);
      });
    });

    // Typing start - track user typing
    const unsubscribeTypingStart = socketClient.onTypingStart((payload: SocketTypingPayload) => {
      resetActivityTimer();
      addTypingUser(payload.userId);
    });

    // Typing stop - untrack user typing
    const unsubscribeTypingStop = socketClient.onTypingStop((payload: SocketTypingPayload) => {
      resetActivityTimer();
      removeTypingUser(payload.userId);
    });

    // Socket activity timeout detection - refetch all data if no activity for 30 seconds
    const activityTimeoutInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityTime;
      const INACTIVITY_THRESHOLD = 30000; // 30 seconds (reduced from 60s for better responsiveness)

      if (timeSinceLastActivity > INACTIVITY_THRESHOLD) {
        // Force refresh all message and conversation queries
        queryClient.invalidateQueries({
          queryKey: messageQueryKeys.all,
          refetchType: 'all',
        });
        queryClient.invalidateQueries({
          queryKey: conversationQueryKeys.list(),
          refetchType: 'all',
        });
        // Reset timer after refresh
        lastActivityTime = Date.now();
      }
    }, 15000); // Check every 15 seconds (reduced from 30s for better responsiveness)

    return () => {
      clearInterval(activityTimeoutInterval);
      unsubscribeMessageUnified();
      unsubscribeStatusUnified();
      unsubscribeMessageDeleted();
      unsubscribePresenceJoined();
      unsubscribePresenceLeft();
      unsubscribeUserStatus();
      unsubscribeTypingStart();
      unsubscribeTypingStop();
    };
  }, [queryClient, addTypingUser, removeTypingUser, setUserPresence]);
}
