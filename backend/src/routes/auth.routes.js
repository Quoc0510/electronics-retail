/**
 * @feature [F01] Xác thực - Route /api/auth/*
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { validate } from '../middlewares/validate.js';
import * as authController from '../controllers/auth.controller.js';
import { loginSchema, refreshSchema, registerSchema } from '../validators/auth.validator.js';

const router = Router();

// US-02 AC4: giới hạn số lần thử đăng nhập để chống dò mật khẩu (brute force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.LOGIN_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Bạn đăng nhập sai quá nhiều lần, hãy thử lại sau' },
  },
});

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', validate(refreshSchema), authController.logout);

export default router;
