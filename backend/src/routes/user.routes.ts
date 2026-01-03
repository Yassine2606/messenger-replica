import { Router } from 'express';
import { userController } from '../controllers';
import { authenticate, validate } from '../middleware';
import { query, param } from 'express-validator';

const router = Router();

// Search users
router.get(
  '/search',
  authenticate,
  validate([query('q').notEmpty().withMessage('Search query required')]),
  (req, res, next) => userController.searchUsers(req, res, next)
);

// Get all users
router.get('/', authenticate, (req, res, next) => userController.getAllUsers(req, res, next));

// Get user by ID
router.get(
  '/:userId',
  authenticate,
  validate([param('userId').isInt().withMessage('Invalid user ID')]),
  (req, res, next) => userController.getUser(req, res, next)
);

export default router;
