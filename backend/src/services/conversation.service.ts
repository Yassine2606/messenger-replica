import { Conversation, Message, MessageRead, User, ConversationParticipant } from '../models';
import { AppError } from '../middleware';
import { ConversationDTO, messageToDTO } from '../types';
import { ReadStatus } from '../models/MessageRead';

export class ConversationService {
  /**
   * Get all conversations for a user, ordered by most recent
   */
  async getConversations(userId: number): Promise<ConversationDTO[]> {
    // Get conversation IDs where user is participant
    const participantRecords = await ConversationParticipant.findAll({
      where: { userId },
      attributes: ['conversationId'],
    });

    const conversationIds = participantRecords.map((p) => p.conversationId);
    if (conversationIds.length === 0) {
      return [];
    }

    // Get conversations with proper eager loading
    const conversations = await Conversation.findAll({
      where: { id: { [require('sequelize').Op.in]: conversationIds } },
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
              attributes: ['id', 'messageId', 'userId', 'status', 'readAt', 'createdAt', 'updatedAt'],
            },
          ],
        },
      ],
      order: [['updatedAt', 'DESC']],
    });

    return Promise.all(conversations.map((conv) => this.conversationToDTO(conv, userId)));
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
              attributes: ['id', 'messageId', 'userId', 'status', 'readAt', 'createdAt', 'updatedAt'],
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
      throw new AppError(404, 'User not found');
    }

    // Find existing 1:1 conversation
    const existingConversation = await this.findOne1To1Conversation(userId, otherUserId);
    if (existingConversation) {
      return this.getConversation(existingConversation.id, userId);
    }

    // Create new conversation
    const conversation = await Conversation.create();
    await ConversationParticipant.bulkCreate(
      [
        { conversationId: conversation.id, userId },
        { conversationId: conversation.id, userId: otherUserId },
      ],
      { ignoreDuplicates: true }
    );

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
  private async findOne1To1Conversation(userId: number, otherUserId: number): Promise<Conversation | null> {
    const conversations = await Conversation.findAll({
      include: [
        {
          model: User,
          as: 'participants',
          attributes: ['id'],
          through: { attributes: [] },
          where: { id: { [require('sequelize').Op.in]: [userId, otherUserId] } },
        },
      ],
    });

    for (const conv of conversations) {
      const participants = (conv as any).participants as User[];
      if (participants.length === 2 && participants.some((p) => p.id === userId) && participants.some((p) => p.id === otherUserId)) {
        return conv;
      }
    }

    return null;
  }

  /**
   * Convert Conversation model to DTO with unread count
   */
  private async conversationToDTO(conversation: Conversation, userId: number): Promise<ConversationDTO> {
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
        status: ReadStatus.DELIVERED,
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
