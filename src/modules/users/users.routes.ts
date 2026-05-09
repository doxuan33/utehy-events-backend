import { Router } from 'express';
import { usersController } from './users.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize, hasRole } from '../../middlewares/authorize';

const router = Router();

// ── Bản thân (tất cả đều cần đăng nhập) ──────────────────────
router.get('/me',                      authenticate, usersController.getMe);
router.post('/avatar',                 authenticate, usersController.uploadAvatar);
router.patch('/me',                    authenticate, usersController.updateProfile);
router.post('/me/change-password',     authenticate, usersController.changePassword);
router.get('/me/training-points',      authenticate, usersController.getTrainingPoints);

// ── System Admin ──────────────────────────────────────────────
router.get('/',                         authenticate, hasRole('SYSTEM_ADMIN'), usersController.getUsers);
router.post('/import-students',         authenticate, hasRole('SYSTEM_ADMIN'), usersController.importStudents);
router.patch('/:id/toggle-active',      authenticate, hasRole('SYSTEM_ADMIN'), usersController.toggleUserActive);

// ── Xem profile người khác (đặt cuối để không conflict với /me) ──
router.get('/:id',                      authenticate, usersController.getUserProfile);

export default router;
