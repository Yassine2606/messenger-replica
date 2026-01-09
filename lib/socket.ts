import { io, Socket } from 'socket.io-client';
import type {
  UnifiedMessageEvent,
  UnifiedStatusUpdateEvent,
  UnifiedMessageDeletionEvent,
  SocketPresencePayload,
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

    // Call onSetup immediately so setupEventHandlers can register listeners
    // before the socket connects
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
  private pendingActions: Map<string, () => void> = new Map();
  private actionCounter = 0;

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
    this.pendingActions.clear();
  }

  isConnected(): boolean {
    return this.connection.isConnected();
  }

  /**
   * Queue action if socket not ready, otherwise execute immediately
   * Returns action key for potential cancellation
   */
  private queueOrExecute(action: () => void, deduplicationKey?: string): string {
    if (this.isConnected()) {
      action();
      return '';
    } else {
      // Use provided key or generate unique key to prevent duplicates
      const actionKey = deduplicationKey || `action-${this.actionCounter++}`;
      this.pendingActions.set(actionKey, action);
      return actionKey;
    }
  }

  /**
   * Cancel a pending action by its key
   */
  private cancelPendingAction(key: string): void {
    this.pendingActions.delete(key);
  }

  /**
   * Flush all pending actions once socket is ready
   */
  private flushPendingActions(): void {
    const actions = Array.from(this.pendingActions.values());
    this.pendingActions.clear();
    for (const action of actions) {
      action();
    }
  }

  /**
   * Setup socket event listeners (internal)
   * Removes previous listeners to prevent duplication on reconnection
   */
  private setupEventHandlers(socket: Socket): void {
    // Remove all previous listeners to prevent duplication on reconnect
    socket.removeAllListeners();

    socket.on('connect', () => {
      this.eventManager.emit('connected');
    });

    socket.on('disconnect', (reason) => {
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

    socket.on('message:unified', (payload: UnifiedMessageEvent) => {
      this.eventManager.emit('message:unified', payload);
    });

    socket.on('status:unified', (payload: UnifiedStatusUpdateEvent) => {
      this.eventManager.emit('status:unified', payload);
    });

    socket.on('message:deleted', (payload: UnifiedMessageDeletionEvent) => {
      this.eventManager.emit('message:deleted', payload);
    });

    socket.on('presence:joined', (payload: SocketPresencePayload) => {
      this.eventManager.emit('presence:joined', payload);
    });

    socket.on('presence:left', (payload: SocketPresencePayload) => {
      this.eventManager.emit('presence:left', payload);
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

  /**
   * Send presence ping to server to keep online status fresh
   * Non-critical operation - uses queueOrExecute to handle when socket is not ready
   */
  sendPresencePing(): void {
    this.queueOrExecute(() => {
      this.connection.getSocket()?.emit('presence:ping');
    }, 'presence-ping'); // Use consistent key to avoid queuing duplicates
  }

  // Event subscription methods
  subscribe<T = any>(event: string, handler: (data: T) => void): () => void {
    return this.eventManager.subscribe(event, handler);
  }

  onMessageUnified(handler: (payload: UnifiedMessageEvent) => void): () => void {
    return this.subscribe('message:unified', handler);
  }

  onStatusUnified(handler: (payload: UnifiedStatusUpdateEvent) => void): () => void {
    return this.subscribe('status:unified', handler);
  }

  onMessageDeleted(handler: (payload: UnifiedMessageDeletionEvent) => void): () => void {
    return this.subscribe('message:deleted', handler);
  }

  onPresenceJoined(handler: (payload: SocketPresencePayload) => void): () => void {
    return this.subscribe('presence:joined', handler);
  }

  onPresenceLeft(handler: (payload: SocketPresencePayload) => void): () => void {
    return this.subscribe('presence:left', handler);
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
