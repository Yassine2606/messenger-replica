import { Message, ReadStatus } from './message';
import { Conversation } from './conversation';

/**
 * Unified Socket Event Payloads
 * These consolidated events prevent race conditions and reduce event storm
 */

/**
 * Unified message event - sent when a new message is created
 * Contains message + per-recipient unread counts
 */
export interface UnifiedMessageEvent {
  conversationId: number;
  message: Message;
  conversationUpdates: Array<{
    userId: number;
    unreadCount: number;
  }>;
}

/**
 * Unified status update event - sent when message status changes (read/delivered)
 * Batches multiple status updates into one event with updated unread counts
 */
export interface UnifiedStatusUpdateEvent {
  conversationId: number;
  updates: Array<{
    messageId: number;
    userId: number;
    status: ReadStatus;
    readAt?: string;
  }>;
  conversationUpdates: Array<{
    userId: number;
    unreadCount: number;
  }>;
}

/**
 * Presence events - user joined/left conversation
 */
export interface SocketPresencePayload {
  conversationId: number;
  userId: number;
  event: 'joined' | 'left';
}

/**
 * User status event - online/offline status
 */
export interface SocketUserStatusPayload {
  userId: number;
  status: 'online' | 'offline';
  lastSeen?: string;
}

/**
 * Typing indicator event
 */
export interface SocketTypingPayload {
  conversationId: number;
  userId: number;
  isTyping: boolean;
}

/**
 * Error event from server
 */
export interface SocketErrorPayload {
  event: string;
  message: string;
}

/**
 * Legacy/deprecated - kept for backwards compatibility during transition
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
