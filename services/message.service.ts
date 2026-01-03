import { apiClient } from './client';
import { Message, MessageType } from '@/models';

export interface SendMessageData {
  conversationId: number;
  type: MessageType;
  content?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaDuration?: number;
  replyToId?: number;
}

export interface GetMessagesOptions {
  limit?: number;
  before?: number;
  after?: number;
}

export class MessageService {
  /**
   * Send a message (REST API - fallback)
   */
  async sendMessage(data: SendMessageData): Promise<Message> {
    return apiClient.post<Message>('/messages', data);
  }

  /**
   * Get messages in a conversation with pagination
   */
  async getMessages(
    conversationId: number,
    options: GetMessagesOptions = {}
  ): Promise<Message[]> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.before) params.append('before', options.before.toString());
    if (options.after) params.append('after', options.after.toString());

    const queryString = params.toString();
    const url = `/messages/conversation/${conversationId}${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get<Message[]>(url);
  }

  /**
   * Mark all messages in conversation as read
   */
  async markConversationAsRead(conversationId: number): Promise<void> {
    await apiClient.post(`/messages/conversation/${conversationId}/read`);
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
