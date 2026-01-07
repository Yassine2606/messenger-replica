import { Message, MessageRead, User, Conversation } from '../models';
import { AppError } from '../middleware';
import { MessageDTO, messageToDTO } from '../types';
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
   * Get messages in a conversation with pagination
   */
  async getMessages(
    conversationId: number,
    _userId: number,
    options: {
      limit?: number;
      before?: number;
      after?: number;
    } = {}
  ): Promise<MessageDTO[]> {
    const limit = Math.min(options.limit || 30, 100);
    const where: any = { conversationId, isDeleted: false };

    // Use cursor-based pagination with ID
    // before: get messages older than this ID (smaller IDs)
    // after: get messages newer than this ID (larger IDs)
    if (options.before) {
      // Get messages with ID less than 'before' (older messages)
      where.id = { [Op.lt]: options.before };
    } else if (options.after) {
      // Get messages with ID greater than 'after' (newer messages)
      where.id = { [Op.gt]: options.after };
    } else {
      // On initial load with no pagination param, get the newest messages
      // by limiting and ordering descending, then we'll reverse later
      // This ensures we load the most recent messages first
    }

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
      // When before/after are specified, order ASC (chronological)
      // When neither specified (initial load), order DESC to get newest first
      order: options.before || options.after ? [['id', 'ASC']] : [['id', 'DESC']],
      limit,
      subQuery: false, // Important: avoid Sequelize subquery issues
    });

    // Return in appropriate order
    // For before/after pagination: chronological order (oldest to newest)
    // For initial load: reverse DESC order to get chronological (oldest to newest)
    if (!options.before && !options.after) {
      messages.reverse();
    }
    
    return messages.map((m) => messageToDTO(m));
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
  async searchMessages(conversationId: number, _userId: number, query: string, limit = 20): Promise<MessageDTO[]> {
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
}

export const messageService = new MessageService();