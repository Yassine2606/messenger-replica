import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from '../config';
import { messageService, conversationService, userService } from '../services';
import { authService } from '../services/auth.service';
import {
  UnifiedMessageDeletionEvent,
  SocketUserStatusPayload,
  messageToDTO,
} from '../types';
import { AppError } from '../middleware';
import { ReadStatus } from '../models/MessageRead';
import {
  batchMarkMessages,
  createMessageEvent,
  createStatusEvent,
} from './helpers';

type AuthenticatedSocket = Socket & { userId?: number };

export class SocketManager {
  private io: Server;
  private userSessions: Map<number, Set<string>> = new Map();
  private activeConversationViewers: Map<number, Set<number>> = new Map();
  private socketConversations: Map<string, Set<number>> = new Map(); // Track which conversations each socket has joined

  // Throttling for high-frequency events
  private lastTypingEventTime: Map<string, number> = new Map(); // Key: `${conversationId}:${userId}`, Value: timestamp

  constructor(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.cors.origin,
        credentials: true,
      },
      transports: ['websocket'],
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true,
      },
      maxHttpBufferSize: 10 * 1024 * 1024,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware(): void {
    this.io.use((socket: AuthenticatedSocket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      try {
        const decoded = authService.verifyToken(token);
        socket.userId = decoded.userId;
        next();
      } catch {
        next(new Error('Invalid token'));
      }
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', async (socket: AuthenticatedSocket) => {
      const userId = socket.userId!;

      // Track user session
      if (!this.userSessions.has(userId)) {
        this.userSessions.set(userId, new Set());
      }
      this.userSessions.get(userId)!.add(socket.id);

      // Initialize socket conversation tracking
      this.socketConversations.set(socket.id, new Set());

      // Join global conversations room to receive all conversation updates
      socket.join('conversations');

      // Mark pending messages as delivered when user connects
      await this.handleUserConnected(userId);

      // Broadcast user online
      await this.broadcastUserStatus(userId, 'online');

      socket.on('disconnect', () => {
        this.handleDisconnect(socket, userId).catch((error) => {
          console.error('Error handling disconnect:', error);
        });
      });

      // Presence heartbeat - keeps online status fresh (every 30 seconds)
      socket.on('presence:ping', () => this.handlePresencePing(userId));
      socket.on('message:send', (data, ack) => this.handleMessageSend(socket, userId, data, ack));
      socket.on('message:read', (data) => this.handleMessageRead(socket, userId, data));
      socket.on('message:delivered', (data) => this.handleMessageDelivered(socket, userId, data));
      socket.on('message:delete', (data) => this.handleMessageDelete(socket, userId, data));
      socket.on('conversation:join', (data) => this.handleConversationJoin(socket, userId, data));
      socket.on('conversation:leave', (data) => this.handleConversationLeave(socket, userId, data));
      socket.on('typing:start', (data) => this.handleTypingStart(socket, userId, data));
      socket.on('typing:stop', (data) => this.handleTypingStop(socket, userId, data));
    });
  }

  /**
   * Handle message send with batched mark-as-read/delivered
   */
  private async handleMessageSend(
    socket: AuthenticatedSocket,
    userId: number,
    data: any,
    ack?: (response: { success: boolean; message?: any; error?: string }) => void
  ): Promise<void> {
    try {
      const { conversationId, type, content, mediaUrl, mediaMimeType, mediaDuration, replyToId } =
        data;

      if (!conversationId || !type) {
        throw new AppError(400, 'Missing required fields');
      }

      if (type === 'text' && (!content?.trim())) {
        throw new AppError(400, 'Text content required');
      }

      if ((type === 'image' || type === 'audio') && !mediaUrl) {
        throw new AppError(400, 'Media URL required');
      }

      // Create message
      const message = await messageService.sendMessage({
        conversationId,
        senderId: userId,
        type,
        content,
        mediaUrl,
        mediaMimeType,
        mediaDuration,
        replyToId,
      });

      const conversation = await conversationService.getConversation(conversationId, userId);
      const participantIds = conversation.participants?.map(p => p.id).filter(Boolean) as number[];
      
      // Batch mark messages by status
      const activeViewers = this.activeConversationViewers.get(conversationId) || new Set();
      const readRecipients = participantIds.filter(id => id !== userId && activeViewers.has(id));
      const deliveredRecipients = participantIds.filter(id => id !== userId && 
        !activeViewers.has(id) && this.userSessions.has(id));

      if (readRecipients.length) {
        await batchMarkMessages([message.id], readRecipients, ReadStatus.READ, messageService);
      }
      if (deliveredRecipients.length) {
        await batchMarkMessages([message.id], deliveredRecipients, ReadStatus.DELIVERED, messageService);
      }

      // Fetch and broadcast
      const reloadedMessage = await messageService.getMessageWithRelations(message.id);
      const event = await createMessageEvent(
        conversationId,
        messageToDTO(reloadedMessage),
        participantIds,
        messageService
      );

      this.io.to(`conversation:${conversationId}`).emit('message:unified', event);
      this.io.to('conversations').emit('message:unified', event);

      ack?.({ success: true, message: messageToDTO(reloadedMessage) });
    } catch (error) {
      const msg = error instanceof AppError ? error.message : 'Failed to send message';
      socket.emit('error', { event: 'message:send', message: msg });
      ack?.({ success: false, error: msg });
    }
  }

  /**
   * Handle message read status - batch update
   */
  private async handleMessageRead(
    socket: AuthenticatedSocket,
    userId: number,
    data: any
  ): Promise<void> {
    try {
      const { messageId, messageIds, conversationId } = data;

      if (!conversationId) throw new AppError(400, 'Conversation ID required');

      const idsToMark = messageIds || (messageId ? [messageId] : []);
      if (!idsToMark.length) throw new AppError(400, 'No message IDs provided');

      // Batch mark all as read for this user
      await batchMarkMessages(idsToMark, [userId], ReadStatus.READ, messageService);

      // Notify conversation
      const conversation = await conversationService.getConversation(conversationId, userId);
      const participantIds = conversation.participants?.map(p => p.id).filter(Boolean) as number[];

      const event = await createStatusEvent(
        conversationId,
        idsToMark,
        userId,
        ReadStatus.READ,
        participantIds,
        messageService
      );

      this.io.to(`conversation:${conversationId}`).emit('status:unified', event);
      this.io.to('conversations').emit('status:unified', event);
    } catch (error) {
      socket.emit('error', {
        event: 'message:read',
        message: error instanceof AppError ? error.message : 'Failed to mark as read',
      });
    }
  }

  /**
   * Handle message delivered status
   */
  private async handleMessageDelivered(
    socket: AuthenticatedSocket,
    userId: number,
    data: any
  ): Promise<void> {
    try {
      const { messageId } = data;
      if (!messageId) throw new AppError(400, 'Message ID required');

      const message = await messageService.getMessageWithRelations(messageId);
      const { conversationId } = message;

      await batchMarkMessages([messageId], [userId], ReadStatus.DELIVERED, messageService);

      const conversation = await conversationService.getConversation(conversationId, userId);
      const participantIds = conversation.participants?.map(p => p.id).filter(Boolean) as number[];

      const event = await createStatusEvent(
        conversationId,
        [messageId],
        userId,
        ReadStatus.DELIVERED,
        participantIds,
        messageService
      );

      this.io.to(`conversation:${conversationId}`).emit('status:unified', event);
      this.io.to('conversations').emit('status:unified', event);
    } catch (error) {
      socket.emit('error', {
        event: 'message:delivered',
        message: error instanceof AppError ? error.message : 'Failed to mark as delivered',
      });
    }
  }

  /**
   * Handle message delete
   */
  private async handleMessageDelete(
    socket: AuthenticatedSocket,
    userId: number,
    data: any
  ): Promise<void> {
    try {
      const { messageId, conversationId } = data;
      if (!messageId || !conversationId) throw new AppError(400, 'Missing required fields');

      const conversation = await conversationService.getConversation(conversationId, userId);
      const participantIds = conversation.participants?.map(p => p.id).filter(Boolean) as number[];

      const unreadCounts = await messageService.getUnreadCountsForConversation(
        conversationId,
        participantIds
      );

      const event: UnifiedMessageDeletionEvent = {
        conversationId,
        deletedMessageIds: [messageId],
        conversationUpdates: participantIds.map(id => ({
          userId: id,
          unreadCount: unreadCounts.get(id) || 0,
        })),
      };

      this.io.to(`conversation:${conversationId}`).emit('message:deleted', event);
      this.io.to('conversations').emit('message:deleted', event);
    } catch (error) {
      socket.emit('error', {
        event: 'message:delete',
        message: error instanceof AppError ? error.message : 'Failed to delete message',
      });
    }
  }

  /**
   * Handle conversation join - auto-mark unread as read
   */
  private async handleConversationJoin(
    socket: AuthenticatedSocket,
    userId: number,
    data: any
  ): Promise<void> {
    try {
      const { conversationId } = data;

      const socketRooms = this.socketConversations.get(socket.id) || new Set();
      if (socketRooms.has(conversationId)) return;

      const conversation = await conversationService.getConversation(conversationId, userId);
      if (!conversation) throw new AppError(403, 'Access denied');

      socket.join(`conversation:${conversationId}`);
      socketRooms.add(conversationId);

      // Mark as active viewer
      if (!this.activeConversationViewers.has(conversationId)) {
        this.activeConversationViewers.set(conversationId, new Set());
      }
      const viewers = this.activeConversationViewers.get(conversationId)!;
      const wasNotViewing = !viewers.has(userId);
      viewers.add(userId);

      // Auto-mark unread as read on first join
      if (wasNotViewing) {
        const markedMessages = await messageService.markConversationAsRead(conversationId, userId);

        if (markedMessages.length > 0) {
          const participantIds = conversation.participants?.map(p => p.id).filter(Boolean) as number[];
          const event = await createStatusEvent(
            conversationId,
            markedMessages,
            userId,
            ReadStatus.READ,
            participantIds,
            messageService
          );

          this.io.to(`conversation:${conversationId}`).emit('status:unified', event);
        }
      }

      socket.to(`conversation:${conversationId}`).emit('presence:joined', { conversationId, userId });
    } catch (error) {
      socket.emit('error', {
        event: 'conversation:join',
        message: error instanceof AppError ? error.message : 'Failed to join conversation',
      });
    }
  }

  /**
   * Handle conversation leave
   */
  private async handleConversationLeave(
    socket: AuthenticatedSocket,
    userId: number,
    data: any
  ): Promise<void> {
    try {
      const { conversationId } = data;
      socket.leave(`conversation:${conversationId}`);

      const socketRooms = this.socketConversations.get(socket.id);
      socketRooms?.delete(conversationId);

      // Check if other sockets viewing this conversation
      const userSockets = this.userSessions.get(userId);
      const hasOtherSocket = userSockets && Array.from(userSockets).some(sid =>
        sid !== socket.id && this.socketConversations.get(sid)?.has(conversationId)
      );

      if (!hasOtherSocket) {
        const viewers = this.activeConversationViewers.get(conversationId);
        if (viewers?.delete(userId) && viewers.size === 0) {
          this.activeConversationViewers.delete(conversationId);
        }
        socket.to(`conversation:${conversationId}`).emit('presence:left', { conversationId, userId });
      }
    } catch (error) {
      socket.emit('error', {
        event: 'conversation:leave',
        message: 'Failed to leave conversation',
      });
    }
  }

  /**
   * Handle presence ping
   */
  private async handlePresencePing(userId: number): Promise<void> {
    try {
      await this.broadcastUserStatus(userId, 'online');
    } catch (error) {
      console.error('Presence ping failed:', error);
    }
  }

  /**
   * Handle disconnect - cleanup user and socket tracking
   */
  private async handleDisconnect(socket: AuthenticatedSocket, userId: number): Promise<void> {
    const socketRooms = this.socketConversations.get(socket.id);
    
    if (socketRooms) {
      const userSockets = this.userSessions.get(userId);
      for (const conversationId of socketRooms) {
        const hasOtherSocket = userSockets && Array.from(userSockets).some(sid =>
          sid !== socket.id && this.socketConversations.get(sid)?.has(conversationId)
        );

        if (!hasOtherSocket) {
          const viewers = this.activeConversationViewers.get(conversationId);
          if (viewers?.delete(userId) && viewers.size === 0) {
            this.activeConversationViewers.delete(conversationId);
          }
        }
      }
      this.socketConversations.delete(socket.id);
    }

    const userSockets = this.userSessions.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.userSessions.delete(userId);
        await userService.updateLastSeen(userId);
        await this.broadcastUserStatus(userId, 'offline');
      }
    }
  }

  /**
   * Mark pending messages as delivered on user connect
   */
  private async handleUserConnected(userId: number): Promise<void> {
    try {
      const undelivered = await messageService.getUndeliveredMessages(userId);
      if (!undelivered.length) return;

      // Group by conversation
      const byConversation: Record<number, number[]> = {};
      undelivered.forEach(msg => {
        byConversation[msg.conversationId] ??= [];
        byConversation[msg.conversationId].push(msg.id);
      });

      await batchMarkMessages(
        undelivered.map(m => m.id),
        [userId],
        ReadStatus.DELIVERED,
        messageService
      );

      // Broadcast per conversation
      for (const [convIdStr, msgIds] of Object.entries(byConversation)) {
        const conversationId = Number(convIdStr);
        try {
          const conversation = await conversationService.getConversation(conversationId, userId);
          const participantIds = conversation.participants?.map(p => p.id).filter(Boolean) as number[];

          const event = await createStatusEvent(
            conversationId,
            msgIds,
            userId,
            ReadStatus.DELIVERED,
            participantIds,
            messageService
          );

          this.io.to(`conversation:${conversationId}`).emit('status:unified', event);
        } catch (error) {
          console.error(`Delivery notification failed for conversation ${conversationId}:`, error);
        }
      }
    } catch (error) {
      console.error('User connected delivery failed:', error);
    }
  }

  /**
   * Handle typing start with throttle
   */
  private handleTypingStart(socket: AuthenticatedSocket, userId: number, data: any): void {
    const { conversationId } = data;
    if (!conversationId) return;

    const throttleKey = `${conversationId}:${userId}`;
    const now = Date.now();
    const lastTime = this.lastTypingEventTime.get(throttleKey) || 0;

    if (now - lastTime >= 1000) {
      this.lastTypingEventTime.set(throttleKey, now);
      socket.to(`conversation:${conversationId}`).emit('typing:start', { conversationId, userId });
    }
  }

  /**
   * Handle typing stop
   */
  private handleTypingStop(socket: AuthenticatedSocket, userId: number, data: any): void {
    const { conversationId } = data;
    if (!conversationId) return;
    socket.to(`conversation:${conversationId}`).emit('typing:stop', { conversationId, userId });
  }

  /**
   * Broadcast user online/offline status
   */
  private async broadcastUserStatus(userId: number, status: 'online' | 'offline'): Promise<void> {
    try {
      await userService.updateUserStatus(userId, status);
      const user = await userService.getUserById(userId);
      const lastSeen = user?.lastSeen || new Date();

      const payload: SocketUserStatusPayload = {
        userId,
        status,
        lastSeen: lastSeen.toISOString(),
      };

      const userConversations = await conversationService.getConversations(userId);
      const allConversationIds = userConversations.data.map((c: any) => c.id);

      for (const conversationId of allConversationIds) {
        this.io.to(`conversation:${conversationId}`).emit('user:status', payload);
      }
    } catch (error) {
      console.error('Broadcast status failed:', error);
    }
  }

  /**
   * Emit message to specific user sockets
   */
  emitToUser(userId: number, event: string, data: any): void {
    const userSockets = this.userSessions.get(userId);
    if (userSockets) {
      for (const socketId of userSockets) {
        this.io.to(socketId).emit(event, data);
      }
    }
  }

  /**
   * Emit event to all users in a conversation room
   */
  emitToConversation(conversationId: number, event: string, data: any): void {
    this.io.to(`conversation:${conversationId}`).emit(event, data);
  }

  /**
   * Broadcast unified message event (called by REST API)
   */
  async broadcastUnifiedMessage(
    conversationId: number,
    messageId: number,
    senderId: number
  ): Promise<void> {
    try {
      const conversation = await conversationService.getConversation(conversationId, senderId);
      const participantIds = conversation.participants?.map(p => p.id).filter(Boolean) as number[];

      // Batch mark by online status
      const activeViewers = this.activeConversationViewers.get(conversationId) || new Set();
      const readRecipients = participantIds.filter(id => id !== senderId && activeViewers.has(id));
      const deliveredRecipients = participantIds.filter(id => id !== senderId && 
        !activeViewers.has(id) && this.userSessions.has(id));

      if (readRecipients.length) {
        await batchMarkMessages([messageId], readRecipients, ReadStatus.READ, messageService);
      }
      if (deliveredRecipients.length) {
        await batchMarkMessages([messageId], deliveredRecipients, ReadStatus.DELIVERED, messageService);
      }

      const reloadedMessage = await messageService.getMessageWithRelations(messageId);
      const event = await createMessageEvent(
        conversationId,
        messageToDTO(reloadedMessage),
        participantIds,
        messageService
      );

      this.io.to(`conversation:${conversationId}`).emit('message:unified', event);
      this.io.to('conversations').emit('message:unified', event);
    } catch (error) {
      console.error('Broadcast message failed:', error);
      throw error;
    }
  }

  /**
   * Broadcast unified message deletion event (called by REST API)
   */
  async broadcastUnifiedMessageDeletion(
    conversationId: number,
    messageId: number,
    deleterId: number
  ): Promise<void> {
    try {
      const conversation = await conversationService.getConversation(conversationId, deleterId);
      const participantIds = conversation.participants?.map(p => p.id).filter(Boolean) as number[];

      const unreadCounts = await messageService.getUnreadCountsForConversation(
        conversationId,
        participantIds
      );

      const event: UnifiedMessageDeletionEvent = {
        conversationId,
        deletedMessageIds: [messageId],
        conversationUpdates: participantIds.map(id => ({
          userId: id,
          unreadCount: unreadCounts.get(id) || 0,
        })),
      };

      this.io.to(`conversation:${conversationId}`).emit('message:deleted', event);
      this.io.to('conversations').emit('message:deleted', event);
    } catch (error) {
      console.error('Broadcast deletion failed:', error);
      throw error;
    }
  }

  /**
   * Get IO instance
   */
  getIO(): Server {
    return this.io;
  }
}

let socketManager: SocketManager | null = null;

export function initializeSocket(httpServer: HTTPServer): SocketManager {
  socketManager = new SocketManager(httpServer);
  return socketManager;
}

export function getSocketManager(): SocketManager {
  if (!socketManager) {
    throw new Error('Socket manager not initialized');
  }
  return socketManager;
}
