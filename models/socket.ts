import { Message, ReadStatus } from './message';
import { Conversation } from './conversation';

/**
 * Socket Event Payloads
 */
export interface SocketMessagePayload {
  message: Message;
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
  conversation: Conversation;
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

export interface SocketErrorPayload {
  event: string;
  message: string;
}
