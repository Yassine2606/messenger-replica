import { Router } from 'express';
import { conversationController } from '../controllers';
import { authenticate, validate } from '../middleware';
import { body } from 'express-validator';

const router = Router();

// Get all conversations for user
router.get('/', authenticate, (req, res, next) =>
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

export default router;
