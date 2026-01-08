import { apiClient } from './client';
import { User, AuthResponse } from '@/models';

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    if (response.token) {
      apiClient.setToken(response.token);
    }
    return response;
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    if (response.token) {
      apiClient.setToken(response.token);
    }
    return response;
  }

  /**
   * Get user profile
   */
  async getProfile(): Promise<User> {
    return apiClient.get<User>('/auth/profile');
  }

  /**
   * Update user profile
   */
  async updateProfile(data: {
    name?: string;
    avatarUrl?: string;
    status?: string;
  }): Promise<User> {
    return apiClient.put<User>('/auth/profile', data);
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    apiClient.clearToken();
  }
}

export const authService = new AuthService();
