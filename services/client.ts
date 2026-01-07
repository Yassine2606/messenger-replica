import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

// Config for retry logic
interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
  retryableErrorCodes: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504], // Timeout, rate limit, server errors
  retryableErrorCodes: ['ECONNABORTED', 'ECONNRESET', 'ENOTFOUND', 'ENETUNREACH', 'ETIMEDOUT'],
};

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private initialized = false;
  private retryConfig: RetryConfig;

  constructor() {
    this.retryConfig = DEFAULT_RETRY_CONFIG;
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
   * Initialize client - load token from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      if (storedToken) {
        this.token = storedToken;
        this.client.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      }
      this.initialized = true;
    } catch (error) {
      console.error('[ApiClient] Error loading auth token:', error);
      this.initialized = true;
    }
  }

  /**
   * Setup request/response interceptors with retry logic
   */
  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        if (this.token && !config.headers['Authorization']) {
          config.headers['Authorization'] = `Bearer ${this.token}`;
        }
        // Initialize retry count
        (config as any).__retryCount = (config as any).__retryCount || 0;
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config as any;
        if (!config) return Promise.reject(error);

        // Check if we should retry
        const shouldRetry =
          config.__retryCount < this.retryConfig.maxRetries &&
          (this.isRetryableStatus(error.response?.status) ||
            this.isRetryableError(error.code));

        if (shouldRetry) {
          config.__retryCount += 1;
          const delay = this.calculateBackoffDelay(
            config.__retryCount,
            this.retryConfig.retryDelay,
            this.retryConfig.backoffMultiplier
          );

          console.warn(
            `[ApiClient] Retrying ${config.method?.toUpperCase()} ${config.url} ` +
            `(attempt ${config.__retryCount}/${this.retryConfig.maxRetries}) ` +
            `after ${delay}ms`,
            `Status: ${error.response?.status || error.code}`
          );

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.client(config);
        }

        // Log error if not retrying
        console.error(
          '[ApiClient] Request failed:',
          error.config?.method?.toUpperCase(),
          error.config?.url,
          'Status:',
          error.response?.status || error.code
        );

        // Handle 401 - clear token
        if (error.response?.status === 401 && this.token) {
          await this.clearToken();
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if status code is retryable
   */
  private isRetryableStatus(status?: number): boolean {
    return !!status && this.retryConfig.retryableStatusCodes.includes(status);
  }

  /**
   * Check if error code is retryable
   */
  private isRetryableError(code?: string): boolean {
    return !!code && this.retryConfig.retryableErrorCodes.includes(code);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(
    retryCount: number,
    baseDelay: number,
    multiplier: number
  ): number {
    const delay = baseDelay * Math.pow(multiplier, retryCount - 1);
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * delay * 0.1;
    return Math.min(delay + jitter, 60000); // Cap at 60 seconds
  }

  /**
   * Set authentication token
   */
  async setToken(token: string): Promise<void> {
    this.token = token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    try {
      await AsyncStorage.setItem('auth_token', token);
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
      await AsyncStorage.removeItem('auth_token');
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
   * Ensure initialized before making request
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Generic GET request
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    await this.ensureInitialized();
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  /**
   * Generic POST request
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    await this.ensureInitialized();
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  /**
   * Generic PUT request
   */
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    await this.ensureInitialized();
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  /**
   * Generic DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    await this.ensureInitialized();
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }

  /**
   * Generic PATCH request
   */
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    await this.ensureInitialized();
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
