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

  /**
   * Connect to socket server
   */
  connect(token: string): void {
    if (this.socket?.connected) {
      console.log('[Socket] Already connected');
      return;
    }

    this.token = token;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
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
      console.log('[Socket] Disconnected');
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
      console.log('[Socket] Connected');
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      this.emit('error', error);
    });

    this.socket.on('error', (payload: SocketErrorPayload) => {
      console.error('[Socket] Server error:', payload);
      this.emit('server_error', payload);
    });
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
   * Listen for new messages
   */
  onMessageNew(callback: (payload: SocketMessagePayload) => void): () => void {
    return this.on('message:new', callback);
  }

  /**
   * Listen for message status updates
   */
  onMessageStatus(callback: (payload: SocketMessageStatusPayload) => void): () => void {
    return this.on('message:status', callback);
  }

  /**
   * Listen for conversation updates
   */
  onConversationUpdated(callback: (payload: SocketConversationUpdatePayload) => void): () => void {
    return this.on('conversation:updated', callback);
  }

  /**
   * Listen for user status changes
   */
  onUserStatus(callback: (payload: SocketUserStatusPayload) => void): () => void {
    return this.on('user:status', callback);
  }

  /**
   * Listen for typing start
   */
  onTypingStart(callback: (payload: SocketTypingPayload) => void): () => void {
    return this.on('typing:start', callback);
  }

  /**
   * Listen for typing stop
   */
  onTypingStop(callback: (payload: SocketTypingPayload) => void): () => void {
    return this.on('typing:stop', callback);
  }

  /**
   * Generic event listener
   */
  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Register with socket if not internal event
    if (!['connected', 'disconnected', 'error', 'server_error'].includes(event)) {
      this.socket?.on(event, callback as any);
    }

    // Return cleanup function
    return () => this.off(event, callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }

    if (!['connected', 'disconnected', 'error', 'server_error'].includes(event)) {
      this.socket?.off(event, callback as any);
    }
  }

  /**
   * Emit internal event to listeners
   */
  private emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(...args));
    }
  }
}

export const socketClient = new SocketClient();
export const socketManager = socketClient; // Alias for backwards compatibility
