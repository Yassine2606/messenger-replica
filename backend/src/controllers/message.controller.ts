import { Request, Response, NextFunction } from 'express';
import { messageService } from '../services';
import { getSocketManager } from '../socket';
import { SocketMessagePayload } from '../types';

export class MessageController {
  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { conversationId, type, content, mediaUrl, mediaMimeType, mediaDuration, replyToId } = req.body;

      const message = await messageService.sendMessage({
        conversationId,
        senderId: userId,
        type,
        content,
        mediaUrl,
        mediaMimeType,
        mediaDuration,
        replyToId,
      });

      // Emit socket event to all participants in conversation
      try {
        const socketManager = getSocketManager();
        const payload: SocketMessagePayload = {
          message,
          conversationId,
        };
        socketManager.emitToConversation(conversationId, 'message:new', payload);

        // Auto-mark as delivered for online recipients (excluding sender)
        await socketManager.markMessageAsDeliveredForOnlineUsers(message.id, conversationId, userId);
      } catch (socketError) {
        // Don't fail the request if socket emit fails
        console.error('Failed to emit socket event:', socketError);
      }

      res.status(201).json(message);
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { conversationId } = req.params;
      const { limit, before, after } = req.query;

      const messages = await messageService.getMessages(Number(conversationId), userId, {
        limit: limit ? Number(limit) : 30,
        before: before ? Number(before) : undefined,
        after: after ? Number(after) : undefined,
      });

      res.status(200).json(messages);
    } catch (error) {
      next(error);
    }
  }

  async markConversationAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { conversationId } = req.params;

      await messageService.markConversationAsRead(Number(conversationId), userId);
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async deleteMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { messageId } = req.params;

      await messageService.deleteMessage(Number(messageId), userId);
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async searchMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { conversationId } = req.params;
      const { q, limit } = req.query;

      if (!q) {
        res.status(400).json({ error: 'Query parameter required' });
        return;
      }

      const results = await messageService.searchMessages(
        Number(conversationId),
        userId,
        String(q),
        limit ? Number(limit) : 20
      );

      res.status(200).json(results);
    } catch (error) {
      next(error);
    }
  }
}

export const messageController = new MessageController();
