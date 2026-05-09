import { Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { postsService } from './posts.service';
import {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  getNewsfeedQuerySchema,
  getCommentsQuerySchema,
} from './posts.schema';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { AuthRequest } from '../../middlewares/authenticate';
import { uploadMultiple } from '../../middlewares/upload.middleware';

const getParam = (param: string | string[]): string =>
  Array.isArray(param) ? param[0] : param;

export const postsController = {

  // GET /api/v1/posts/newsfeed
  async getNewsfeed(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = getNewsfeedQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await postsService.getNewsfeed(req.user!.id, parsed.data);
      return sendSuccess(res, result, 'Lấy bảng tin thành công');
    } catch (err) { next(err); }
  },

  // GET /api/v1/posts/:id
  async getPostById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await postsService.getPostById(
        getParam(req.params.id),
        req.user!.id
      );
      return sendSuccess(res, result, 'Lấy bài viết thành công');
    } catch (err) { next(err); }
  },

  // POST /api/v1/posts
  async createPost(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Handle multiple image uploads first (optional)
      await new Promise<void>((resolve, reject) => {
        uploadMultiple('images', 10)(req, res, (err: any) => {
          if (err && !err.message.includes('Không có file')) {
            return reject(err);
          }
          resolve();
        });
      });

      const parsed = createPostSchema.safeParse(req.body);
      if (!parsed.success) {
        // Clean up uploaded files if validation fails
        if (req.files) {
          for (const file of req.files as any[]) {
            try {
              await cloudinary.uploader.destroy(file.filename);
            } catch (cleanupErr) {
              console.error('Failed to cleanup Cloudinary file:', cleanupErr);
            }
          }
        }
        return sendError(res, parsed.error.issues[0].message, 400);
      }

      const imageUrls = req.files ? (req.files as any[]).map(f => f.path) : [];

      const result = await postsService.createPost(req.user!.id, {
        ...parsed.data,
        image_urls: imageUrls,
      });
      return sendSuccess(res, result, 'Đăng bài viết thành công', 201);
    } catch (err: any) {
      // Clean up uploaded files on error
      if (req.files) {
        for (const file of req.files as any[]) {
          try {
            await cloudinary.uploader.destroy(file.filename);
          } catch (cleanupErr) {
            console.error('Failed to cleanup Cloudinary file:', cleanupErr);
          }
        }
      }
      next(err);
    }
  },

  // PATCH /api/v1/posts/:id
  async updatePost(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Handle optional multiple image uploads
      await new Promise<void>((resolve, reject) => {
        uploadMultiple('images', 10)(req, res, (err: any) => {
          if (err && !err.message.includes('Không có file')) {
            return reject(err);
          }
          resolve();
        });
      });

      const parsed = updatePostSchema.safeParse(req.body);
      if (!parsed.success) {
        if (req.files) {
          for (const file of req.files as any[]) {
            try {
              await cloudinary.uploader.destroy(file.filename);
            } catch (cleanupErr) {
              console.error('Failed to cleanup Cloudinary file:', cleanupErr);
            }
          }
        }
        return sendError(res, parsed.error.issues[0].message, 400);
      }

      const imageUrls = req.files ? (req.files as any[]).map(f => f.path) : undefined;

      const result = await postsService.updatePost(
        getParam(req.params.id),
        req.user!.id,
        { ...parsed.data, image_urls: imageUrls }
      );
      return sendSuccess(res, result, 'Cập nhật bài viết thành công');
    } catch (err: any) {
      if (req.files) {
        for (const file of req.files as any[]) {
          try {
            await cloudinary.uploader.destroy(file.filename);
          } catch (cleanupErr) {
            console.error('Failed to cleanup Cloudinary file:', cleanupErr);
          }
        }
      }
      next(err);
    }
  },

  // DELETE /api/v1/posts/:id
  async deletePost(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await postsService.deletePost(
        getParam(req.params.id),
        req.user!.id,
        req.user!.role
      );
      return sendSuccess(res, null, 'Xóa bài viết thành công');
    } catch (err) { next(err); }
  },

  // POST /api/v1/posts/:id/like
  async toggleLike(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await postsService.toggleLike(
        getParam(req.params.id),
        req.user!.id
      );
      return sendSuccess(res, result, result.message);
    } catch (err) { next(err); }
  },

  // GET /api/v1/posts/:id/comments
  async getComments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = getCommentsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await postsService.getComments(
        getParam(req.params.id),
        parsed.data
      );
      return sendSuccess(res, result, 'Lấy bình luận thành công');
    } catch (err) { next(err); }
  },

  // POST /api/v1/posts/:id/comments
  async createComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = createCommentSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }
      const result = await postsService.createComment(
        getParam(req.params.id),
        req.user!.id,
        parsed.data
      );
      return sendSuccess(res, result, 'Bình luận thành công', 201);
    } catch (err) { next(err); }
  },

  // DELETE /api/v1/posts/:postId/comments/:commentId
  async deleteComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await postsService.deleteComment(
        getParam(req.params.commentId),
        req.user!.id,
        req.user!.role
      );
      return sendSuccess(res, null, 'Xóa bình luận thành công');
    } catch (err) { next(err); }
  },
};
