import { Router } from 'express';
import { webhookController } from './webhook.controller';

const router = Router();

// Google Forms webhook - không cần authenticate vì dùng secret header
router.post('/google-form', webhookController.googleForm);

export default router;
