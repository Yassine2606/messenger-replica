import { apiClient } from './client';
import { Conversation, PaginatedResponse } from '@/models';

export interface GetConversationsOptions {
  limit?: number;
  before?: string;
  after?: string;
}

export class ConversationService {
  /**
   * Get all conversations for current user with pagination
   */
  async getConversations(
    options: GetConversationsOptions = {}
  ): Promise<PaginatedResponse<Conversation>> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.before) params.append('before', options.before);
    if (options.after) params.append('after', options.after);

    const queryString = params.toString();
    const url = `/conversations${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<PaginatedResponse<Conversation>>(url);
  }

  /**
   * Get single conversation by ID
   */
  async getConversation(conversationId: number): Promise<Conversation> {
    return apiClient.get<Conversation>(`/conversations/${conversationId}`);
  }

  /**
   * Create or get existing 1:1 conversation
   */
  async createOrGetConversation(otherUserId: number): Promise<Conversation> {
    return apiClient.post<Conversation>('/conversations', { otherUserId });
  }

  /**
   * Leave a conversation (remove current user from it)
   */
  async leaveConversation(conversationId: number): Promise<void> {
    return apiClient.delete<void>(`/conversations/${conversationId}`);
  }
}

export const conversationService = new ConversationService();
