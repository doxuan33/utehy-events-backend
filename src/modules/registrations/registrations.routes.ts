import { Router } from 'express';
import { registrationsController } from './registrations.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

// ── Sinh viên ─────────────────────────────────────────────────
router.post('/',                  authenticate, registrationsController.registerEvent);
router.delete('/:eventId',        authenticate, registrationsController.cancelRegistration);
router.get('/me',                 authenticate, registrationsController.getMyRegistrations);

// ── Page Admin xem danh sách + duyệt đăng ký ─────────────────
router.get(
  '/events/:eventId',
  authenticate,
  authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'),
  registrationsController.getEventRegistrations
);

router.patch(
  '/:registrationId/status',
  authenticate,
  authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'),
  registrationsController.updateRegistrationStatus
);

export default router;