import { Response, NextFunction } from 'express';
import { pagesService } from './pages.service';
import { createPageSchema, updatePageSchema, addMemberSchema, joinPageSchema, updateMemberRoleSchema } from './pages.schema';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { AuthRequest } from '../../middlewares/authenticate';

const getParam = (param: string | string[]): string =>
  Array.isArray(param) ? param[0] : param;

export const pagesController = {

  // GET /api/v1/pages
  async getPages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string | undefined;
      const result = await pagesService.getPages(search);
      return sendSuccess(res, result, 'Lấy danh sách trang thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/pages/following
  async getFollowingPages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await pagesService.getFollowingPages(req.user!.id);
      return sendSuccess(res, result, 'Lấy danh sách đang theo dõi thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/pages/:slug
  async getPageBySlug(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await pagesService.getPageBySlug(
        getParam(req.params.slug),
        req.user?.id
      );
      return sendSuccess(res, result, 'Lấy thông tin trang thành công');
    } catch (err) { next(err); }
  },

  // POST /api/v1/pages
  async createPage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = createPageSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await pagesService.createPage(parsed.data, req.user!.id);
      return sendSuccess(res, result, 'Tạo trang CLB thành công', 201);
    } catch (err) { next(err); }
  },

  // PATCH /api/v1/pages/:id
  async updatePage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = updatePageSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await pagesService.updatePage(
        getParam(req.params.id),
        req.user!.id,
        parsed.data
      );
      return sendSuccess(res, result, 'Cập nhật trang thành công');
    } catch (err) { next(err); }
  },

  // POST /api/v1/pages/:id/follow
  async followPage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await pagesService.followPage(
        getParam(req.params.id),
        req.user!.id
      );
      return sendSuccess(res, result, result.message);
    } catch (err) { next(err); }
  },

  // DELETE /api/v1/pages/:id/follow
  async unfollowPage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await pagesService.unfollowPage(
        getParam(req.params.id),
        req.user!.id
      );
      return sendSuccess(res, result, result.message);
    } catch (err) { next(err); }
  },

  // POST /api/v1/pages/:id/members
  async addMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = addMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await pagesService.addMember(
        getParam(req.params.id),
        parsed.data
      );
      return sendSuccess(res, result, 'Thêm thành viên thành công', 201);
    } catch (err) { next(err); }
  },

  // DELETE /api/v1/pages/:id/members/:userId
  async removeMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await pagesService.removeMember(
        getParam(req.params.id),
        getParam(req.params.userId)
      );
      return sendSuccess(res, null, 'Xóa thành viên thành công');
    } catch (err) { next(err); }
  },

  // POST /api/v1/pages/:id/join (STUDENT nộp đơn gia nhập)
  async joinPage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = joinPageSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await pagesService.joinPage(
        getParam(req.params.id),
        req.user!.id,
        parsed.data
      );
      return sendSuccess(res, result, 'Đã gửi yêu cầu gia nhập', 201);
    } catch (err) { next(err); }
  },

  // GET /api/v1/pages/:id/members (Lấy danh sách thành viên)
  async getMembers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await pagesService.getMembers(getParam(req.params.id));
      return sendSuccess(res, result, 'Lấy danh sách thành viên thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/pages/:id/join-requests (Lấy danh sách yêu cầu gia nhập chờ duyệt)
  async getJoinRequests(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await pagesService.getJoinRequests(getParam(req.params.id));
      return sendSuccess(res, result, 'Lấy danh sách yêu cầu gia nhập thành công');
    } catch (err) { next(err); }
  },

  // PATCH /api/v1/pages/:id/join-requests/:userId/approve
  async approveJoinRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await pagesService.processJoinRequest(
        getParam(req.params.id),
        getParam(req.params.userId),
        'APPROVED'
      );
      return sendSuccess(res, result, 'Đã chấp nhận yêu cầu gia nhập');
    } catch (err) { next(err); }
  },

  // PATCH /api/v1/pages/:id/join-requests/:userId/reject
  async rejectJoinRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await pagesService.processJoinRequest(
        getParam(req.params.id),
        getParam(req.params.userId),
        'REJECTED'
      );
      return sendSuccess(res, result, 'Đã từ chối yêu cầu gia nhập');
    } catch (err) { next(err); }
  },

  // PATCH /api/v1/pages/:id/members/:userId/role
  async updateMemberRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = updateMemberRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await pagesService.updateMemberRole(
        getParam(req.params.id),
        getParam(req.params.userId),
        parsed.data.role
      );
      return sendSuccess(res, result, 'Cập nhật vai trò thành công');
    } catch (err) { next(err); }
  },

  // DELETE /api/v1/pages/:id/members/:userId/kick
  async kickMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await pagesService.kickMember(
        getParam(req.params.id),
        getParam(req.params.userId)
      );
      return sendSuccess(res, result, 'Đã xóa thành viên khỏi CLB');
    } catch (err) { next(err); }
  },
};