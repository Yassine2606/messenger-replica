import { User } from './user';

/**
 * Message Types
 */
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
}

/**
 * Read Status
 */
export enum ReadStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

/**
 * Message Read Model
 */
export interface MessageRead {
  id: number;
  messageId: number;
  userId: number;
  status: ReadStatus;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Message Model
 */
export interface Message {
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
  replyTo?: Partial<Message>;
  isDeleted: boolean;
  reads?: MessageRead[];
  createdAt: string;
  updatedAt: string;
}
