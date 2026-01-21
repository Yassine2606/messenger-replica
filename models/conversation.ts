import { User } from './user';
import { Message } from './message';

/**
 * Conversation Model
 */
export interface Conversation {
  id: number;
  participants?: {
    id: number;
    name: string;
    avatarUrl?: string;
    status?: string;
    lastSeen?: string;
  }[];
  lastMessage?: Partial<Message>;
  lastMessageAt?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}
