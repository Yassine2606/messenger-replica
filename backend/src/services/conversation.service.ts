import { Conversation, Message, MessageRead, User, ConversationParticipant } from '../models';
import { AppError } from '../middleware';
import { ConversationDTO, messageToDTO, PaginatedResponse, PaginationMetadata } from '../types';
import { ReadStatus } from '../models/MessageRead';
import { sequelize } from '../config/database';
import { Op } from 'sequelize';

export class ConversationService {
  /**
   * Get all conversations for a user with cursor-based pagination, ordered by most recent
   */
  async getConversations(
    userId: number,
    options: {
      limit?: number;
      before?: string;
      after?: string;
    } = {}
  ): Promise<PaginatedResponse<ConversationDTO>> {
    const limit = Math.min(options.limit || 20, 50);

    // Get conversation IDs where user is participant
    const participantRecords = await ConversationParticipant.findAll({
      where: { userId },
      attributes: ['conversationId'],
    });

    const conversationIds = participantRecords.map((p) => p.conversationId);
    if (conversationIds.length === 0) {
      return {
        data: [],
        pagination: {
          hasNext: false,
          hasPrevious: false,
        },
      };
    }

    const where: any = { id: { [Op.in]: conversationIds } };

    // Parse cursor for pagination
    if (options.before) {
      const [updatedAt, id] = options.before.split('_').map(decodeURIComponent);
      where[Op.or] = [
        { updatedAt: { [Op.lt]: new Date(updatedAt) } },
        {
          [Op.and]: [{ updatedAt: new Date(updatedAt) }, { id: { [Op.lt]: parseInt(id) } }],
        },
      ];
    } else if (options.after) {
      const [updatedAt, id] = options.after.split('_').map(decodeURIComponent);
      where[Op.or] = [
        { updatedAt: { [Op.gt]: new Date(updatedAt) } },
        {
          [Op.and]: [{ updatedAt: new Date(updatedAt) }, { id: { [Op.gt]: parseInt(id) } }],
        },
      ];
    }

    // Fetch one extra conversation to determine if there are more
    const conversations = await Conversation.findAll({
      where,
      include: [
        {
          model: User,
          as: 'participants',
          attributes: ['id', 'name', 'avatarUrl', 'status', 'lastSeen'],
          through: { attributes: [] },
        },
        {
          model: Message,
          as: 'messages',
          limit: 1,
          order: [['createdAt', 'DESC']],
          separate: true,
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'name', 'avatarUrl'],
            },
            {
              model: MessageRead,
              as: 'reads',
              attributes: [
                'id',
                'messageId',
                'userId',
                'status',
                'readAt',
                'createdAt',
                'updatedAt',
              ],
            },
          ],
        },
      ],
      order: [
        ['updatedAt', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: limit + 1, // Fetch one extra to check for more
    });

    // Check if there are more conversations
    const hasMore = conversations.length > limit;
    const actualConversations = hasMore ? conversations.slice(0, limit) : conversations;

    // Determine pagination metadata
    let hasNext = false;
    let hasPrevious = false;
    let nextCursor: string | undefined;
    let previousCursor: string | undefined;

    if (options.before) {
      // We're paginating backward (older conversations)
      hasPrevious = hasMore;
      hasNext = true; // Since we have a 'before' cursor, there are newer conversations
      if (hasPrevious) {
        const firstConv = actualConversations[0];
        previousCursor = `${encodeURIComponent(firstConv.updatedAt.toISOString())}_${firstConv.id}`;
      }
      nextCursor = options.before;
    } else if (options.after) {
      // We're paginating forward (newer conversations)
      hasNext = hasMore;
      hasPrevious = true; // Since we have an 'after' cursor, there are older conversations
      if (hasNext) {
        const lastConv = actualConversations[actualConversations.length - 1];
        nextCursor = `${encodeURIComponent(lastConv.updatedAt.toISOString())}_${lastConv.id}`;
      }
      previousCursor = options.after;
    } else {
      // Initial load - no cursor
      hasNext = hasMore;
      if (hasNext) {
        const lastConv = actualConversations[actualConversations.length - 1];
        nextCursor = `${encodeURIComponent(lastConv.updatedAt.toISOString())}_${lastConv.id}`;
      }
    }

    const pagination: PaginationMetadata = {
      hasNext,
      hasPrevious,
      nextCursor,
      previousCursor,
    };

    const data = await Promise.all(
      actualConversations.map((conv) => this.conversationToDTO(conv, userId))
    );

