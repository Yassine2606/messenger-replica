import { Request, Response, NextFunction } from 'express';
import { authService } from '../services';

export class AuthController {
  public async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name } = req.body;
      const result = await authService.register({ email, password, name });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await authService.login({ email, password });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await authService.getProfile(userId);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }

  public async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { name, avatarUrl, status } = req.body;
      const user = await authService.updateProfile(userId, { name, avatarUrl, status });
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
