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
 * Read Status for message delivery tracking
 *
 * Flow for outgoing messages:
 * 1. SENT - Message accepted by server (optimistic: immediately shown in UI)
 * 2. DELIVERED - Recipient received the message
 * 3. READ - Recipient has read the message
 *
 * The reads array contains one entry per recipient, tracking their read status
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
  waveform?: number[]; // Audio waveform data (normalized 0-1)
  replyToId?: number;
  replyTo?: Partial<Message>;
  isDeleted: boolean;
  reads?: MessageRead[];
  createdAt: string;
  updatedAt: string;
}
