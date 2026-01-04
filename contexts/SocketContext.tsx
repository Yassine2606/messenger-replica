import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketClient } from '@/lib/socket';
import { apiClient } from '@/services';

interface SocketContextType {
  isConnected: boolean;
  socket: typeof socketClient;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = apiClient.getToken();
    if (!token) {
      socketClient.disconnect();
      setIsConnected(false);
      return;
    }

    if (!socketClient.isConnected()) {
      socketClient.connect(token);
    }

    // Listen to connection state changes
    const unsubConnect = socketClient.subscribe('connected', () => {
      setIsConnected(true);
    });

    const unsubDisconnect = socketClient.subscribe('disconnected', () => {
      setIsConnected(false);
    });

    // Event-based invalidation for real-time updates
    // Only invalidate queries that have active observers
    const unsubMessageNew = socketClient.subscribe('message:new', (payload: any) => {
      // Invalidate the specific conversation's messages to refetch with new message
      queryClient.invalidateQueries({
        queryKey: ['messages', payload.message.conversationId],
      });
      // Also invalidate conversations list for last message update
      queryClient.invalidateQueries({
        queryKey: ['conversations'],
      });
    });

    const unsubMessageStatus = socketClient.subscribe('message:status', (payload: any) => {
      queryClient.invalidateQueries({
        queryKey: ['messages', payload.conversationId],
      });
    });

    const unsubConversationUpdated = socketClient.subscribe('conversation:updated', (payload: any) => {
      queryClient.invalidateQueries({
        queryKey: ['conversations'],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversations', payload.conversation.id],
      });
    });

    const unsubUserStatus = socketClient.subscribe('user:status', () => {
      queryClient.invalidateQueries({
        queryKey: ['conversations'],
      });
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubMessageNew();
      unsubMessageStatus();
      unsubConversationUpdated();
      unsubUserStatus();
    };
  }, []);

  const value: SocketContextType = {
    isConnected,
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
