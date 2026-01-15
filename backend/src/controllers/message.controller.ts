import { Request, Response, NextFunction } from 'express';
import { messageService } from '../services';
import { getSocketManager } from '../socket';

export class MessageController {
  /**
   * Send message via REST endpoint
   * Broadcasts via Socket.IO for real-time updates
   */
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

      // Broadcast unified message event via Socket.IO
      try {
        const socketManager = getSocketManager();
        await socketManager.broadcastUnifiedMessage(conversationId, message.id, userId);
      } catch (socketError) {
        console.warn('[MessageController] Warning: Failed to broadcast via socket:', socketError);
        // Don't fail the request if socket broadcast fails - message is already saved
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

  async deleteMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { messageId } = req.params;

      const message = await messageService.deleteMessage(Number(messageId), userId);

      // Broadcast unified deletion event via Socket.IO
      try {
        const socketManager = getSocketManager();
        socketManager.broadcastUnifiedMessageDeletion(message.conversationId, Number(messageId), userId);
      } catch (socketError) {
        console.warn('[MessageController] Warning: Failed to broadcast deletion via socket:', socketError);
        // Don't fail the request if socket broadcast fails - message is already deleted
      }

      res.status(200).json({ success: true, message });
    } catch (error) {
      next(error);
    }
  }
}

export const messageController = new MessageController();
