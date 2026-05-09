import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { eventsService } from './events.service';
import {
  createEventSchema,
  updateEventSchema,
  rejectEventSchema,
  getEventsQuerySchema,
} from './events.schema';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { AuthRequest } from '../../middlewares/authenticate';
import { uploadSingle } from '../../middlewares/upload.middleware';

// Helper lấy string từ param
const getParam = (param: string | string[]): string =>
  Array.isArray(param) ? param[0] : param;

export const eventsController = {

  // GET /api/v1/events
  async getEvents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = getEventsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await eventsService.getEvents(parsed.data, req.user?.role);
      return sendSuccess(res, result, 'Lấy danh sách sự kiện thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/events/categories
  async getCategories(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await eventsService.getCategories();
      return sendSuccess(res, result, 'Lấy danh mục thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/events/pending
  async getPendingEvents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await eventsService.getPendingEvents();
      return sendSuccess(res, result, 'Lấy danh sách chờ duyệt thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/events/:id
  async getEventById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const result = await eventsService.getEventById(getParam(req.params.id), req.user?.id);
        return sendSuccess(res, result, 'Lấy chi tiết sự kiện thành công');
    } catch (err) { next(err); }
    },

  // GET /api/v1/events/recommended (AI Recommendations)
  async getRecommendedEvents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) {
        return sendError(res, 'Yêu cầu xác thực', 401);
      }
      const limit = parseInt(req.query.limit as string) || 5;
      const result = await eventsService.getRecommendedEvents(req.user.id, limit);
      return sendSuccess(res, result, 'Lấy danh sách gợi ý thành công');
    } catch (err) { next(err); }
  },

  // POST /api/v1/events
  async createEvent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // 1. Handle optional file upload (only if multipart/form-data)
      const isMultipart = req.headers['content-type']?.includes('multipart/form-data');

      if (isMultipart) {
        await new Promise<void>((resolve, reject) => {
          uploadSingle('coverImage')(req, res, (err: any) => {
            if (err && !err.message.includes('Không có file')) {
              return reject(err);
            }
            resolve();
          });
        });
      }

      const parsed = createEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }

      // page_id lấy từ body (PAGE_ADMIN gửi lên page của mình)
      const { page_id } = req.body;
      if (!page_id) {
        if (req.file) {
          await cloudinary.uploader.destroy((req.file as any).filename);
        }
        return sendError(res, 'Vui lòng cung cấp page_id', 400);
      }

      // Use uploaded file URL or banner_url from body (frontend uploads separately)
      const bannerUrl = req.file ? (req.file as any).path : parsed.data.banner_url;

      const result = await eventsService.createEvent(page_id, { ...parsed.data, banner_url: bannerUrl });

      return sendSuccess(res, result, 'Tạo sự kiện thành công, đang chờ duyệt', 201);
    } catch (err: any) {
      if (req.file) {
        try {
          await cloudinary.uploader.destroy((req.file as any).filename);
        } catch (cleanupErr) {
          console.error('Failed to cleanup Cloudinary file:', cleanupErr);
        }
      }
      next(err);
    }
  },

  // PATCH /api/v1/events/:id
  async updateEvent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Handle optional file upload (only if multipart/form-data)
      const isMultipart = req.headers['content-type']?.includes('multipart/form-data');

      if (isMultipart) {
        await new Promise<void>((resolve, reject) => {
          uploadSingle('coverImage')(req, res, (err: any) => {
            if (err && !err.message.includes('Không có file')) {
              return reject(err);
            }
            resolve();
          });
        });
      }

      const parsed = updateEventSchema.safeParse(req.body);
      if (!parsed.success) {
        // Clean up uploaded file if validation fails
        if (req.file) {
          await (global as any).cloudinary.uploader.destroy((req.file as any).filename);
        }
        return sendError(res, parsed.error.issues[0].message, 400);
      }

      const { page_id } = req.body;
      if (!page_id) {
        if (req.file) {
          await cloudinary.uploader.destroy((req.file as any).filename);
        }
        return sendError(res, 'Vui lòng cung cấp page_id', 400);
      }

      const bannerUrl = req.file ? (req.file as any).path : parsed.data.banner_url;

      const result = await eventsService.updateEvent(
        getParam(req.params.id),
        page_id,
        { ...parsed.data, banner_url: bannerUrl }
      );

      return sendSuccess(res, result, 'Cập nhật sự kiện thành công');
    } catch (err: any) {
      if (req.file) {
        try {
          await cloudinary.uploader.destroy((req.file as any).filename);
        } catch (cleanupErr) {
          console.error('Failed to cleanup Cloudinary file:', cleanupErr);
        }
      }
      next(err);
    }
  },

  // PATCH /api/v1/events/:id/approve
  async approveEvent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const result = await eventsService.approveEvent(getParam(req.params.id));
        return sendSuccess(res, result, 'Duyệt sự kiện thành công');
    } catch (err) { next(err); }
    },

  // PATCH /api/v1/events/:id/reject
  async rejectEvent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const parsed = rejectEventSchema.safeParse(req.body);
        if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
        }
        const result = await eventsService.rejectEvent(getParam(req.params.id), parsed.data.reason);
        return sendSuccess(res, result, 'Từ chối sự kiện thành công');
    } catch (err) { next(err); }
    },

  // DELETE /api/v1/events/:id
  async deleteEvent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { page_id } = req.body;
        if (!page_id) {
        return sendError(res, 'Vui lòng cung cấp page_id', 400);
        }
        await eventsService.deleteEvent(getParam(req.params.id), page_id);
        return sendSuccess(res, null, 'Xóa sự kiện thành công');
    } catch (err) { next(err); }
    },
};
