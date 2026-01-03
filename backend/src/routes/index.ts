import { Router } from 'express';
import authRoutes from './auth.routes';
import conversationRoutes from './conversation.routes';
import messageRoutes from './message.routes';
import userRoutes from './user.routes';
import uploadRoutes from './upload.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/conversations', conversationRoutes);
router.use('/messages', messageRoutes);
router.use('/users', userRoutes);
router.use('/upload', uploadRoutes);

export default router;
