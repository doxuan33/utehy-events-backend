import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { usersService } from './users.service';
import {
  updateProfileSchema,
  changePasswordSchema,
  getUsersQuerySchema,
  importStudentsSchema,
} from './users.schema';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { AuthRequest } from '../../middlewares/authenticate';
import { uploadSingle } from '../../middlewares/upload.middleware';
import { ImportStudentsInput } from './users.schema';

const getParam = (param: string | string[]): string =>
  Array.isArray(param) ? param[0] : param;

export const usersController = {

  // GET /api/v1/users/me
  async getMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await usersService.getUserProfile(req.user!.id);
      return sendSuccess(res, result, 'Lấy thông tin thành công');
    } catch (err) { next(err); }
  },

  // POST /api/v1/users/avatar (Upload avatar)
  async uploadAvatar(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await new Promise<void>((resolve, reject) => {
        uploadSingle('avatar')(req, res, (err: any) => {
          if (err) return reject(err);
          resolve();
        });
      });

      const avatarUrl = req.file ? (req.file as any).path : null;
      const result = await usersService.updateAvatar(req.user!.id, avatarUrl);
      return sendSuccess(res, result, 'Cập nhật ảnh đại diện thành công');
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

  // POST /api/v1/users/import-students (SYSTEM_ADMIN)
  async importStudents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = importStudentsSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await usersService.bulkCreateStudents(parsed.data.students);
      return sendSuccess(res, result, `Import hoàn tất. Thành công: ${result.success}, Lỗi: ${result.failed}`);
    } catch (err) { next(err); }
  },

  // GET /api/v1/users/:id
  async getUserProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await usersService.getUserProfile(getParam(req.params.id));
      return sendSuccess(res, result, 'Lấy thông tin người dùng thành công');
    } catch (err) { next(err); }
  },

  // PATCH /api/v1/users/me
  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await usersService.updateProfile(req.user!.id, parsed.data);
      return sendSuccess(res, result, 'Cập nhật hồ sơ thành công');
    } catch (err) { next(err); }
  },

  // POST /api/v1/users/me/change-password
  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      await usersService.changePassword(req.user!.id, parsed.data);
      return sendSuccess(res, null, 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại');
    } catch (err) { next(err); }
  },

  // GET /api/v1/users/me/training-points
  async getTrainingPoints(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await usersService.getTrainingPoints(req.user!.id);
      return sendSuccess(res, result, 'Lấy điểm rèn luyện thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/users (SYSTEM_ADMIN)
  async getUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = getUsersQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await usersService.getUsers(parsed.data);
      return sendSuccess(res, result, 'Lấy danh sách người dùng thành công');
    } catch (err) { next(err); }
  },

  // PATCH /api/v1/users/:id/toggle-active (SYSTEM_ADMIN)
  async toggleUserActive(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await usersService.toggleUserActive(
        getParam(req.params.id),
        req.user!.id
      );
      return sendSuccess(res, result, result.message);
    } catch (err) { next(err); }
  },
};
