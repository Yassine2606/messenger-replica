import { apiClient } from './client';
import { User } from '@/models';

export class UserService {
  /**
   * Search users by name or email
   */
  async searchUsers(query: string): Promise<User[]> {
    return apiClient.get<User[]>(`/users/search?q=${encodeURIComponent(query)}`);
  }

  /**
   * Get user by ID
   */
  async getUser(userId: number): Promise<User> {
    return apiClient.get<User>(`/users/${userId}`);
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<User[]> {
    return apiClient.get<User[]>('/users');
  }
}

export const userService = new UserService();
