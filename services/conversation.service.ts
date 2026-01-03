import { apiClient } from './client';
import { Conversation } from '@/models';

export class ConversationService {
  /**
   * Get all conversations for current user
   */
  async getConversations(): Promise<Conversation[]> {
    return apiClient.get<Conversation[]>('/conversations');
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
}

export const conversationService = new ConversationService();
