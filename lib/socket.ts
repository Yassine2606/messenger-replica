import { io, Socket } from 'socket.io-client';
import type {
  SocketMessagePayload,
  SocketMessageStatusPayload,
  SocketConversationUpdatePayload,
  SocketUserStatusPayload,
  SocketTypingPayload,
  SocketErrorPayload,
} from '@/models';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';

/**
 * Manages socket connection lifecycle only
 * Responsibility: connect, disconnect, connection state
 */
class SocketConnection {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string, onSetup: (socket: Socket) => void): void {
    if (this.socket?.connected) {
      return;
    }

    if (this.socket && !this.socket.connected) {
      this.socket.auth = { token };
      this.socket.connect();
      return;
    }

    this.token = token;
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    onSetup(this.socket);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.token = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

/**
 * Manages socket event subscriptions
 * Responsibility: subscribe/unsubscribe, emit events
 */
class SocketEventManager {
  private eventListeners: Map<string, Set<Function>> = new Map();

  subscribe<T = any>(event: string, handler: (data: T) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }

    this.eventListeners.get(event)!.add(handler as Function);

    return () => {
      const handlers = this.eventListeners.get(event);
      if (handlers) {
        handlers.delete(handler as Function);
      }
    };
  }

  emit(event: string, data?: any): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  clear(): void {
    this.eventListeners.clear();
  }
}

/**
 * Main socket client combining connection and event management
 */
class SocketClient {
  private connection: SocketConnection;
  private eventManager: SocketEventManager;
  private pendingActions: Array<() => void> = [];

  constructor() {
    this.connection = new SocketConnection();
    this.eventManager = new SocketEventManager();
  }

  connect(token: string): void {
    this.connection.connect(token, (socket) => {
      this.setupEventHandlers(socket);
      // Flush pending actions after socket is set up
      this.flushPendingActions();
    });
  }

  disconnect(): void {
    this.connection.disconnect();
    this.eventManager.clear();
    this.pendingActions = [];
  }

  isConnected(): boolean {
    return this.connection.isConnected();
  }

  /**
   * Queue action if socket not ready, otherwise execute immediately
   */
  private queueOrExecute(action: () => void): void {
    if (this.isConnected()) {
      action();
    } else {
      this.pendingActions.push(action);
    }
  }

  /**
   * Flush all pending actions once socket is ready
   */
  private flushPendingActions(): void {
    while (this.pendingActions.length > 0) {
      const action = this.pendingActions.shift();
      if (action) {
        action();
      }
    }
  }

  /**
   * Setup socket event listeners (internal)
   */
  private setupEventHandlers(socket: Socket): void {
    socket.on('connect', () => {
      console.log('[Socket] Connected');
      this.eventManager.emit('connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      this.eventManager.emit('disconnected', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      this.eventManager.emit('error', error);
    });

    socket.on('error', (payload: SocketErrorPayload) => {
      console.error('[Socket] Server error:', payload);
      this.eventManager.emit('server_error', payload);
    });

    // Heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      }
    }, 25000); // Every 25 seconds

    socket.once('disconnect', () => {
      clearInterval(heartbeatInterval);
    });

    socket.on('message:new', (payload: SocketMessagePayload) => {
      this.eventManager.emit('message:new', payload);
    });

    socket.on('message:status', (payload: SocketMessageStatusPayload) => {
      this.eventManager.emit('message:status', payload);
    });

    socket.on('message:deleted', (payload: { messageId: number; conversationId: number; deletedAt: string }) => {
      this.eventManager.emit('message:deleted', payload);
    });

    socket.on('conversation:updated', (payload: SocketConversationUpdatePayload) => {
      this.eventManager.emit('conversation:updated', payload);
    });

    socket.on('user:status', (payload: SocketUserStatusPayload) => {
      this.eventManager.emit('user:status', payload);
    });

    socket.on('typing:start', (payload: SocketTypingPayload) => {
      this.eventManager.emit('typing:start', payload);
    });

    socket.on('typing:stop', (payload: SocketTypingPayload) => {
      this.eventManager.emit('typing:stop', payload);
    });
  }

  // Socket action methods
  joinConversation(conversationId: number): void {
    this.queueOrExecute(() => {
      this.connection.getSocket()?.emit('conversation:join', { conversationId });
    });
  }

  leaveConversation(conversationId: number): void {
    this.queueOrExecute(() => {
      this.connection.getSocket()?.emit('conversation:leave', { conversationId });
    });
  }

  startTyping(conversationId: number): void {
    this.queueOrExecute(() => {
      this.connection.getSocket()?.emit('typing:start', { conversationId });
    });
  }

  stopTyping(conversationId: number): void {
    this.queueOrExecute(() => {
      this.connection.getSocket()?.emit('typing:stop', { conversationId });
    });
  }

  // Event subscription methods
  subscribe<T = any>(event: string, handler: (data: T) => void): () => void {
    return this.eventManager.subscribe(event, handler);
  }

  onMessageNew(handler: (payload: SocketMessagePayload) => void): () => void {
    return this.subscribe('message:new', handler);
  }

  onMessageStatus(handler: (payload: SocketMessageStatusPayload) => void): () => void {
    return this.subscribe('message:status', handler);
  }

  onMessageDeleted(handler: (payload: { messageId: number; conversationId: number; deletedAt: string }) => void): () => void {
    return this.subscribe('message:deleted', handler);
  }

  onConversationUpdated(handler: (payload: SocketConversationUpdatePayload) => void): () => void {
    return this.subscribe('conversation:updated', handler);
  }

  onUserStatus(handler: (payload: SocketUserStatusPayload) => void): () => void {
    return this.subscribe('user:status', handler);
  }

  onTypingStart(handler: (payload: SocketTypingPayload) => void): () => void {
    return this.subscribe('typing:start', handler);
  }

  onTypingStop(handler: (payload: SocketTypingPayload) => void): () => void {
    return this.subscribe('typing:stop', handler);
  }
}

export const socketClient = new SocketClient();
export const socketManager = socketClient;
