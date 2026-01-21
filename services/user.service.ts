import { apiClient } from './client';
import { User, PaginatedResponse } from '@/models';

export interface SearchUsersOptions {
  limit?: number;
  before?: number;
  after?: number;
}

export interface GetAllUsersOptions {
  limit?: number;
  before?: number;
  after?: number;
}

export class UserService {
  /**
   * Search users by name or email with pagination
   */
  async searchUsers(
    query: string,
    options: SearchUsersOptions = {}
  ): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams();
    params.append('q', query);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.before) params.append('before', options.before.toString());
    if (options.after) params.append('after', options.after.toString());

    const queryString = params.toString();
    const url = `/users/search?${queryString}`;

    return apiClient.get<PaginatedResponse<User>>(url);
  }

  /**
   * Get user by ID
   */
  async getUser(userId: number): Promise<User> {
    return apiClient.get<User>(`/users/${userId}`);
  }

  /**
   * Get all users with pagination
   */
  async getAllUsers(options: GetAllUsersOptions = {}): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.before) params.append('before', options.before.toString());
    if (options.after) params.append('after', options.after.toString());

    const queryString = params.toString();
    const url = `/users${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<PaginatedResponse<User>>(url);
  }
}

export const userService = new UserService();
