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

class SocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private eventListeners: Map<string, Set<Function>> = new Map();

  /**
   * Connect to socket server
   */
  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    if (this.socket && !this.socket.connected) {
      // Reconnect existing socket
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

    this.setupEventHandlers();
  }

  /**
   * Disconnect from socket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.token = null;
      this.listeners.clear();
      this.eventListeners.clear();
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Setup internal event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.emitEvent('connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.emitEvent('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      this.emitEvent('error', error);
    });

    this.socket.on('error', (payload: SocketErrorPayload) => {
      console.error('[Socket] Server error:', payload);
      this.emitEvent('server_error', payload);
    });

    // Register message event listeners
    this.socket.on('message:new', (payload: SocketMessagePayload) => {
      this.emitEvent('message:new', payload);
    });

    this.socket.on('message:status', (payload: SocketMessageStatusPayload) => {
      this.emitEvent('message:status', payload);
    });

    this.socket.on('conversation:updated', (payload: SocketConversationUpdatePayload) => {
      this.emitEvent('conversation:updated', payload);
    });

    this.socket.on('user:status', (payload: SocketUserStatusPayload) => {
      this.emitEvent('user:status', payload);
    });

    this.socket.on('typing:start', (payload: SocketTypingPayload) => {
      this.emitEvent('typing:start', payload);
    });

    this.socket.on('typing:stop', (payload: SocketTypingPayload) => {
      this.emitEvent('typing:stop', payload);
    });
  }

  /**
   * Emit internal event
   */
  private emitEvent(event: string, data?: any): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  /**
   * Join conversation room
   */
  joinConversation(conversationId: number): void {
    this.socket?.emit('conversation:join', { conversationId });
  }

  /**
   * Leave conversation room
   */
  leaveConversation(conversationId: number): void {
    this.socket?.emit('conversation:leave', { conversationId });
  }

  /**
   * Send message
   */
  sendMessage(data: {
    conversationId: number;
    type: string;
    content?: string;
    mediaUrl?: string;
    mediaMimeType?: string;
    mediaDuration?: number;
    replyToId?: number;
  }): void {
    this.socket?.emit('message:send', data);
  }

  /**
   * Mark message(s) as read
   */
  markAsRead(data: { conversationId: number; messageId?: number; messageIds?: number[] }): void {
    this.socket?.emit('message:read', data);
  }

  /**
   * Emit message delivered event
   */
  emitMessageDelivered(messageId: number): void {
    this.socket?.emit('message:delivered', { messageId });
  }

  /**
   * Emit conversation read event
   */
  emitConversationRead(conversationId: number): void {
    this.socket?.emit('conversation:read', { conversationId });
  }

  /**
   * Start typing indicator
   */
  startTyping(conversationId: number): void {
    this.socket?.emit('typing:start', { conversationId });
  }

  /**
   * Stop typing indicator
   */
  stopTyping(conversationId: number): void {
    this.socket?.emit('typing:stop', { conversationId });
  }

  /**
   * Subscribe to event with cleanup function
   */
  subscribe<T = any>(event: string, handler: (data: T) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)!.add(handler as Function);

    // Return cleanup function
    return () => {
      const handlers = this.eventListeners.get(event);
      if (handlers) {
        handlers.delete(handler as Function);
      }
    };
  }

  /**
   * Listen to new messages
   */
  onMessageNew(handler: (payload: SocketMessagePayload) => void): () => void {
    return this.subscribe('message:new', handler);
  }

  /**
   * Listen to message status updates
   */
  onMessageStatus(handler: (payload: SocketMessageStatusPayload) => void): () => void {
    return this.subscribe('message:status', handler);
  }

  /**
   * Listen to conversation updates
   */
  onConversationUpdated(handler: (payload: SocketConversationUpdatePayload) => void): () => void {
    return this.subscribe('conversation:updated', handler);
  }

  /**
   * Listen to user status changes
   */
  onUserStatus(handler: (payload: SocketUserStatusPayload) => void): () => void {
    return this.subscribe('user:status', handler);
  }

  /**
   * Listen to typing start
   */
  onTypingStart(handler: (payload: SocketTypingPayload) => void): () => void {
    return this.subscribe('typing:start', handler);
  }

  /**
   * Listen to typing stop
   */
  onTypingStop(handler: (payload: SocketTypingPayload) => void): () => void {
    return this.subscribe('typing:stop', handler);
  }
}

export const socketClient = new SocketClient();
export const socketManager = socketClient; // Alias for backwards compatibility
