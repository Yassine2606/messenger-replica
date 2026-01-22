import { Router, Request, Response, NextFunction } from 'express';
import { conversationController } from '../controllers';
import { authenticate, validate } from '../middleware';
import { body, query } from 'express-validator';

const router = Router();

// Get all conversations for user
router.get(
  '/',
  authenticate,
  validate([
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('before').optional().isString(),
    query('after').optional().isString(),
  ]),
  (req: Request, res: Response, next: NextFunction) =>
    conversationController.getConversations(req, res, next)
);

// Get single conversation
router.get('/:conversationId', authenticate, (req, res, next) =>
  conversationController.getConversation(req, res, next)
);

// Create or get 1:1 conversation
router.post(
  '/',
  authenticate,
  validate([body('otherUserId').isInt().withMessage('Invalid user ID')]),
  (req, res, next) => conversationController.createOrGetConversation(req, res, next)
);

// Leave conversation
router.delete('/:conversationId', authenticate, (req, res, next) =>
  conversationController.leaveConversation(req, res, next)
);

export default router;
