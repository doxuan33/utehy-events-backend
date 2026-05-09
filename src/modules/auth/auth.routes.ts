import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middlewares/authenticate';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter riêng cho auth - chặt hơn route thường
// Tìm đoạn này trong auth.router.ts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100,                  // Tăng lên 100 hoặc cao hơn để hỗ trợ Import
  message: { success: false, message: 'Quá nhiều lần thử, vui lòng thử lại sau 15 phút' },
});

// ── Public routes (không cần token) ──────────────────────────
router.post('/register', authLimiter, authController.register);
router.post('/login',    authLimiter, authController.login);
router.post('/refresh',              authController.refresh);
router.post('/logout',               authController.logout);

// ── Protected routes (cần token) ─────────────────────────────
router.get('/me', authenticate, authController.getMe);

export default router;