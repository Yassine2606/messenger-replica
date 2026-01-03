import { Request, Response, NextFunction } from 'express';
import { userService } from '../services';

export class UserController {
  /**
   * Search users
   */
  async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        res.status(400).json({ error: 'Query parameter required' });
        return;
      }

      const users = await userService.searchUsers(q, userId);
      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user by ID
   */
  async getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const user = await userService.getUserById(Number(userId));
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all users
   */
  async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const users = await userService.getAllUsers(userId);
      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
