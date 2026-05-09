import { Router } from 'express';
import { adminController } from './admin.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

// Tất cả route admin đều yêu cầu SYSTEM_ADMIN
router.use(authenticate, authorize('SYSTEM_ADMIN'));

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', adminController.getDashboard);

// ── Sự kiện chờ duyệt ────────────────────────────────────────
router.get('/events/pending', adminController.getPendingEvents);

// ── Báo cáo ──────────────────────────────────────────────────
router.get('/reports/training-points', adminController.getTrainingPointsReport);
router.get('/reports/pages',           adminController.getPageStats);
router.get('/reports/events',          adminController.getEventStats);

// ── Danh mục sự kiện ─────────────────────────────────────────
router.post('/categories',      adminController.createCategory);
router.patch('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id',adminController.deleteCategory);

// ── Huy hiệu ─────────────────────────────────────────────────
router.get('/badges',  adminController.getBadges);
router.post('/badges', adminController.createBadge);

export default router;