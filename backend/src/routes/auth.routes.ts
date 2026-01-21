import { Router } from 'express';
import { authController } from '../controllers';
import { authenticate, validate } from '../middleware';
import { registerValidation, loginValidation, updateProfileValidation } from '../validators';

const router = Router();

router.post('/register', validate(registerValidation), (req, res, next) =>
  authController.register(req, res, next)
);

router.post('/login', validate(loginValidation), (req, res, next) =>
  authController.login(req, res, next)
);

router.get('/profile', authenticate, (req, res, next) => authController.getProfile(req, res, next));

router.put('/profile', authenticate, validate(updateProfileValidation), (req, res, next) =>
  authController.updateProfile(req, res, next)
);

export default router;