    return {
      data,
      pagination,
    };
  }

  /**
   * Get single conversation by ID
   */
  async getConversation(conversationId: number, userId: number): Promise<ConversationDTO> {
    const conversation = await Conversation.findByPk(conversationId, {
      include: [
        {
          model: User,
          as: 'participants',
          attributes: ['id', 'name', 'avatarUrl', 'status', 'lastSeen'],
          through: { attributes: [] },
        },
        {
          model: Message,
          as: 'messages',
          limit: 1,
          order: [['createdAt', 'DESC']],
          separate: true,
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'name', 'avatarUrl'],
            },
            {
              model: MessageRead,
              as: 'reads',
              attributes: [
                'id',
                'messageId',
                'userId',
                'status',
                'readAt',
                'createdAt',
                'updatedAt',
              ],
            },
          ],
        },
      ],
    });

    if (!conversation) {
      throw new AppError(404, 'Conversation not found');
    }

    // Verify user is participant
    const isParticipant = (conversation as any).participants?.some((p: User) => p.id === userId);
    if (!isParticipant) {
      throw new AppError(403, 'Access denied');
    }

    return await this.conversationToDTO(conversation, userId);
  }

  /**
   * Create or get 1:1 conversation with another user
   */
  async createOrGetConversation(userId: number, otherUserId: number): Promise<ConversationDTO> {
    if (userId === otherUserId) {
      throw new AppError(400, 'Cannot create conversation with yourself');
    }

    // Check if other user exists
    const otherUser = await User.findByPk(otherUserId);
    if (!otherUser) {
      console.error('[ConversationService] User not found:', otherUserId);
      throw new AppError(404, `User with ID ${otherUserId} not found`);
    }

    // Find existing 1:1 conversation
    const existingConversation = await this.findOne1To1Conversation(userId, otherUserId);
    if (existingConversation) {
      return this.getConversation(existingConversation.id, userId);
    }

    // Create new conversation with transaction
    const conversation = await sequelize.transaction(async (transaction) => {
      // Double-check for existing conversation within transaction
      const existingCheck = await this.findOne1To1Conversation(userId, otherUserId);
      if (existingCheck) {
        return existingCheck;
      }

      const newConv = await Conversation.create({}, { transaction });
      await ConversationParticipant.bulkCreate(
        [
          { conversationId: newConv.id, userId },
          { conversationId: newConv.id, userId: otherUserId },
        ],
        { ignoreDuplicates: true, transaction }
      );

      return newConv;
    });

    // Fetch the full conversation after transaction
    return this.getConversation(conversation.id, userId);
  }

  /**
   * Update conversation's lastMessageId (called after message sent)
   */
  async updateLastMessage(conversationId: number, messageId: number): Promise<void> {
    await Conversation.update({ lastMessageId: messageId }, { where: { id: conversationId } });
  }

  /**
   * Private helper: Find existing 1:1 conversation
   */
  private async findOne1To1Conversation(
    userId: number,
    otherUserId: number
  ): Promise<Conversation | null> {
    const conversations = await Conversation.findAll({
      include: [
        {
          model: User,
          as: 'participants',
          attributes: ['id'],
          through: { attributes: [] },
          where: { id: { [Op.in]: [userId, otherUserId] } },
        },
      ],
    });

    for (const conv of conversations) {
      const participants = (conv as any).participants as User[];
      if (
        participants.length === 2 &&
        participants.some((p) => p.id === userId) &&
        participants.some((p) => p.id === otherUserId)
      ) {
        return conv;
      }
    }

    return null;
  }

  /**
   * Convert Conversation model to DTO with unread count
   */
  private async conversationToDTO(
    conversation: Conversation,
    userId: number
  ): Promise<ConversationDTO> {
    const participants = ((conversation as any).participants || []) as User[];
    const messages = ((conversation as any).messages || []) as Message[];
    const lastMessage = messages[0] || null;

    // Count unread messages for this user
    const unreadCount = await this.countUnreadMessages(conversation.id, userId);

    return {
      id: conversation.id,
      participants: participants.map((p) => ({
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        status: p.status,
        lastSeen: p.lastSeen ? p.lastSeen.toISOString() : undefined,
      })),
      lastMessage: lastMessage ? messageToDTO(lastMessage) : undefined,
      lastMessageAt: lastMessage?.createdAt.toISOString(),
      unreadCount,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  /**
   * Count unread messages for a user in conversation
   */
  private async countUnreadMessages(conversationId: number, userId: number): Promise<number> {
    const unreadCount = await MessageRead.count({
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
          attributes: [],
        },
      ],
    });

    return unreadCount;
  }
}

export const conversationService = new ConversationService();
