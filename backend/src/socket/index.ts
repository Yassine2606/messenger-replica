import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from '../config';
import { messageService, conversationService, userService } from '../services';
import { authService } from '../services/auth.service';
import { SocketMessagePayload, SocketMessageStatusPayload, SocketConversationUpdatePayload, SocketUserStatusPayload, messageToDTO } from '../types';
import { AppError } from '../middleware';
import { ReadStatus } from '../models/MessageRead';

type AuthenticatedSocket = Socket & { userId?: number };

export class SocketManager {
  private io: Server;
  private userSessions: Map<number, Set<string>> = new Map();
  private activeConversationViewers: Map<number, Set<number>> = new Map();
  private socketConversations: Map<string, Set<number>> = new Map(); // Track which conversations each socket has joined

  constructor(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.cors.origin,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
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

      // Mark pending messages as delivered when user connects
      await this.handleUserConnected(userId);

      // Broadcast user online
      await this.broadcastUserStatus(userId, 'online');

      socket.on('disconnect', () => {
        this.handleDisconnect(socket, userId);
      });

      socket.on('message:send', (data) => this.handleMessageSend(socket, userId, data));
      socket.on('message:read', (data) => this.handleMessageRead(socket, userId, data));
      socket.on('message:delivered', (data) => this.handleMessageDelivered(socket, userId, data));
      socket.on('conversation:join', (data) => this.handleConversationJoin(socket, userId, data));
      socket.on('conversation:leave', (data) => this.handleConversationLeave(socket, userId, data));
      socket.on('typing:start', (data) => this.handleTypingStart(socket, userId, data));
      socket.on('typing:stop', (data) => this.handleTypingStop(socket, userId, data));
    });
  }

  /**
   * Handle message send
   */
  private async handleMessageSend(socket: AuthenticatedSocket, userId: number, data: any): Promise<void> {
    try {
      const { conversationId, type, content, mediaUrl, mediaMimeType, mediaDuration, replyToId } = data;

      // Validate required fields
      if (!conversationId || typeof conversationId !== 'number') {
        socket.emit('error', { event: 'message:send', message: 'Valid conversation ID required' });
        return;
      }

      if (!type || typeof type !== 'string') {
        socket.emit('error', { event: 'message:send', message: 'Message type required' });
        return;
      }

      // Validate content based on type
      if (type === 'text' && (!content || typeof content !== 'string' || content.trim().length === 0)) {
        socket.emit('error', { event: 'message:send', message: 'Text content required' });
        return;
      }

      if ((type === 'image' || type === 'audio') && (!mediaUrl || typeof mediaUrl !== 'string')) {
        socket.emit('error', { event: 'message:send', message: 'Media URL required' });
        return;
      }

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

      // Get conversation participants to check who's online
      const messageConversation = await conversationService.getConversation(conversationId, userId);
      const messageParticipants = messageConversation.participants || [];

      // Process status updates for each participant atomically
      const statusUpdates: SocketMessageStatusPayload[] = [];
      const activeViewers = this.activeConversationViewers.get(conversationId);

      for (const participant of messageParticipants) {
        if (participant.id && participant.id !== userId) {
          const isOnline = this.userSessions.has(participant.id);
          const isActiveViewer = activeViewers?.has(participant.id);
          
          if (isActiveViewer) {
            // User is actively viewing - mark as READ
            await messageService.markAsRead([message.id], participant.id);
            statusUpdates.push({
              messageId: message.id,
              conversationId,
              status: ReadStatus.READ,
              userId: participant.id,
              readAt: new Date().toISOString(),
            });
          } else if (isOnline) {
            // User is online but not viewing - mark as DELIVERED
            await messageService.markAsDelivered([message.id], participant.id);
            statusUpdates.push({
              messageId: message.id,
              conversationId,
              status: ReadStatus.DELIVERED,
              userId: participant.id,
              readAt: new Date().toISOString(),
            });
          }
          // If offline, status remains SENT (set during message creation)
        }
      }

      // Reload message with final state
      const reloadedMessage = await messageService.getMessageWithRelations(message.id);
      const messageWithReads = messageToDTO(reloadedMessage);
      
      // Emit message once with complete reads array
      const payload: SocketMessagePayload = {
        message: messageWithReads,
        conversationId,
      };
      this.io.to(`conversation:${conversationId}`).emit('message:new', payload);

      // Emit status updates (for real-time UI updates)
      for (const statusUpdate of statusUpdates) {
        this.io.to(`conversation:${conversationId}`).emit('message:status', statusUpdate);
      }

      // Broadcast conversation update to all participants
      await this.broadcastConversationUpdate(conversationId, messageParticipants);
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to send message';
      socket.emit('error', {
        event: 'message:send',
        message,
      });
    }
  }

  /**
   * Handle message read status update (supports batch)
   */
  private async handleMessageRead(socket: AuthenticatedSocket, userId: number, data: any): Promise<void> {
    try {
      const { messageId, messageIds, conversationId } = data;
      
      // Validate conversation ID
      if (!conversationId || typeof conversationId !== 'number') {
        socket.emit('error', { event: 'message:read', message: 'Valid conversation ID required' });
        return;
      }

      const idsToMark = messageIds || (messageId ? [messageId] : []);

      if (idsToMark.length === 0) {
        socket.emit('error', { event: 'message:read', message: 'No message IDs provided' });
        return;
      }

      // Validate message IDs
      if (!Array.isArray(idsToMark) || !idsToMark.every(id => typeof id === 'number' && id > 0)) {
        socket.emit('error', { event: 'message:read', message: 'Invalid message IDs' });
        return;
      }

      await messageService.markAsRead(idsToMark, userId);

      // Emit status update to conversation for each message
      const readAt = new Date().toISOString();
      for (const id of idsToMark) {
        const payload: SocketMessageStatusPayload = {
          messageId: id,
          conversationId,
          status: ReadStatus.READ,
          userId,
          readAt,
        };

        this.io.to(`conversation:${conversationId}`).emit('message:status', payload);
      }

      // Broadcast conversation update to all participants
      const conversation = await conversationService.getConversation(conversationId, userId);
      const participants = conversation.participants || [];
      await this.broadcastConversationUpdate(conversationId, participants);
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to update message status';
      socket.emit('error', {
        event: 'message:read',
        message,
      });
    }
  }

  /**
   * Handle message delivered status update
   */
  private async handleMessageDelivered(socket: AuthenticatedSocket, userId: number, data: any): Promise<void> {
    try {
      const { messageId } = data;

      if (!messageId) {
        socket.emit('error', { event: 'message:delivered', message: 'Message ID required' });
        return;
      }

      await messageService.markAsDelivered([messageId], userId);

      // Get message to find conversation ID
      const message = await messageService.getMessageWithRelations(messageId);
      
      // Emit status update to conversation
      const payload: SocketMessageStatusPayload = {
        messageId,
        conversationId: message.conversationId,
        status: ReadStatus.DELIVERED,
        userId,
        readAt: new Date().toISOString(),
      };

      this.io.to(`conversation:${message.conversationId}`).emit('message:status', payload);
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to mark message as delivered';
      socket.emit('error', {
        event: 'message:delivered',
        message,
      });
    }
  }

  /**
   * Handle conversation join (user enters chat)
   */
  private async handleConversationJoin(socket: AuthenticatedSocket, userId: number, data: any): Promise<void> {
    try {
      const { conversationId } = data;

      // Prevent duplicate joins from same socket
      const socketRooms = this.socketConversations.get(socket.id);
      if (socketRooms?.has(conversationId)) {
        // Already joined, skip
        return;
      }

      // Verify user is participant
      const conversation = await conversationService.getConversation(conversationId, userId);
      if (!conversation) {
        socket.emit('error', { event: 'conversation:join', message: 'Access denied' });
        return;
      }

      // Join socket to conversation room
      socket.join(`conversation:${conversationId}`);
      socketRooms?.add(conversationId);

      // Track user as active viewer (only if not already tracked)
      if (!this.activeConversationViewers.has(conversationId)) {
        this.activeConversationViewers.set(conversationId, new Set());
      }
      const wasNotViewing = !this.activeConversationViewers.get(conversationId)!.has(userId);
      this.activeConversationViewers.get(conversationId)!.add(userId);

      // Auto-mark all unread messages as read (only if user wasn't already viewing)
      if (wasNotViewing) {
        const markedMessages = await messageService.markConversationAsRead(conversationId, userId);

        // Emit status updates for each marked message
        if (markedMessages.length > 0) {
          const readAt = new Date().toISOString();
          for (const messageId of markedMessages) {
            const payload: SocketMessageStatusPayload = {
              messageId,
              conversationId,
              status: ReadStatus.READ,
              userId,
              readAt,
            };
            this.io.to(`conversation:${conversationId}`).emit('message:status', payload);
          }

          // Broadcast conversation updates to all participants after marking as read
          await this.broadcastConversationUpdate(conversationId, conversation.participants || []);
        }
      }

      // Broadcast that user is viewing conversation (for typing indicators, etc)
      socket.to(`conversation:${conversationId}`).emit('conversation:user-joined', {
        conversationId,
        userId,
      });
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to join conversation';
      socket.emit('error', {
        event: 'conversation:join',
        message,
      });
    }
  }

  /**
   * Handle conversation leave
   */
  private async handleConversationLeave(socket: AuthenticatedSocket, userId: number, data: any): Promise<void> {
    try {
      const { conversationId } = data;

      socket.leave(`conversation:${conversationId}`);

      // Remove from socket tracking
      const socketRooms = this.socketConversations.get(socket.id);
      socketRooms?.delete(conversationId);

      // Check if user has any other sockets viewing this conversation
      const userSockets = this.userSessions.get(userId);
      let hasOtherSocketInConversation = false;
      if (userSockets) {
        for (const socketId of userSockets) {
          if (socketId !== socket.id && this.socketConversations.get(socketId)?.has(conversationId)) {
            hasOtherSocketInConversation = true;
            break;
          }
        }
      }

      // Only remove from active viewers if no other socket is viewing
      if (!hasOtherSocketInConversation) {
        const viewers = this.activeConversationViewers.get(conversationId);
        if (viewers) {
          viewers.delete(userId);
          if (viewers.size === 0) {
            this.activeConversationViewers.delete(conversationId);
          }
        }

        socket.to(`conversation:${conversationId}`).emit('conversation:user-left', {
          conversationId,
          userId,
        });
      }
    } catch (error) {
      socket.emit('error', {
        event: 'conversation:leave',
        message: 'Failed to leave conversation',
      });
    }
  }

  /**
   * Handle user disconnect
   */
  private handleDisconnect(socket: AuthenticatedSocket, userId: number): void {
    // Get conversations this socket was in
    const socketRooms = this.socketConversations.get(socket.id);
    
    // Clean up active viewers for each conversation
    if (socketRooms) {
      const userSockets = this.userSessions.get(userId);
      for (const conversationId of socketRooms) {
        // Check if user has other sockets in this conversation
        let hasOtherSocketInConversation = false;
        if (userSockets) {
          for (const socketId of userSockets) {
            if (socketId !== socket.id && this.socketConversations.get(socketId)?.has(conversationId)) {
              hasOtherSocketInConversation = true;
              break;
            }
          }
        }
        
        // Only remove from active viewers if no other socket is viewing
        if (!hasOtherSocketInConversation) {
          const viewers = this.activeConversationViewers.get(conversationId);
          if (viewers) {
            viewers.delete(userId);
            if (viewers.size === 0) {
              this.activeConversationViewers.delete(conversationId);
            }
          }
        }
      }
      
      // Clean up socket conversation tracking
      this.socketConversations.delete(socket.id);
    }

    // Clean up user session
    const userSockets = this.userSessions.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.userSessions.delete(userId);
        this.broadcastUserStatus(userId, 'offline');
      }
    }
  }

  /**
   * Handle user connected - mark pending messages as delivered
   */
  private async handleUserConnected(userId: number): Promise<void> {
    try {
      // Get all undelivered messages for this user
      const undeliveredMessages = await messageService.getUndeliveredMessages(userId);

      if (undeliveredMessages.length > 0) {
        const messageIds = undeliveredMessages.map((m) => m.id);
        
        // Mark all as delivered
        await messageService.markAsDelivered(messageIds, userId);

        // Broadcast delivery status for each conversation
        const conversationGroups = undeliveredMessages.reduce((acc, msg) => {
          if (!acc[msg.conversationId]) {
            acc[msg.conversationId] = [];
          }
          acc[msg.conversationId].push(msg.id);
          return acc;
        }, {} as Record<number, number[]>);

        for (const [conversationId, msgIds] of Object.entries(conversationGroups)) {
          for (const messageId of msgIds) {
            const payload: SocketMessageStatusPayload = {
              messageId,
              conversationId: Number(conversationId),
              status: ReadStatus.DELIVERED,
              userId,
              readAt: new Date().toISOString(),
            };
            this.io.to(`conversation:${conversationId}`).emit('message:status', payload);
          }
        }
      }
    } catch (error) {
      console.error('Failed to mark messages as delivered:', error);
    }
  }

  /**
   * Handle typing start
   */
  private handleTypingStart(socket: AuthenticatedSocket, userId: number, data: any): void {
    try {
      const { conversationId } = data;
      if (!conversationId || typeof conversationId !== 'number') {
        return;
      }
      
      // Only emit to others in the room (not to sender)
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        conversationId,
        userId,
        isTyping: true,
      });
    } catch (error) {
      console.error('Failed to handle typing start:', error);
    }
  }

  /**
   * Handle typing stop
   */
  private handleTypingStop(socket: AuthenticatedSocket, userId: number, data: any): void {
    try {
      const { conversationId } = data;
      if (!conversationId || typeof conversationId !== 'number') {
        return;
      }
      
      // Only emit to others in the room (not to sender)
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId,
        isTyping: false,
      });
    } catch (error) {
      console.error('Failed to handle typing stop:', error);
    }
  }

  /**
   * Broadcast user online/offline status
   */
  private async broadcastUserStatus(userId: number, status: 'online' | 'offline'): Promise<void> {
    try {
      // Update user status in database
      await userService.updateUserStatus(userId, status);

      const payload: SocketUserStatusPayload = {
        userId,
        status,
        lastSeen: new Date().toISOString(),
      };

      this.io.emit('user:status', payload);
    } catch (error) {
      console.error('Failed to broadcast user status:', error);
    }
  }

  /**
   * Broadcast conversation update to all participants
   */
  private async broadcastConversationUpdate(
    conversationId: number,
    participants: Array<{ id: number; name: string; avatarUrl?: string; status?: string; lastSeen?: string }>
  ): Promise<void> {
    for (const participant of participants) {
      if (participant.id) {
        const conversation = await conversationService.getConversation(conversationId, participant.id);
        const conversationPayload: SocketConversationUpdatePayload = {
          conversation,
          userId: participant.id,
        };
        const userSockets = this.userSessions.get(participant.id);
        if (userSockets) {
          for (const socketId of userSockets) {
            this.io.to(socketId).emit('conversation:updated', conversationPayload);
          }
        }
      }
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
   * Mark message as delivered for online users (excluding sender)
   */
  async markMessageAsDeliveredForOnlineUsers(messageId: number, conversationId: number, senderId: number): Promise<void> {
    const conversation = await conversationService.getConversation(conversationId, senderId);
    const participants = conversation.participants || [];

    for (const participant of participants) {
      if (participant.id && participant.id !== senderId) {
        const isOnline = this.userSessions.has(participant.id);
        
        if (isOnline) {
          // Check if user is actively viewing this conversation
          const isActiveViewer = this.activeConversationViewers.get(conversationId)?.has(participant.id);
          
          if (isActiveViewer) {
            // User is viewing - mark as READ
            await messageService.markAsRead([messageId], participant.id);
            
            const statusPayload: SocketMessageStatusPayload = {
              messageId,
              conversationId,
              status: ReadStatus.READ,
              userId: participant.id,
              readAt: new Date().toISOString(),
            };
            this.io.to(`conversation:${conversationId}`).emit('message:status', statusPayload);
          } else {
            // User is online but not viewing - mark as DELIVERED
            await messageService.markAsDelivered([messageId], participant.id);
            
            const deliveryPayload: SocketMessageStatusPayload = {
              messageId,
              conversationId,
              status: ReadStatus.DELIVERED,
              userId: participant.id,
              readAt: new Date().toISOString(),
            };
            this.io.to(`conversation:${conversationId}`).emit('message:status', deliveryPayload);
          }
        }
      }
    }

    // Broadcast conversation update after status changes
    await this.broadcastConversationUpdate(conversationId, participants);
  }

  /**
   * Broadcast conversation update to all participants (public method)
   */
  async broadcastConversationUpdateToParticipants(
    conversationId: number,
    participants: Array<{ id: number; name: string; avatarUrl?: string; status?: string; lastSeen?: string }>
  ): Promise<void> {
    await this.broadcastConversationUpdate(conversationId, participants);
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
