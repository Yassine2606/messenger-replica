import { apiClient } from './client';
import { Message, MessageType, PaginatedResponse } from '@/models';

/**
 * CURSOR-BASED PAGINATION
 * 
 * Per the Socket.io + React Query blueprint:
 * - Use message IDs or timestamps as cursors (not page numbers)
 * - 'before': Load messages older than this ID/timestamp
 * - 'after': Load messages newer than this ID/timestamp
 * 
 * For inverted FlatList:
 * - Initial load: No cursor → get newest messages in DESC order
 * - User scrolls down (toward old messages) → use 'before' cursor
 * - Pagination offset is the ID of the last message in current list
 */
export interface SendMessageData {
  conversationId: number;
  type: MessageType;
  content?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaDuration?: number;
  waveform?: number[]; // Audio waveform for audio messages
  replyToId?: number;
}

export interface GetMessagesOptions {
  limit?: number;
  before?: number; // Load messages before this message ID (older messages)
  after?: number;  // Load messages after this message ID (newer messages)
}

export class MessageService {
  /**
   * Send a message (REST API - fallback)
   */
  async sendMessage(data: SendMessageData): Promise<Message> {
    return apiClient.post<Message>('/messages', data);
  }

  /**
   * Get messages in a conversation with CURSOR-BASED pagination
   * 
   * @param conversationId Target conversation
   * @param options Pagination options:
   *   - limit: Number of messages to fetch (default 20)
   *   - before: Fetch older messages (use last message ID)
   *   - after: Fetch newer messages (use first message ID)
   * 
   * @returns PaginatedResponse with messages + cursors for next/prev pages
   */
  async getMessages(
    conversationId: number,
    options: GetMessagesOptions = {}
  ): Promise<PaginatedResponse<Message>> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.before) params.append('before', options.before.toString());
    if (options.after) params.append('after', options.after.toString());

    const queryString = params.toString();
    const url = `/messages/conversation/${conversationId}${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<PaginatedResponse<Message>>(url);
  }

  /**
   * Mark a message as delivered
   */
  async markAsDelivered(messageId: number): Promise<void> {
    await apiClient.post(`/messages/${messageId}/delivered`);
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: number): Promise<void> {
    await apiClient.delete(`/messages/${messageId}`);
  }

  /**
   * Search messages in conversation
   */
  async searchMessages(conversationId: number, query: string, limit = 20): Promise<Message[]> {
    const params = new URLSearchParams({ q: query, limit: limit.toString() });
    return apiClient.get<Message[]>(`/messages/conversation/${conversationId}/search?${params}`);
  }
}

export const messageService = new MessageService();
