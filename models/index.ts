export * from './auth';
export * from './user';
export * from './message';
export * from './conversation';
export * from './socket';

/**
 * Pagination types
 */
export interface CursorPaginationOptions {
  limit?: number;
  cursor?: string;
  direction?: 'forward' | 'backward';
}

export interface PaginationMetadata {
  hasNext: boolean;
  hasPrevious: boolean;
  nextCursor?: string;
  previousCursor?: string;
  total?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
}

export interface GetConversationsOptions {
  limit?: number;
  before?: string;
  after?: string;
}

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
