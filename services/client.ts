import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private initialized = false;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Initialize client - load token from secure storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[ApiClient] Already initialized, token:', this.token ? 'present' : 'none');
      return;
    }

    try {
      const storedToken = await SecureStore.getItemAsync('auth_token');
      console.log('[ApiClient] Loaded token from storage:', storedToken ? `${storedToken.substring(0, 20)}...` : 'none');
      if (storedToken) {
        this.token = storedToken;
        this.client.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        console.log('[ApiClient] Token set in headers');
      }
      this.initialized = true;
    } catch (error) {
      console.error('[ApiClient] Error loading auth token:', error);
      this.initialized = true;
    }
  }

  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Always set token if we have one
        if (this.token) {
          if (!config.headers) {
            config.headers = {} as any;
          }
          config.headers['Authorization'] = `Bearer ${this.token}`;
        }
        console.log('[ApiClient] Request:', config.url, 'Auth:', config.headers?.['Authorization'] ? 'present' : 'MISSING', 'Token in memory:', this.token ? 'yes' : 'no');
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Only clear token if we had one and it was rejected
        // This prevents clearing during initialization race conditions
        if (error.response?.status === 401 && this.token) {
          console.log('[ApiClient] 401 error with token present, clearing...');
          await this.clearToken();
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Set authentication token
   */
  async setToken(token: string): Promise<void> {
    this.token = token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    try {
      await SecureStore.setItemAsync('auth_token', token);
    } catch (error) {
      console.error('Error saving auth token:', error);
    }
  }

  /**
   * Get authentication token
   */
  async getAuthToken(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.token;
  }

  /**
   * Get base URL
   */
  getBaseURL(): string {
    return API_URL;
  }

  /**
   * Clear authentication token
   */
  async clearToken(): Promise<void> {
    this.token = null;
    delete this.client.defaults.headers.common['Authorization'];
    try {
      await SecureStore.deleteItemAsync('auth_token');
    } catch (error) {
      console.error('Error clearing auth token:', error);
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.token;
  }

  /**
   * Get auth token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Generic GET request
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  /**
   * Generic POST request
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  /**
   * Generic PUT request
   */
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  /**
   * Generic DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }

  /**
   * Generic PATCH request
   */
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
