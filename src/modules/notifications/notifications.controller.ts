import { Response, NextFunction } from 'express';
import { notificationsService } from './notifications.service';
import {
  getNotificationsQuerySchema,
} from './notifications.schema';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { AuthRequest } from '../../middlewares/authenticate';

const getParam = (param: string | string[]): string =>
  Array.isArray(param) ? param[0] : param;

export const notificationsController = {

  // GET /api/v1/notifications/stream  (SSE)
  async stream(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      notificationsService.registerClient(req.user!.id, res);
    } catch (err) { next(err); }
  },

  // GET /api/v1/notifications
  async getMyNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = getNotificationsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await notificationsService.getMyNotifications(
        req.user!.id,
        parsed.data
      );
      return sendSuccess(res, result, 'Lấy danh sách thông báo thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/notifications/unread-count
  async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await notificationsService.getUnreadCount(req.user!.id);
      return sendSuccess(res, result, 'Lấy số thông báo chưa đọc thành công');
    } catch (err) { next(err); }
  },

  // PATCH /api/v1/notifications/:id/read
  async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await notificationsService.markAsRead(
        getParam(req.params.id),
        req.user!.id
      );
      return sendSuccess(res, result, 'Đã đánh dấu đã đọc');
    } catch (err) { next(err); }
  },

  // PATCH /api/v1/notifications/read-all
  async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await notificationsService.markAllAsRead(req.user!.id);
      return sendSuccess(res, result, `Đã đọc tất cả ${result.updated_count} thông báo`);
    } catch (err) { next(err); }
  },

  // DELETE /api/v1/notifications/:id
  async deleteNotification(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await notificationsService.deleteNotification(
        getParam(req.params.id),
        req.user!.id
      );
      return sendSuccess(res, null, 'Đã xóa thông báo');
    } catch (err) { next(err); }
  },

  // DELETE /api/v1/notifications/read
  async deleteAllRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await notificationsService.deleteAllRead(req.user!.id);
      return sendSuccess(res, result, `Đã xóa ${result.deleted_count} thông báo đã đọc`);
    } catch (err) { next(err); }
  },
};