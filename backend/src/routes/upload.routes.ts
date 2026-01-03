import { Router } from 'express';
import multer from 'multer';
import { uploadController } from '../controllers/upload.controller';
import { authenticate } from '../middleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

router.post(
  '/',
  authenticate,
  upload.single('file'),
  (req, res, next) => uploadController.uploadFile(req, res, next)
);

export default router;
