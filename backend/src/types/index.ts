import { Message, MessageType } from '../models/Message';
import { ReadStatus } from '../models/MessageRead';
import { User } from '../models/User';

/**
 * Message DTOs - Sent to frontend
 */
export interface MessageDTO {
  id: number;
  conversationId: number;
  senderId: number;
  sender?: Partial<User>;
  type: MessageType;
  content?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaDuration?: number;
  replyToId?: number;
  replyTo?: Partial<MessageDTO>;
  isDeleted: boolean;
  reads?: MessageReadDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface MessageReadDTO {
  id: number;
  messageId: number;
  userId: number;
  status: ReadStatus;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Conversation DTOs - Sent to frontend
 */
export interface ConversationDTO {
  id: number;
  participants?: Array<{
    id: number;
    name: string;
    avatarUrl?: string;
    status?: string;
    lastSeen?: string;
  }>;
  lastMessage?: Partial<MessageDTO>;
  lastMessageAt?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * User DTOs - Sent to frontend
 */
export interface UserDTO {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string;
  status?: string;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Socket Event Payloads
 */
export interface SocketMessagePayload {
  message: MessageDTO;
  conversationId: number;
}

export interface SocketMessageStatusPayload {
  messageId: number;
  conversationId: number;
  status: ReadStatus;
  userId: number;
  readAt?: string;
}

export interface SocketConversationUpdatePayload {
  conversation: ConversationDTO;
  userId: number;
}

export interface SocketUserStatusPayload {
  userId: number;
  status: 'online' | 'offline';
  lastSeen?: string;
}

export interface SocketTypingPayload {
  conversationId: number;
  userId: number;
  isTyping: boolean;
}

/**
 * Helper function to convert Message to DTO
 */
export function messageToDTO(message: Message): MessageDTO {
  const sender = (message as any).sender;
  const replyTo = (message as any).replyTo;
  const reads = (message as any).reads || [];

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    sender: sender ? {
      id: sender.id,
      name: sender.name,
      avatarUrl: sender.avatarUrl,
    } : undefined,
    type: message.type,
    content: message.content,
    mediaUrl: message.mediaUrl,
    mediaMimeType: message.mediaMimeType,
    mediaDuration: message.mediaDuration,
    replyToId: message.replyToId || undefined,
    replyTo: replyTo ? messageToDTO(replyTo as unknown as Message) : undefined,
    isDeleted: message.isDeleted,
    reads: reads.map((read: any) => ({
      id: read.id,
      messageId: read.messageId,
      userId: read.userId,
      status: read.status,
      readAt: read.readAt ? read.readAt.toISOString() : undefined,
      createdAt: read.createdAt ? read.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: read.updatedAt ? read.updatedAt.toISOString() : new Date().toISOString(),
    })),
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}
