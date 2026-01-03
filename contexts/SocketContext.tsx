import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketClient } from '@/lib/socket';
import { apiClient } from '@/services';
import { useAuth } from './AuthContext';
import { useProfile } from '@/hooks/useAuth';
import type {
  SocketMessagePayload,
  SocketMessageStatusPayload,
  SocketConversationUpdatePayload,
  SocketUserStatusPayload,
  Message,
} from '@/models';

interface SocketContextType {
  isConnected: boolean;
  socket: typeof socketClient;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { data: user } = useProfile();
  const isConnectedRef = useRef(false);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated) {
      socketClient.disconnect();
      isConnectedRef.current = false;
      return;
    }

    // Connect socket with token
    const token = apiClient.getToken();
    if (token && !socketClient.isConnected()) {
      console.log('[SocketProvider] Connecting socket');
      socketClient.connect(token);
      isConnectedRef.current = true;
    }

    // Setup global socket listeners
    const cleanupFns: (() => void)[] = [];

    // Handle new messages
    cleanupFns.push(
      socketClient.onMessageNew((payload: SocketMessagePayload) => {
        console.log('[SocketProvider] New message received:', payload.message.id);
        
        // Optimistically add message to cache
        queryClient.setQueryData<Message[]>(
          ['messages', payload.message.conversationId],
          (old = []) => {
            // Prevent duplicates
            const exists = old.some((m) => m.id === payload.message.id);
            if (exists) {
              return old;
            }
            return [...old, payload.message];
          }
        );
        
        // Update conversations list with new lastMessage and unreadCount
        queryClient.setQueryData<any[]>(
          ['conversations'],
          (old = []) => {
            return old.map((conv) => {
              if (conv.id === payload.message.conversationId) {
                return {
                  ...conv,
                  lastMessage: payload.message,
                  lastMessageAt: payload.message.createdAt,
                  // Increment unreadCount if message is from other user
                  unreadCount: payload.message.senderId !== userRef.current?.id 
                    ? (conv.unreadCount || 0) + 1 
                    : conv.unreadCount,
                };
              }
              return conv;
            });
          }
        );
      })
    );

    // Handle message status updates
    cleanupFns.push(
      socketClient.onMessageStatus((payload: SocketMessageStatusPayload) => {
        console.log('[SocketProvider] Message status update:', payload);
        
        // Update message status in cache directly
        queryClient.setQueryData<Message[]>(
          ['messages', payload.conversationId],
          (old = []) => {
            return old.map((msg) => {
              if (msg.id === payload.messageId) {
                // Ensure reads array exists
                const existingReads = msg.reads || [];
                
                // Find existing read for this user
                const existingReadIndex = existingReads.findIndex(
                  (read) => read.userId === payload.userId
                );
                
                let updatedReads;
                if (existingReadIndex !== -1) {
                  // Update existing read
                  updatedReads = existingReads.map((read, idx) => {
                    if (idx === existingReadIndex) {
                      return {
                        ...read,
                        status: payload.status,
                        readAt: payload.readAt,
                      };
                    }
                    return read;
                  });
                } else {
                  // Add new read status (shouldn't normally happen, but handle it)
                  updatedReads = [
                    ...existingReads,
                    {
                      id: 0, // Temporary ID
                      messageId: payload.messageId,
                      userId: payload.userId,
                      status: payload.status,
                      readAt: payload.readAt,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    },
                  ];
                }
                
                return {
                  ...msg,
                  reads: updatedReads,
                };
              }
              return msg;
            });
          }
        );
      })
    );

    // Handle conversation updates
    cleanupFns.push(
      socketClient.onConversationUpdated((payload: SocketConversationUpdatePayload) => {
        console.log('[SocketProvider] Conversation updated:', payload.conversation.id);
        
        // Invalidate specific conversation and list
        queryClient.invalidateQueries({
          queryKey: ['conversation', payload.conversation.id],
        });
        queryClient.invalidateQueries({
          queryKey: ['conversations'],
        });
      })
    );

    // Handle user status changes
    cleanupFns.push(
      socketClient.onUserStatus((payload: SocketUserStatusPayload) => {
        console.log('[SocketProvider] User status changed:', payload.userId, payload.status);
        
        // Invalidate conversations to update participant status
        queryClient.invalidateQueries({
          queryKey: ['conversations'],
        });
      })
    );

    // Cleanup on unmount or auth change
    return () => {
      console.log('[SocketProvider] Cleaning up socket listeners');
      cleanupFns.forEach((cleanup) => cleanup());
      socketClient.disconnect();
      isConnectedRef.current = false;
    };
  }, [isAuthenticated, queryClient]);

  const value: SocketContextType = {
    isConnected: isConnectedRef.current,
    socket: socketClient,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
}
