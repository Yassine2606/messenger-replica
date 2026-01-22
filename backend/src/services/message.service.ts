import { Message, MessageRead, User, Conversation } from '../models';
import { AppError } from '../middleware';
import { MessageDTO, messageToDTO, PaginatedResponse, PaginationMetadata } from '../types';
import { ReadStatus } from '../models/MessageRead';
import { MessageType } from '../models/Message';
import { Op, Transaction } from 'sequelize';
import { sequelize } from '../config/database';

export interface SendMessageData {
  conversationId: number;
  senderId: number;
  type: string;
  content?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaDuration?: number;
  replyToId?: number;
}

export class MessageService {
  /**
   * Send a message
   */
  async sendMessage(data: SendMessageData): Promise<MessageDTO> {
    return await sequelize.transaction(async (transaction: Transaction) => {
      // Verify conversation exists
      const conversation = await Conversation.findByPk(data.conversationId, { transaction });
      if (!conversation) {
        throw new AppError(404, 'Conversation not found');
      }

      // Verify sender is conversation participant
      const participant = await (conversation as any).getParticipants?.({
        where: { id: data.senderId },
        transaction,
      });
      if (!participant || participant.length === 0) {
        throw new AppError(403, 'Not a conversation participant');
      }

      // Create message
      const message = await Message.create(
        {
          conversationId: data.conversationId,
          senderId: data.senderId,
          type: data.type as MessageType,
          content: data.content,
          mediaUrl: data.mediaUrl,
          mediaMimeType: data.mediaMimeType,
          mediaDuration: data.mediaDuration,
          replyToId: data.replyToId,
          isDeleted: false,
        },
        { transaction }
      );

      // Create message read entries for all participants
      const participants = await (conversation as any).getParticipants?.({ transaction });
      const otherParticipants = (participants || []).filter((p: User) => p.id !== data.senderId);

      if (otherParticipants.length > 0) {
        // Use ignoreDuplicates to prevent constraint violations if reads already exist
        await MessageRead.bulkCreate(
          otherParticipants.map((p: User) => ({
            messageId: message.id,
            userId: p.id,
            status: ReadStatus.SENT, // Will be updated to DELIVERED when recipient connects
          })),
          { transaction, ignoreDuplicates: true }
        );
      }

      // Update conversation's lastMessageId
      await conversation.update({ lastMessageId: message.id }, { transaction });

      // Fetch complete message with relations
      const fullMessage = await this.getMessageWithRelations(message.id, transaction);
      return messageToDTO(fullMessage);
    });
  }

