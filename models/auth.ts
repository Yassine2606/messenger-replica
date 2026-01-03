import { User } from './user';

/**
 * Auth Response Model
 */
export interface AuthResponse {
  user: User;
  token: string;
}
