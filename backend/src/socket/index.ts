import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from '../config';
import { messageService, conversationService, userService } from '../services';
import { authService } from '../services/auth.service';
import { UnifiedMessageEvent, UnifiedStatusUpdateEvent, UnifiedMessageDeletionEvent, SocketUserStatusPayload, messageToDTO } from '../types';
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
        this.handleDisconnect(socket, userId).catch((error) => {
          console.error('Error handling disconnect:', error);
        });
      });

      // Presence heartbeat - keeps online status fresh (every 30 seconds)
      socket.on('presence:ping', () => this.handlePresencePing(userId));
      socket.on('message:send', (data) => this.handleMessageSend(socket, userId, data));
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
   * Handle message send - UNIFIED EVENT PATTERN
   * Sends one consolidated event with message + unread counts for each recipient
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

      // Get conversation with participants
      const conversation = await conversationService.getConversation(conversationId, userId);
      const participants = conversation.participants || [];
      const participantIds = participants.map(p => p.id).filter(Boolean) as number[];

      // Mark messages as delivered/read for online users based on their state
      const activeViewers = this.activeConversationViewers.get(conversationId);
      const messagesToMarkDelivered: number[] = [];
      const messagesToMarkRead: number[] = [];

      for (const participant of participants) {
        if (participant.id && participant.id !== userId) {
          const isOnline = this.userSessions.has(participant.id);
          const isActiveViewer = activeViewers?.has(participant.id);
          
          if (isActiveViewer) {
            messagesToMarkRead.push(participant.id);
          } else if (isOnline) {
            messagesToMarkDelivered.push(participant.id);
          }
        }
      }

      // Batch mark as read and delivered
      if (messagesToMarkRead.length > 0) {
        for (const recipientId of messagesToMarkRead) {
          await messageService.markAsRead([message.id], recipientId);
        }
      }
      if (messagesToMarkDelivered.length > 0) {
        for (const recipientId of messagesToMarkDelivered) {
          await messageService.markAsDelivered([message.id], recipientId);
        }
      }

      // Reload message with final state
      const reloadedMessage = await messageService.getMessageWithRelations(message.id);
      const messageWithReads = messageToDTO(reloadedMessage);

      // Get unread counts for all participants (SINGLE QUERY instead of N+1)
      const unreadCounts = await messageService.getUnreadCountsForConversation(conversationId, participantIds);

      // Create unified event with message + per-recipient unread counts
      const unifiedEvent: UnifiedMessageEvent = {
        conversationId,
        message: messageWithReads,
        conversationUpdates: participantIds.map(id => ({
          userId: id,
          unreadCount: unreadCounts.get(id) || 0,
        })),
      };

      // Send single consolidated event to entire conversation
      this.io.to(`conversation:${conversationId}`).emit('message:unified', unifiedEvent);
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to send message';
      socket.emit('error', {
        event: 'message:send',
        message,
      });
    }
  }

  /**
   * Handle message read status update - BATCHED UNIFIED EVENT
   * Combines multiple read updates into one event with unread count changes
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

      // Get conversation to find all participants
      const conversation = await conversationService.getConversation(conversationId, userId);
      const participants = conversation.participants || [];
      const participantIds = participants.map(p => p.id).filter(Boolean) as number[];

      // Get unread counts for all participants (SINGLE QUERY)
      const unreadCounts = await messageService.getUnreadCountsForConversation(conversationId, participantIds);

      // Create batched unified event with all status updates
      const readAt = new Date().toISOString();
      const unifiedEvent: UnifiedStatusUpdateEvent = {
        conversationId,
        updates: idsToMark.map(id => ({
          messageId: id,
          userId,
          status: ReadStatus.READ,
          readAt,
        })),
        conversationUpdates: participantIds.map(id => ({
          userId: id,
          unreadCount: unreadCounts.get(id) || 0,
        })),
      };

      // Send single consolidated event to entire conversation
      this.io.to(`conversation:${conversationId}`).emit('status:unified', unifiedEvent);
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to update message status';
      socket.emit('error', {
        event: 'message:read',
        message,
      });
    }
  }

  /**
   * Handle message delivered status update - UNIFIED EVENT
   * Triggered when client explicitly marks a message as delivered
   */
  private async handleMessageDelivered(socket: AuthenticatedSocket, userId: number, data: any): Promise<void> {
    try {
      const { messageId } = data;

      if (!messageId) {
        socket.emit('error', { event: 'message:delivered', message: 'Message ID required' });
        return;
      }

      // Get message to find conversation
      const message = await messageService.getMessageWithRelations(messageId);
      const conversationId = message.conversationId;

      // Mark as delivered
      await messageService.markAsDelivered([messageId], userId);

      // Get conversation for unread count calculation
      const conversation = await conversationService.getConversation(conversationId, userId);
      const participants = conversation.participants || [];
      const participantIds = participants.map(p => p.id).filter(Boolean) as number[];

      // Get unread counts
      const unreadCounts = await messageService.getUnreadCountsForConversation(conversationId, participantIds);

      // Create unified event
      const readAt = new Date().toISOString();
      const unifiedEvent: UnifiedStatusUpdateEvent = {
        conversationId,
        updates: [
          {
            messageId,
            userId,
            status: ReadStatus.DELIVERED,
            readAt,
          },
        ],
        conversationUpdates: participantIds.map(id => ({
          userId: id,
          unreadCount: unreadCounts.get(id) || 0,
        })),
      };

      // Emit to conversation
      this.io.to(`conversation:${conversationId}`).emit('status:unified', unifiedEvent);
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to mark message as delivered';
      socket.emit('error', {
        event: 'message:delivered',
        message,
      });
    }
  }

  /**
   * Handle message delete - UNIFIED EVENT
   * Sends consolidated event when a message is deleted
   */
  private async handleMessageDelete(socket: AuthenticatedSocket, userId: number, data: any): Promise<void> {
    try {
      const { messageId, conversationId } = data;

      if (!messageId) {
        socket.emit('error', { event: 'message:delete', message: 'Message ID required' });
        return;
      }

      if (!conversationId || typeof conversationId !== 'number') {
        socket.emit('error', { event: 'message:delete', message: 'Valid conversation ID required' });
        return;
      }

      // Get conversation with participants
      const conversation = await conversationService.getConversation(conversationId, userId);
      const participants = conversation.participants || [];
      const participantIds = participants.map(p => p.id).filter(Boolean) as number[];

      // Get unread counts for all participants
      const unreadCounts = await messageService.getUnreadCountsForConversation(conversationId, participantIds);

      // Create unified deletion event
      const unifiedEvent: UnifiedMessageDeletionEvent = {
        conversationId,
        deletedMessageIds: [messageId],
        conversationUpdates: participantIds.map(id => ({
          userId: id,
          unreadCount: unreadCounts.get(id) || 0,
        })),
      };

      // Send single consolidated event to entire conversation
      this.io.to(`conversation:${conversationId}`).emit('message:deleted', unifiedEvent);
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to delete message';
      socket.emit('error', {
        event: 'message:delivered',
        message,
      });
    }
  }

  /**
   * Handle conversation join (user enters chat) - UNIFIED PATTERN
   * Auto-marks unread messages as read, sends consolidated event
   */
  private async handleConversationJoin(socket: AuthenticatedSocket, userId: number, data: any): Promise<void> {
    try {
      const { conversationId } = data;

      // Prevent duplicate joins from same socket
      const socketRooms = this.socketConversations.get(socket.id);
      if (socketRooms?.has(conversationId)) {
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

      // Track user as active viewer
      if (!this.activeConversationViewers.has(conversationId)) {
        this.activeConversationViewers.set(conversationId, new Set());
      }
      const wasNotViewing = !this.activeConversationViewers.get(conversationId)!.has(userId);
      this.activeConversationViewers.get(conversationId)!.add(userId);

      // Auto-mark all unread messages as read (only if user wasn't already viewing)
      if (wasNotViewing) {
        const markedMessages = await messageService.markConversationAsRead(conversationId, userId);

        if (markedMessages.length > 0) {
          const participants = conversation.participants || [];
          const participantIds = participants.map(p => p.id).filter(Boolean) as number[];

          // Get unread counts ONCE for all participants
          const unreadCounts = await messageService.getUnreadCountsForConversation(conversationId, participantIds);

          // Create single unified event with all marked messages + updated unread counts
          const readAt = new Date().toISOString();
          const unifiedEvent: UnifiedStatusUpdateEvent = {
            conversationId,
            updates: markedMessages.map(messageId => ({
              messageId,
              userId,
              status: ReadStatus.READ,
              readAt,
            })),
            conversationUpdates: participantIds.map(id => ({
              userId: id,
              unreadCount: unreadCounts.get(id) || 0,
            })),
          };

          // Single consolidated event to entire conversation
          this.io.to(`conversation:${conversationId}`).emit('status:unified', unifiedEvent);
        }
      }

      // Broadcast that user is viewing conversation (for presence awareness)
      socket.to(`conversation:${conversationId}`).emit('presence:joined', {
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

        // Broadcast presence leave event
        socket.to(`conversation:${conversationId}`).emit('presence:left', {
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
   * Handle presence ping from client - keeps online status fresh and real-time
   * Called every 30 seconds by the frontend to prevent staleness
   */
  private async handlePresencePing(userId: number): Promise<void> {
    try {
      // Broadcast fresh online status to all conversations where user is participant
      await this.broadcastUserStatus(userId, 'online');
    } catch (error) {
      console.error('[SocketManager] Failed to handle presence ping:', error);
      // Don't emit error to client - presence ping is non-critical
    }
  }

  /**
   * Handle user disconnect
   */
  private async handleDisconnect(socket: AuthenticatedSocket, userId: number): Promise<void> {
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
        // Update lastSeen before broadcasting offline status
        await userService.updateLastSeen(userId);
        this.broadcastUserStatus(userId, 'offline');
      }
    }
  }

  /**
   * Handle user connected - mark pending messages as delivered (BATCHED)
   * Batches delivery updates by conversation instead of individual events
   */
  private async handleUserConnected(userId: number): Promise<void> {
    try {
      // Get all undelivered messages for this user
      const undeliveredMessages = await messageService.getUndeliveredMessages(userId);

      if (undeliveredMessages.length === 0) {
        return;
      }

      // Mark all as delivered in batch
      const messageIds = undeliveredMessages.map((m) => m.id);
      await messageService.markAsDelivered(messageIds, userId);

      // Group by conversation and create unified events
      const conversationGroups = undeliveredMessages.reduce((acc, msg) => {
        if (!acc[msg.conversationId]) {
          acc[msg.conversationId] = [];
        }
        acc[msg.conversationId].push(msg.id);
        return acc;
      }, {} as Record<number, number[]>);

      // Send unified event per conversation
      for (const [convIdStr, msgIds] of Object.entries(conversationGroups)) {
        const conversationId = Number(convIdStr);
        
        try {
          const conversation = await conversationService.getConversation(conversationId, userId);
          const participants = conversation.participants || [];
          const participantIds = participants.map(p => p.id).filter(Boolean) as number[];

          // Get unread counts once per conversation
          const unreadCounts = await messageService.getUnreadCountsForConversation(conversationId, participantIds);

          const readAt = new Date().toISOString();
          const unifiedEvent: UnifiedStatusUpdateEvent = {
            conversationId,
            updates: msgIds.map(messageId => ({
              messageId,
              userId,
              status: ReadStatus.DELIVERED,
              readAt,
            })),
            conversationUpdates: participantIds.map(id => ({
              userId: id,
              unreadCount: unreadCounts.get(id) || 0,
            })),
          };

          this.io.to(`conversation:${conversationId}`).emit('status:unified', unifiedEvent);
        } catch (error) {
          console.error(`Failed to process delivery for conversation ${conversationId}:`, error);
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
   * Broadcast user online/offline status - OPTIMIZED
   * Only sends to users in shared conversations with this user
   */
  private async broadcastUserStatus(userId: number, status: 'online' | 'offline'): Promise<void> {
    try {
      // Update user status in database
      await userService.updateUserStatus(userId, status);

      // Get current user data to include lastSeen
      const user = await userService.getUserById(userId);
      const lastSeen = user?.lastSeen || new Date();

      const payload: SocketUserStatusPayload = {
        userId,
        status,
        lastSeen: lastSeen.toISOString(),
      };

      // Get all conversations for this user to find who cares about their status
      const userConversations = await conversationService.getConversations(userId);
      const allConversationIds = userConversations.map(c => c.id);

      // Only broadcast to conversations where this user is a participant
      for (const conversationId of allConversationIds) {
        this.io.to(`conversation:${conversationId}`).emit('user:status', payload);
      }
    } catch (error) {
      console.error('[SocketManager] Failed to broadcast user status:', error);
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
   * Broadcast unified message event to conversation
   * Called by REST API after message is created
   */
  async broadcastUnifiedMessage(conversationId: number, messageId: number, senderId: number): Promise<void> {
    try {
      // Get conversation with participants
      const conversation = await conversationService.getConversation(conversationId, senderId);
      const participants = conversation.participants || [];
      const participantIds = participants.map(p => p.id).filter(Boolean) as number[];

      // Mark messages as delivered/read for online users based on their state
      const activeViewers = this.activeConversationViewers.get(conversationId);
      const messagesToMarkDelivered: number[] = [];
      const messagesToMarkRead: number[] = [];

      for (const participant of participants) {
        if (participant.id && participant.id !== senderId) {
          const isOnline = this.userSessions.has(participant.id);
          const isActiveViewer = activeViewers?.has(participant.id);
          
          if (isActiveViewer) {
            messagesToMarkRead.push(participant.id);
          } else if (isOnline) {
            messagesToMarkDelivered.push(participant.id);
          }
        }
      }

      // Batch mark as read and delivered
      if (messagesToMarkRead.length > 0) {
        for (const recipientId of messagesToMarkRead) {
          await messageService.markAsRead([messageId], recipientId);
        }
      }
      if (messagesToMarkDelivered.length > 0) {
        for (const recipientId of messagesToMarkDelivered) {
          await messageService.markAsDelivered([messageId], recipientId);
        }
      }

      // Reload message with final state
      const reloadedMessage = await messageService.getMessageWithRelations(messageId);
      const messageWithReads = messageToDTO(reloadedMessage);

      // Get unread counts for all participants (SINGLE QUERY instead of N+1)
      const unreadCounts = await messageService.getUnreadCountsForConversation(conversationId, participantIds);

      // Create unified event with message + per-recipient unread counts
      const unifiedEvent: UnifiedMessageEvent = {
        conversationId,
        message: messageWithReads,
        conversationUpdates: participantIds.map(id => ({
          userId: id,
          unreadCount: unreadCounts.get(id) || 0,
        })),
      };

      // Send single consolidated event to entire conversation
      this.io.to(`conversation:${conversationId}`).emit('message:unified', unifiedEvent);
    } catch (error) {
      console.error('[SocketManager] Failed to broadcast unified message:', error);
      throw error;
    }
  }

  /**
   * Broadcast unified message deletion event to conversation
   * Called by REST API after message is deleted
   */
  async broadcastUnifiedMessageDeletion(conversationId: number, messageId: number, deleterId: number): Promise<void> {
    try {
      // Get conversation with participants
      const conversation = await conversationService.getConversation(conversationId, deleterId);
      const participants = conversation.participants || [];
      const participantIds = participants.map(p => p.id).filter(Boolean) as number[];

      // Get unread counts for all participants
      const unreadCounts = await messageService.getUnreadCountsForConversation(conversationId, participantIds);

      // Create unified deletion event
      const unifiedEvent: UnifiedMessageDeletionEvent = {
        conversationId,
        deletedMessageIds: [messageId],
        conversationUpdates: participantIds.map(id => ({
          userId: id,
          unreadCount: unreadCounts.get(id) || 0,
        })),
      };

      // Send single consolidated event to entire conversation
      this.io.to(`conversation:${conversationId}`).emit('message:deleted', unifiedEvent);
    } catch (error) {
      console.error('[SocketManager] Failed to broadcast unified message deletion:', error);
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
