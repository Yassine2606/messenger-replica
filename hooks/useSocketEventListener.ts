import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketClient } from '@/lib/socket';
import { SocketMessagePayload, SocketMessageStatusPayload, SocketTypingPayload, SocketUserStatusPayload } from '@/models';
import { useUserStore } from '@/stores';

const MESSAGE_QUERY_KEYS = {
  all: ['messages'] as const,
  byConversation: (conversationId: number) => [...MESSAGE_QUERY_KEYS.all, 'conversation', conversationId] as const,
};

const CONVERSATION_QUERY_KEYS = {
  all: ['conversations'] as const,
  detail: (conversationId: number) => [...CONVERSATION_QUERY_KEYS.all, conversationId] as const,
};

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
  const { addTypingUser, removeTypingUser, addOnlineUser, removeOnlineUser } = useUserStore();

  useEffect(() => {
    // Message received - invalidate messages query for that conversation AND conversation list
    const unsubscribeMessageNew = socketClient.onMessageNew((payload: SocketMessagePayload) => {
      resetActivityTimer();
      const { conversationId } = payload;
      // Invalidate messages for the conversation with refetch
      queryClient.invalidateQueries({
        queryKey: MESSAGE_QUERY_KEYS.byConversation(conversationId),
        refetchType: 'all',
      });
      // Invalidate conversations list to update last message and timestamp
      queryClient.invalidateQueries({
        queryKey: CONVERSATION_QUERY_KEYS.all,
        refetchType: 'all',
      });
    });

    // Message status update - invalidate messages query and refetch
    const unsubscribeMessageStatus = socketClient.onMessageStatus((payload: SocketMessageStatusPayload) => {
      resetActivityTimer();
      const { conversationId } = payload;
      queryClient.invalidateQueries({
        queryKey: MESSAGE_QUERY_KEYS.byConversation(conversationId),
        refetchType: 'all',
      });
    });

    // Message deleted - invalidate messages query
    const unsubscribeMessageDeleted = socketClient.subscribe('message:deleted', (payload: any) => {
      resetActivityTimer();
      const { conversationId } = payload;
      queryClient.invalidateQueries({
        queryKey: MESSAGE_QUERY_KEYS.byConversation(conversationId),
        refetchType: 'all',
      });
    });

    // Conversation updated - invalidate conversations queries
    const unsubscribeConversationUpdated = socketClient.onConversationUpdated((payload) => {
      resetActivityTimer();
      queryClient.invalidateQueries({
        queryKey: CONVERSATION_QUERY_KEYS.all,
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        queryKey: CONVERSATION_QUERY_KEYS.detail(payload.conversation.id),
        refetchType: 'all',
      });
    });

    // User status update - track online/offline status
    const unsubscribeUserStatus = socketClient.onUserStatus((payload: SocketUserStatusPayload) => {
      if (payload.status === 'online') {
        addOnlineUser(payload.userId);
      } else {
        removeOnlineUser(payload.userId);
      }
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

    // Socket activity timeout detection - refetch all data if no activity for 60 seconds
    const activityTimeoutInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityTime;
      const INACTIVITY_THRESHOLD = 60000; // 60 seconds

      if (timeSinceLastActivity > INACTIVITY_THRESHOLD) {
        // Force refresh all message and conversation queries
        queryClient.invalidateQueries({
          queryKey: MESSAGE_QUERY_KEYS.all,
          refetchType: 'all',
        });
        queryClient.invalidateQueries({
          queryKey: CONVERSATION_QUERY_KEYS.all,
          refetchType: 'all',
        });
        // Reset timer after refresh
        lastActivityTime = Date.now();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      clearInterval(activityTimeoutInterval);
      unsubscribeMessageNew();
      unsubscribeMessageStatus();
      unsubscribeMessageDeleted();
      unsubscribeConversationUpdated();
      unsubscribeUserStatus();
      unsubscribeTypingStart();
      unsubscribeTypingStop();
    };
  }, [queryClient, addTypingUser, removeTypingUser, addOnlineUser, removeOnlineUser]);
}
