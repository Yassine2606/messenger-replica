import { Request, Response, NextFunction } from 'express';
import { userService } from '../services';

export class UserController {
  /**
   * Search users
   */
  async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { q, limit, before, after } = req.query;

      if (!q || typeof q !== 'string') {
        res.status(400).json({ error: 'Query parameter required' });
        return;
      }

      const result = await userService.searchUsers(q, userId, {
        limit: limit ? Number(limit) : 20,
        before: before ? Number(before) : undefined,
        after: after ? Number(after) : undefined,
      });

      res.status(200).json(result);
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
      const { limit, before, after } = req.query;

      const result = await userService.getAllUsers(userId, {
        limit: limit ? Number(limit) : 50,
        before: before ? Number(before) : undefined,
        after: after ? Number(after) : undefined,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
