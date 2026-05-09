import { Response, NextFunction } from 'express';
import { adminService } from './admin.service';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { AuthRequest } from '../../middlewares/authenticate';

const getParam = (param: string | string[]): string =>
  Array.isArray(param) ? param[0] : param;

export const adminController = {

  // GET /api/v1/admin/dashboard
  async getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.getDashboard();
      return sendSuccess(res, result, 'Lấy dữ liệu dashboard thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/admin/events/pending
  async getPendingEvents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.getPendingEvents();
      return sendSuccess(res, result, 'Lấy danh sách sự kiện chờ duyệt thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/admin/reports/training-points
  async getTrainingPointsReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const semester = req.query.semester as string | undefined;
      const result = await adminService.getTrainingPointsReport(semester);
      return sendSuccess(res, result, 'Xuất báo cáo điểm rèn luyện thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/admin/reports/pages
  async getPageStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.getPageStats();
      return sendSuccess(res, result, 'Lấy thống kê CLB thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/admin/reports/events
  async getEventStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const result = await adminService.getEventStats(year);
      return sendSuccess(res, result, 'Lấy thống kê sự kiện thành công');
    } catch (err) { next(err); }
  },

  // POST /api/v1/admin/categories
  async createCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, default_training_points, color_hex } = req.body;
      if (!name) return sendError(res, 'Tên danh mục không được để trống', 400);
      const result = await adminService.createCategory(
        name,
        default_training_points || 0,
        color_hex
      );
      return sendSuccess(res, result, 'Tạo danh mục thành công', 201);
    } catch (err) { next(err); }
  },

  // PATCH /api/v1/admin/categories/:id
  async updateCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.updateCategory(
        parseInt(getParam(req.params.id)),
        req.body
      );
      return sendSuccess(res, result, 'Cập nhật danh mục thành công');
    } catch (err) { next(err); }
  },

  // DELETE /api/v1/admin/categories/:id
  async deleteCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await adminService.deleteCategory(parseInt(getParam(req.params.id)));
      return sendSuccess(res, null, 'Xóa danh mục thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/admin/badges
  async getBadges(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.getBadges();
      return sendSuccess(res, result, 'Lấy danh sách huy hiệu thành công');
    } catch (err) { next(err); }
  },

  // POST /api/v1/admin/badges
  async createBadge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, description, icon_url, condition } = req.body;
      if (!name || !description || !icon_url || !condition) {
        return sendError(res, 'Vui lòng điền đầy đủ thông tin huy hiệu', 400);
      }
      const result = await adminService.createBadge({ name, description, icon_url, condition });
      return sendSuccess(res, result, 'Tạo huy hiệu thành công', 201);
    } catch (err) { next(err); }
  },
};