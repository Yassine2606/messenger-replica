import { User } from '../models';
import { AppError } from '../middleware';
import { PaginatedResponse, PaginationMetadata } from '../types';
import { Op } from 'sequelize';

export class UserService {
  /**
   * Search users by name or email with cursor-based pagination
   */
  async searchUsers(
    query: string,
    currentUserId: number,
    options: {
      limit?: number;
      before?: number;
      after?: number;
    } = {}
  ): Promise<PaginatedResponse<Partial<User>>> {
    if (query.length < 2) {
      throw new AppError(400, 'Search query must be at least 2 characters');
    }

    const limit = Math.min(options.limit || 20, 50);
    const where: any = {
      id: { [Op.ne]: currentUserId }, // Exclude current user
      [Op.or]: [{ name: { [Op.iLike]: `%${query}%` } }, { email: { [Op.iLike]: `%${query}%` } }],
    };

    // Cursor-based pagination using ID
    if (options.before) {
      where.id = { [Op.lt]: options.before };
    } else if (options.after) {
      where.id = { [Op.gt]: options.after };
    }

    // Fetch one extra user to determine if there are more
    const users = await User.findAll({
      where,
      attributes: ['id', 'name', 'email', 'avatarUrl', 'status', 'lastSeen'],
      order: [['id', 'ASC']],
      limit: limit + 1, // Fetch one extra to check for more
    });

    // Check if there are more users
    const hasMore = users.length > limit;
    const actualUsers = hasMore ? users.slice(0, limit) : users;

    // Determine pagination metadata
    let hasNext = false;
    let hasPrevious = false;
    let nextCursor: string | undefined;
    let previousCursor: string | undefined;

    if (options.before) {
      // We're paginating backward (smaller IDs)
      hasPrevious = hasMore;
      hasNext = true; // Since we have a 'before' cursor, there are larger IDs
      if (hasPrevious) {
        previousCursor = actualUsers[0]?.id.toString();
      }
      nextCursor = options.before.toString();
    } else if (options.after) {
      // We're paginating forward (larger IDs)
      hasNext = hasMore;
      hasPrevious = true; // Since we have an 'after' cursor, there are smaller IDs
      if (hasNext) {
        nextCursor = actualUsers[actualUsers.length - 1]?.id.toString();
      }
      previousCursor = options.after.toString();
    } else {
      // Initial load - no cursor
      hasNext = hasMore;
      if (hasNext) {
        nextCursor = actualUsers[actualUsers.length - 1]?.id.toString();
      }
    }

    const pagination: PaginationMetadata = {
      hasNext,
      hasPrevious,
      nextCursor,
      previousCursor,
    };

    return {
      data: actualUsers.map((user) => user.toJSON()),
      pagination,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<Partial<User>> {
    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'avatarUrl', 'status', 'lastSeen', 'createdAt'],
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    return user.toJSON();
  }

  /**
   * Get all users with cursor-based pagination (for user selection)
   */
  async getAllUsers(
    currentUserId: number,
    options: {
      limit?: number;
      before?: number;
      after?: number;
    } = {}
  ): Promise<PaginatedResponse<Partial<User>>> {
    const limit = Math.min(options.limit || 50, 100);
    const where: any = {
      id: { [Op.ne]: currentUserId }, // Exclude current user
    };

    // Cursor-based pagination using ID
    if (options.before) {
      where.id = { [Op.lt]: options.before };
    } else if (options.after) {
      where.id = { [Op.gt]: options.after };
    }

    // Fetch one extra user to determine if there are more
    const users = await User.findAll({
      where,
      attributes: ['id', 'name', 'email', 'avatarUrl', 'status', 'lastSeen'],
      order: [
        ['name', 'ASC'],
        ['id', 'ASC'],
      ],
      limit: limit + 1, // Fetch one extra to check for more
    });

    // Check if there are more users
    const hasMore = users.length > limit;
    const actualUsers = hasMore ? users.slice(0, limit) : users;

    // Determine pagination metadata
    let hasNext = false;
    let hasPrevious = false;
    let nextCursor: string | undefined;
    let previousCursor: string | undefined;

    if (options.before) {
      // We're paginating backward (lexicographically earlier names)
      hasPrevious = hasMore;
      hasNext = true; // Since we have a 'before' cursor, there are later names
      if (hasPrevious) {
        previousCursor = actualUsers[0]?.id.toString();
      }
      nextCursor = options.before.toString();
    } else if (options.after) {
      // We're paginating forward (lexicographically later names)
      hasNext = hasMore;
      hasPrevious = true; // Since we have an 'after' cursor, there are earlier names
      if (hasNext) {
        nextCursor = actualUsers[actualUsers.length - 1]?.id.toString();
      }
      previousCursor = options.after.toString();
    } else {
      // Initial load - no cursor
      hasNext = hasMore;
      if (hasNext) {
        nextCursor = actualUsers[actualUsers.length - 1]?.id.toString();
      }
    }

    const pagination: PaginationMetadata = {
      hasNext,
      hasPrevious,
      nextCursor,
      previousCursor,
    };

    return {
      data: actualUsers.map((user) => user.toJSON()),
      pagination,
    };
  }

  /**
   * Update user status (online/offline)
   * Always updates lastSeen to keep real-time presence accurate
   */
  async updateUserStatus(userId: number, status: 'online' | 'offline'): Promise<void> {
    const updateData: any = { status, lastSeen: new Date() };

    await User.update(updateData, {
      where: { id: userId },
    });
  }

  /**
   * Update lastSeen timestamp for user
   */
  async updateLastSeen(userId: number): Promise<void> {
    await User.update({ lastSeen: new Date() }, { where: { id: userId } });
  }
}

export const userService = new UserService();
