import { Router } from 'express';
import { messageController } from '../controllers';
import { authenticate, validate } from '../middleware';
import { body, query, param } from 'express-validator';

const router = Router();

// Send message
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
  (req, res, next) => messageController.sendMessage(req, res, next)
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
  (req, res, next) => messageController.getMessages(req, res, next)
);

// Search messages
router.get(
  '/conversation/:conversationId/search',
  authenticate,
  validate([
    param('conversationId').isInt().withMessage('Invalid conversation ID'),
    query('q').notEmpty().withMessage('Search query required'),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ]),
  (req, res, next) => messageController.searchMessages(req, res, next)
);

// Mark conversation as read
router.post(
  '/conversation/:conversationId/read',
  authenticate,
  validate([param('conversationId').isInt().withMessage('Invalid conversation ID')]),
  (req, res, next) => messageController.markConversationAsRead(req, res, next)
);

// Delete message
router.delete(
  '/:messageId',
  authenticate,
  validate([param('messageId').isInt().withMessage('Invalid message ID')]),
  (req, res, next) => messageController.deleteMessage(req, res, next)
);

export default router;
