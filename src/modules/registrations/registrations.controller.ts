import { Response, NextFunction } from 'express';
import { registrationsService } from './registrations.service';
import {
  registerEventSchema,
  updateRegistrationSchema,
  getRegistrationsQuerySchema,
} from './registrations.schema';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { AuthRequest } from '../../middlewares/authenticate';

const getParam = (param: string | string[]): string =>
  Array.isArray(param) ? param[0] : param;

export const registrationsController = {

  // POST /api/v1/registrations
  async registerEvent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = registerEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await registrationsService.registerEvent(
        req.user!.id,
        parsed.data.event_id
      );
      return sendSuccess(res, result, 'Đăng ký tham gia sự kiện thành công', 201);
    } catch (err) { next(err); }
  },

  // DELETE /api/v1/registrations/:eventId
  async cancelRegistration(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await registrationsService.cancelRegistration(
        req.user!.id,
        getParam(req.params.eventId)
      );
      return sendSuccess(res, result, result.message);
    } catch (err) { next(err); }
  },

  // GET /api/v1/registrations/me
  async getMyRegistrations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = getRegistrationsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await registrationsService.getMyRegistrations(
        req.user!.id,
        parsed.data
      );
      return sendSuccess(res, result, 'Lấy lịch sử đăng ký thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/registrations/events/:eventId?page_id=xxx
  async getEventRegistrations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = getRegistrationsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const pageId = req.query.page_id as string;
      if (!pageId) {
        return sendError(res, 'Vui lòng cung cấp page_id', 400);
      }
      const result = await registrationsService.getEventRegistrations(
        getParam(req.params.eventId),
        pageId,
        parsed.data
      );
      return sendSuccess(res, result, 'Lấy danh sách đăng ký thành công');
    } catch (err) { next(err); }
  },

  // PATCH /api/v1/registrations/:registrationId/status?page_id=xxx
  async updateRegistrationStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = updateRegistrationSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const pageId = req.query.page_id as string;
      if (!pageId) {
        return sendError(res, 'Vui lòng cung cấp page_id', 400);
      }
      const result = await registrationsService.updateRegistrationStatus(
        getParam(req.params.registrationId),
        pageId,
        parsed.data
      );
      return sendSuccess(res, result, 'Cập nhật trạng thái đăng ký thành công');
    } catch (err) { next(err); }
  },
};