  /**
   * Get messages in a conversation with cursor-based pagination
   * 
   * For inverted FlatList (newest first):
   * - Initial load: Fetch newest messages (no cursor) → returns in DESC order
   * - Pagination: Use 'before' cursor to fetch older messages (ID < cursor) → returns in DESC order
   * 
   * Cursor semantics:
   * - before: Get messages with ID < cursor (older messages)
   * - After initial load, client uses before cursor for all pagination
   */
  async getMessages(
    conversationId: number,
    _userId: number,
    options: {
      limit?: number;
      before?: number;
      after?: number;
    } = {}
  ): Promise<PaginatedResponse<MessageDTO>> {
    const limit = Math.min(options.limit || 30, 100);
    const where: any = { conversationId, isDeleted: false };

    // Cursor-based pagination: only support 'before' for backward pagination (load older messages)
    if (options.before) {
      where.id = { [Op.lt]: options.before };
    }

    // Fetch one extra message to determine if there are more
    const messages = await Message.findAll({
      where,
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'avatarUrl'],
        },
        {
          model: Message,
          as: 'replyTo',
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: MessageRead,
          as: 'reads',
          attributes: ['id', 'userId', 'status', 'readAt'],
        },
      ],
      // Return in DESC order (newest first) for inverted FlatList
      order: [['id', 'DESC']],
      limit: limit + 1, // Fetch one extra to check for more
      subQuery: false,
    });

    // Check if there are more messages
    const hasMore = messages.length > limit;
    const actualMessages = hasMore ? messages.slice(0, limit) : messages;

    // Determine pagination metadata
    let hasPrevious = false; // previousPage = older messages we can load
    let previousCursor: string | undefined;

    // Check if there are older messages (hasPrevious means we can load more older messages)
    hasPrevious = hasMore;
    if (hasPrevious) {
      // The cursor for loading older messages is the ID of the oldest (last) message in current page
      previousCursor = actualMessages[actualMessages.length - 1]?.id.toString();
    }

    const pagination: PaginationMetadata = {
      hasNext: false,
      hasPrevious,
      nextCursor: undefined,
      previousCursor,
    };

    return {
      data: actualMessages.map((m) => messageToDTO(m)),
      pagination,
    };
  }

  /**
   * Mark message as read (batch operation)
   */
  async markAsRead(messageIds: number[], userId: number): Promise<void> {
    if (messageIds.length === 0) return;

    // Use transaction with row-level locking to prevent race conditions
    await sequelize.transaction(async (transaction: Transaction) => {
      const existingReads = await MessageRead.findAll({
        where: {
          messageId: { [Op.in]: messageIds },
          userId,
        },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      const updatePromises = [];
      for (const read of existingReads) {
        if (read.status !== ReadStatus.READ) {
          read.status = ReadStatus.READ;
          read.readAt = new Date();
          updatePromises.push(read.save({ transaction }));
        }
      }

      await Promise.all(updatePromises);
    });
  }

  /**
   * Mark messages as delivered (batch operation)
   */
  async markAsDelivered(messageIds: number[], userId: number): Promise<void> {
    if (messageIds.length === 0) return;

    // Use transaction with row-level locking to prevent race conditions
    await sequelize.transaction(async (transaction: Transaction) => {
      const existingReads = await MessageRead.findAll({
        where: {
          messageId: { [Op.in]: messageIds },
          userId,
          status: ReadStatus.SENT,
        },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      const updatePromises = existingReads.map((read) => {
        read.status = ReadStatus.DELIVERED;
        return read.save({ transaction });
      });

      await Promise.all(updatePromises);
    });
  }

  /**
   * Get all undelivered messages for a user
   */
  async getUndeliveredMessages(userId: number): Promise<Message[]> {
    const undeliveredReads = await MessageRead.findAll({
      where: {
        userId,
        status: ReadStatus.SENT,
      },
      include: [
        {
          model: Message,
          as: 'message',
          where: { isDeleted: false },
          attributes: ['id', 'conversationId', 'senderId', 'createdAt'],
        },
      ],
    });

    return undeliveredReads.map((read) => (read as any).message as Message);
  }

  /**
   * Mark all messages in conversation as read
   * Returns array of message IDs that were marked as read
   */
  async markConversationAsRead(conversationId: number, userId: number): Promise<number[]> {
    // Find all unread messages in the conversation
    const unreadReads = await MessageRead.findAll({
      where: {
        userId,
        status: {
          [Op.in]: [ReadStatus.SENT, ReadStatus.DELIVERED],
        },
      },
      include: [
        {
          model: Message,
          as: 'message',
          where: {
            conversationId,
            isDeleted: false,
          },
          attributes: ['id'],
        },
      ],
    });

    if (unreadReads.length === 0) {
      return [];
    }

    const messageIds = unreadReads.map((read) => read.messageId);
    await this.markAsRead(messageIds, userId);
    return messageIds;
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: number, userId: number): Promise<Message> {
    const message = await Message.findByPk(messageId);
    if (!message) {
      throw new AppError(404, 'Message not found');
    }

    if (message.senderId !== userId) {
      throw new AppError(403, 'Can only delete own messages');
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();
    return message;
  }

  /**
   * Search messages in conversation
   */
  async searchMessages(
    conversationId: number,
    _userId: number,
    query: string,
    limit = 20
  ): Promise<MessageDTO[]> {
    const messages = await Message.findAll({
      where: {
        conversationId,
        isDeleted: false,
        content: { [Op.iLike]: `%${query}%` },
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'avatarUrl'],
        },
        {
          model: MessageRead,
          as: 'reads',
          attributes: ['id', 'userId', 'status', 'readAt'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
    });

    return messages.map((m) => messageToDTO(m));
  }

  /**
   * Get unread message count for each user in a conversation (batch operation)
   * Returns map of userId -> unreadCount
   */
  async getUnreadCountsForConversation(
    conversationId: number,
    userIds: number[]
  ): Promise<Map<number, number>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const counts = await MessageRead.findAll({
      where: {
        userId: { [Op.in]: userIds },
        status: {
          [Op.in]: [ReadStatus.SENT, ReadStatus.DELIVERED],
        },
      },
      include: [
        {
          model: Message,
          as: 'message',
          where: {
            conversationId,
            isDeleted: false,
          },
          attributes: [],
        },
      ],
      attributes: ['userId'],
      raw: true,
    });

    const result = new Map<number, number>();
    userIds.forEach((id) => result.set(id, 0));

    for (const record of counts) {
      const userId = (record as any).userId;
      result.set(userId, (result.get(userId) || 0) + 1);
    }

    return result;
  }

  /**
   * Private helper: Get message with all relations
   */
  /**
   * Get message with all relations loaded
   */
  async getMessageWithRelations(messageId: number, transaction?: Transaction): Promise<Message> {
    const message = await Message.findByPk(messageId, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'avatarUrl'],
        },
        {
          model: Message,
          as: 'replyTo',
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: MessageRead,
          as: 'reads',
          attributes: ['id', 'messageId', 'userId', 'status', 'readAt', 'createdAt', 'updatedAt'],
        },
      ],
      transaction,
    });

    if (!message) {
      throw new AppError(404, 'Message not found');
    }

    return message;
  }

  /**
   * Bulk upsert message reads - single query for multiple rows
   */
  async bulkUpsertMessageReads(
    rows: Array<{ messageId: number; userId: number; status: ReadStatus; readAt: Date }>
  ): Promise<void> {
    if (!rows.length) return;

    await MessageRead.bulkCreate(rows as any, {
      updateOnDuplicate: ['status', 'readAt'],
      ignoreDuplicates: false,
    });
  }
}

export const messageService = new MessageService();
