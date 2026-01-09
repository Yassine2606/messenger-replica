import { Router, Request, Response, NextFunction } from 'express';
import { messageController } from '../controllers';
import { authenticate, validate } from '../middleware';
import { body, query, param } from 'express-validator';

const router = Router();

// Send message (clients should prefer Socket.IO)
router.post(
  '/',
  authenticate,
  validate([
    body('conversationId').isInt().withMessage('Conversation ID required'),
    body('type')
      .isIn(['text', 'image', 'audio'])
      .withMessage('Invalid message type'),
    body('content').optional().isString(),
    body('mediaUrl').optional().isString(),
    body('mediaMimeType').optional().isString(),
    body('mediaDuration').optional().isInt(),
    body('waveform').optional().isArray(),
    body('replyToId').optional().isInt(),
  ]),
  (req: Request, res: Response, next: NextFunction) => messageController.sendMessage(req, res, next)
);

// Get messages in conversation
router.get(
  '/conversation/:conversationId',
  authenticate,
  validate([
    param('conversationId').isInt().withMessage('Invalid conversation ID'),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('before').optional().isInt(),
    query('after').optional().isInt(),
  ]),
  (req: Request, res: Response, next: NextFunction) => messageController.getMessages(req, res, next)
);

// Delete message
router.delete(
  '/:messageId',
  authenticate,
  validate([param('messageId').isInt().withMessage('Invalid message ID')]),
  (req: Request, res: Response, next: NextFunction) => messageController.deleteMessage(req, res, next)
);

export default router;
