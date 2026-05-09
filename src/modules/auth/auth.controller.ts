import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from './auth.schema';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { AuthRequest } from '../../middlewares/authenticate';

export const authController = {

  // POST /api/v1/auth/register
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await authService.register(parsed.data);
      return sendSuccess(res, result, 'Đăng ký thành công', 201);
    } catch (err: any) {
      next(err);
    }
  },

  // POST /api/v1/auth/login
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await authService.login(parsed.data);
      return sendSuccess(res, result, 'Đăng nhập thành công');
    } catch (err: any) {
      next(err);
    }
  },

  // POST /api/v1/auth/refresh
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = refreshTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await authService.refreshToken(parsed.data.refresh_token);
      return sendSuccess(res, result, 'Làm mới token thành công');
    } catch (err: any) {
      next(err);
    }
  },

  // POST /api/v1/auth/logout
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = refreshTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'Vui lòng gửi refresh_token', 400);
      }
      await authService.logout(parsed.data.refresh_token);
      return sendSuccess(res, null, 'Đăng xuất thành công');
    } catch (err: any) {
      next(err);
    }
  },

  // GET /api/v1/auth/me  (cần đăng nhập)
  async getMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await authService.getMe(req.user!.id);
      return sendSuccess(res, result, 'Lấy thông tin thành công');
    } catch (err: any) {
      next(err);
    }
  },
};