import { z } from 'zod';

export const createPostSchema = z.object({
  page_id: z.string().uuid('page_id không hợp lệ'),
  event_id: z.string().uuid('event_id không hợp lệ').optional(),
  content: z.string().min(1, 'Nội dung không được để trống').max(5000),
  // image_urls will be populated from uploaded files, not from direct input
});

export const updatePostSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  // image_urls will be set via separate upload or kept as-is
});

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Nội dung bình luận không được để trống').max(1000),
  parent_id: z.string().uuid('parent_id không hợp lệ').optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const getNewsfeedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.string().optional().transform(v => Math.min(parseInt(v || '10'), 50)),
  page_id: z.string().optional(),
});

export const getCommentsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.string().optional().transform(v => Math.min(parseInt(v || '20'), 50)),
  parent_id: z.string().optional(),
});

export type CreatePostInput     = z.infer<typeof createPostSchema>;
export type UpdatePostInput     = z.infer<typeof updatePostSchema>;
export type CreateCommentInput  = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput  = z.infer<typeof updateCommentSchema>;
export type GetNewsfeedQuery    = z.infer<typeof getNewsfeedQuerySchema>;
export type GetCommentsQuery    = z.infer<typeof getCommentsQuerySchema>;