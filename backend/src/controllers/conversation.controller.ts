import { Request, Response, NextFunction } from 'express';
import { conversationService } from '../services';

export class ConversationController {
  async getConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { limit, before, after } = req.query;

      const result = await conversationService.getConversations(userId, {
        limit: limit ? Number(limit) : 20,
        before: before ? String(before) : undefined,
        after: after ? String(after) : undefined,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { conversationId } = req.params;
      const conversation = await conversationService.getConversation(
        Number(conversationId),
        userId
      );
      res.status(200).json(conversation);
    } catch (error) {
      next(error);
    }
  }

  async createOrGetConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { otherUserId } = req.body;
      const conversation = await conversationService.createOrGetConversation(userId, otherUserId);
      res.status(201).json(conversation);
    } catch (error) {
      next(error);
    }
  }
}

export const conversationController = new ConversationController();
