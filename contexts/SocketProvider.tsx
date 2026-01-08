import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { socketClient } from '@/lib/socket';
import { useAuthStore } from '@/stores';
import { useAuth } from './AuthProvider';

interface SocketContextType {
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const token = useAuthStore((state) => state.token);
  const { isHydrated } = useAuth();
  const [isConnected, setIsConnected] = React.useState(false);

  // Handle token change - connect or disconnect
  useEffect(() => {
    // Wait for auth to be hydrated
    if (!isHydrated) {
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
  }, [token, isHydrated]);

  return (
    <SocketContext.Provider value={{ isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
}
