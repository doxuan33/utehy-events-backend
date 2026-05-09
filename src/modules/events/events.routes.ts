import { Router } from 'express';
import { eventsController } from './events.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

// ── Public / Sinh viên ────────────────────────────────────────
router.get('/',           authenticate, eventsController.getEvents);
router.get('/categories', authenticate, eventsController.getCategories);
router.get('/pending',    authenticate, authorize('SYSTEM_ADMIN'), eventsController.getPendingEvents);
// AI Recommendation
router.get('/recommended', authenticate, eventsController.getRecommendedEvents);
router.get('/:id',        authenticate, eventsController.getEventById);

// ── Page Admin ────────────────────────────────────────────────
router.post('/',      authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), eventsController.createEvent);
router.patch('/:id',  authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), eventsController.updateEvent);
router.delete('/:id', authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), eventsController.deleteEvent);

// ── System Admin ──────────────────────────────────────────────
router.patch('/:id/approve', authenticate, authorize('SYSTEM_ADMIN'), eventsController.approveEvent);
router.patch('/:id/reject',  authenticate, authorize('SYSTEM_ADMIN'), eventsController.rejectEvent);

export default router;
