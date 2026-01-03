import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketClient } from '@/lib/socket';
import type {
  SocketMessagePayload,
  SocketMessageStatusPayload,
  SocketConversationUpdatePayload,
  SocketUserStatusPayload,
  SocketTypingPayload,
} from '@/models';

/**
 * Hook for socket connection management
 */
export function useSocket() {
  const isConnected = socketClient.isConnected();

  const connect = useCallback((token: string) => {
    socketClient.connect(token);
  }, []);

  const disconnect = useCallback(() => {
    socketClient.disconnect();
  }, []);

  return {
    isConnected,
    connect,
    disconnect,
  };
}

/**
 * Hook for conversation room management
 */
export function useConversationRoom(conversationId: number | null) {
  const previousConversationId = useRef<number | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    // Leave previous conversation if different
    if (previousConversationId.current && previousConversationId.current !== conversationId) {
      socketClient.leaveConversation(previousConversationId.current);
    }

    // Join new conversation
    socketClient.joinConversation(conversationId);
    previousConversationId.current = conversationId;

    // Cleanup: leave conversation on unmount
    return () => {
      if (conversationId) {
        socketClient.leaveConversation(conversationId);
      }
      previousConversationId.current = null;
    };
  }, [conversationId]);
}

/**
 * Hook for real-time message updates in a specific conversation
 */
export function useSocketMessages(conversationId: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    // Listen for new messages in this conversation
    const unsubMessageNew = socketClient.onMessageNew((payload: SocketMessagePayload) => {
      if (payload.message.conversationId === conversationId) {
        console.log('[useSocketMessages] New message in conversation', conversationId);
        // Invalidate to refetch messages
        queryClient.invalidateQueries({
          queryKey: ['messages', conversationId],
        });
      }
    });

    // Listen for message status updates in this conversation
    const unsubMessageStatus = socketClient.onMessageStatus((payload: SocketMessageStatusPayload) => {
      if (payload.conversationId === conversationId) {
        console.log('[useSocketMessages] Message status update in conversation', conversationId);
        // Invalidate to refetch messages with updated status
        queryClient.invalidateQueries({
          queryKey: ['messages', conversationId],
        });
      }
    });

    // Cleanup listeners
    return () => {
      unsubMessageNew();
      unsubMessageStatus();
    };
  }, [conversationId, queryClient]);
}

/**
 * Hook for typing indicators with optimized debouncing
 */
export function useTypingIndicator(conversationId: number | null) {
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isTypingRef = useRef(false);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const startTyping = useCallback(() => {
    if (!conversationId) return;

    // Throttle typing events - only emit once per 2 seconds
    if (isTypingRef.current && throttleRef.current) {
      return;
    }

    // Emit typing start
    socketClient.startTyping(conversationId);
    isTypingRef.current = true;

    // Throttle subsequent typing events
    if (throttleRef.current) {
      clearTimeout(throttleRef.current);
    }
    throttleRef.current = setTimeout(() => {
      throttleRef.current = undefined;
    }, 2000);

    // Auto-stop typing after 3 seconds of no activity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (conversationId) {
        socketClient.stopTyping(conversationId);
        isTypingRef.current = false;
      }
    }, 3000);
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    if (!conversationId || !isTypingRef.current) return;

    // Clear all timers
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = undefined;
    }
    if (throttleRef.current) {
      clearTimeout(throttleRef.current);
      throttleRef.current = undefined;
    }

    socketClient.stopTyping(conversationId);
    isTypingRef.current = false;
  }, [conversationId]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
      // Send stop typing on unmount if was typing
      if (conversationId && isTypingRef.current) {
        socketClient.stopTyping(conversationId);
      }
    };
  }, [conversationId]);

  return { startTyping, stopTyping };
}

/**
 * Hook to listen for typing indicators in a conversation
 */
export function useListenTyping(conversationId: number | null, otherUserId: number | null) {
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!conversationId || !otherUserId) return;

    const unsubStart = socketClient.onTypingStart((payload: SocketTypingPayload) => {
      if (payload.conversationId === conversationId && payload.userId === otherUserId) {
        setIsTyping(true);

        // Auto-hide after 3 seconds
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 3000);
      }
    });

    const unsubStop = socketClient.onTypingStop((payload: SocketTypingPayload) => {
      if (payload.conversationId === conversationId && payload.userId === otherUserId) {
        setIsTyping(false);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }
    });

    return () => {
      unsubStart();
      unsubStop();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, otherUserId]);

  return isTyping;
}

/**
 * Hook for user online/offline status
 */
export function useUserStatus(onStatusChange?: (payload: SocketUserStatusPayload) => void) {
  useEffect(() => {
    if (!onStatusChange) return;

    const unsubscribe = socketClient.onUserStatus(onStatusChange);

    return unsubscribe;
  }, [onStatusChange]);
}
