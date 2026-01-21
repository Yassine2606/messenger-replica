import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { socketClient } from '@/lib/socket';
import { useAuthStore } from '@/stores';

interface SocketContextType {
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const token = useAuthStore((state) => state.token);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = React.useState(false);

  // Handle token change - connect or disconnect
  useEffect(() => {
    // Wait for auth to be hydrated
    if (isHydrating) {
      return;
    }

    if (!token) {
      // Token cleared - disconnect socket immediately
      socketClient.disconnect();
      setIsConnected(false);
      return;
    }

    // Token exists - connect socket
    socketClient.connect(token);

    // Listen for connection state changes
    const unsubscribeConnect = socketClient.subscribe('connected', () => {
      setIsConnected(true);
      // Invalidate all queries on reconnect to ensure fresh data
      queryClient.invalidateQueries();
    });

    const unsubscribeDisconnect = socketClient.subscribe('disconnected', () => {
      setIsConnected(false);
    });

    // Check if already connected
    if (socketClient.isConnected()) {
      setIsConnected(true);
    }

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
    };
  }, [token, isHydrating]);

  // Presence ping interval - keeps online status fresh globally
  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const presencePingInterval = setInterval(() => {
      socketClient.sendPresencePing();
    }, 15000); // Send presence ping every 15 seconds - aggressive to keep online status fresh

    return () => {
      clearInterval(presencePingInterval);
    };
  }, [isConnected]);

  // Reconnect socket when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [token, isHydrating]);

  const handleAppStateChange = (state: AppStateStatus) => {
    if (state === 'active') {
      // App came to foreground - ensure socket is connected
      if (!socketClient.isConnected() && token && !isHydrating) {
        socketClient.connect(token);
      }
    }
  };

  const contextValue = React.useMemo(() => ({ isConnected }), [isConnected]);

  return <SocketContext.Provider value={contextValue}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
}

// Note: useSocket hook is exported for context access but primary socket management
// is handled by useSocketEventListener hook which should be called at the root level
// for global socket event handling and query invalidation
