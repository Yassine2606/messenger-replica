import { User } from '../models';
import { AppError } from '../middleware';
import { Op } from 'sequelize';

export class UserService {
  /**
   * Search users by name or email
   */
  async searchUsers(query: string, currentUserId: number): Promise<Partial<User>[]> {
    if (query.length < 2) {
      throw new AppError(400, 'Search query must be at least 2 characters');
    }

    const users = await User.findAll({
      where: {
        id: { [Op.ne]: currentUserId }, // Exclude current user
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { email: { [Op.iLike]: `%${query}%` } },
        ],
      },
      attributes: ['id', 'name', 'email', 'avatarUrl', 'status', 'lastSeen'],
      limit: 20,
    });

    return users.map((user) => user.toJSON());
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
   * Get all users (for user selection)
   */
  async getAllUsers(currentUserId: number): Promise<Partial<User>[]> {
    const users = await User.findAll({
      where: {
        id: { [Op.ne]: currentUserId }, // Exclude current user
      },
      attributes: ['id', 'name', 'email', 'avatarUrl', 'status', 'lastSeen'],
      order: [['name', 'ASC']],
    });

    return users.map((user) => user.toJSON());
  }

  /**
   * Update user status (online/offline)
   */
  async updateUserStatus(userId: number, status: 'online' | 'offline'): Promise<void> {
    const updateData: any = { status };
    if (status === 'offline') {
      updateData.lastSeen = new Date();
    }

    await User.update(updateData, {
      where: { id: userId },
    });
  }
}

export const userService = new UserService();
