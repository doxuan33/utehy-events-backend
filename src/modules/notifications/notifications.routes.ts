import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { notificationsController } from './notifications.controller';

const router = Router();

// Real-time Stream
router.get('/stream', authenticate, notificationsController.stream);

// Fetch data
router.get('/', authenticate, notificationsController.getMyNotifications);
router.get('/unread-count', authenticate, notificationsController.getUnreadCount);

// Mark as read (Lưu ý thứ tự route tĩnh phải đặt trước route động :id)
router.patch('/read-all', authenticate, notificationsController.markAllAsRead);
router.patch('/:id/read', authenticate, notificationsController.markAsRead);

// Delete
router.delete('/read', authenticate, notificationsController.deleteAllRead);
router.delete('/:id', authenticate, notificationsController.deleteNotification);

export default router;