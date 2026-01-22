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
      transports: ['websocket'],
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
   */
  private queueOrExecute(action: () => void, deduplicationKey?: string): void {
    if (this.isConnected()) {
      action();
    } else {
      const key = deduplicationKey || `action-${this.actionCounter++}`;
      this.pendingActions.set(key, action);
    }
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
    socket.removeAllListeners();

    socket.on('connect', () => this.eventManager.emit('connected'));
    socket.on('disconnect', (reason) => this.eventManager.emit('disconnected', reason));
    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      this.eventManager.emit('error', error);
    });
    socket.on('error', (payload: SocketErrorPayload) => {
      console.error('[Socket] Server error:', payload);
      this.eventManager.emit('server_error', payload);
    });

    // Event forwarding - simple passthrough
    const events: Array<[string, string]> = [
      ['message:unified', 'message:unified'],
      ['status:unified', 'status:unified'],
      ['message:deleted', 'message:deleted'],
      ['presence:joined', 'presence:joined'],
      ['presence:left', 'presence:left'],
      ['user:status', 'user:status'],
      ['typing:start', 'typing:start'],
      ['typing:stop', 'typing:stop'],
    ];

    events.forEach(([socketEvent, managerEvent]) => {
      socket.on(socketEvent, (payload) => this.eventManager.emit(managerEvent, payload));
    });

    // Heartbeat every 30s to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) socket.emit('presence:ping');
    }, 30000);

    socket.once('disconnect', () => clearInterval(heartbeatInterval));
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
   * Mark messages as read in a conversation
   * Sends read status update to backend
   */
  markMessagesAsRead(conversationId: number, messageIds: number[]): void {
    if (messageIds.length === 0) return;
    this.queueOrExecute(() => {
      this.connection.getSocket()?.emit('message:read', {
        conversationId,
        messageIds,
      });
    });
  }

  /**
   * Send a message via Socket.io with acknowledgment callback
   * 
   * This implements the "Ack callbacks" pattern from the blueprint:
   * - Faster than waiting for a separate 'message:new' event
   * - Callback fires when server confirms message was saved
   * - Better UX: remove loading spinner immediately instead of waiting for broadcast
   * 
   * @param data Message payload
   * @param onAck Callback when server confirms (receives sent message)
   * @param onError Callback if send fails
   */
  sendMessageWithAck(
    data: {
      conversationId: number;
      type: string;
      content?: string;
      mediaUrl?: string;
      mediaMimeType?: string;
      mediaDuration?: number;
      replyToId?: number;
    },
    onAck?: (serverMessage: any) => void,
    onError?: (error: any) => void
  ): void {
    this.queueOrExecute(() => {
      const socket = this.connection.getSocket();
      if (!socket) {
        onError?.({ message: 'Socket not connected' });
        return;
      }

      socket.emit('message:send', data, (response: any) => {
        if (response?.success) {
          onAck?.(response.message);
        } else {
          onError?.(response?.error || { message: 'Send failed' });
        }
      });
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
