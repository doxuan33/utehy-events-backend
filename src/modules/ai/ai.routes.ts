import { Router } from 'express';
import { aiController } from './ai.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

// POST /api/v1/ai/generate-content - Cần quyền PAGE_ADMIN
router.post('/generate-content', authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), aiController.generateContent);

// POST /api/v1/ai/analyze-event - Cần quyền SYSTEM_ADMIN
router.post('/analyze-event', authenticate, authorize('SYSTEM_ADMIN'), aiController.analyzeEvent);

// POST /api/v1/ai/generate-poster - Cần quyền PAGE_ADMIN
router.post('/generate-poster', authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), aiController.generatePoster);

//POST /api/v1/ai/chat (Cho phép mọi user đã đăng nhập chat với bot)
router.post('/chat', authenticate, aiController.chat);

export default router;
