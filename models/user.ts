/**
 * User Model
 */
export interface User {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string;
  status?: string;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}
