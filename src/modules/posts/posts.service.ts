import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import {
  CreatePostInput,
  UpdatePostInput,
  CreateCommentInput,
  UpdateCommentInput,
  GetNewsfeedQuery,
  GetCommentsQuery,
} from './posts.schema';

export const postsService = {

  // ── TẠO BÀI VIẾT (PAGE_ADMIN) ────────────────────────────
  async createPost(authorId: string, input: CreatePostInput & { image_urls: string[] }) {
    // Kiểm tra user có phải thành viên của page không
    const member = await prisma.pageMember.findUnique({
      where: {
        page_id_user_id: { page_id: input.page_id, user_id: authorId },
      },
    });
    if (!member) {
      throw { statusCode: 403, message: 'Bạn không có quyền đăng bài trên trang này' };
    }

    // Nếu bài viết gắn với sự kiện, kiểm tra sự kiện thuộc page này
    if (input.event_id) {
      const event = await prisma.event.findUnique({
        where: { id: input.event_id },
      });
      if (!event || event.page_id !== input.page_id) {
        throw { statusCode: 400, message: 'Sự kiện không thuộc trang này' };
      }
    }

    const post = await prisma.post.create({
      data: {
        page_id: input.page_id,
        author_id: authorId,
        event_id: input.event_id,
        content: input.content,
        image_urls: input.image_urls && input.image_urls.length > 0 ? JSON.stringify(input.image_urls) : Prisma.JsonNull,
      },
      include: {
        page: { select: { id: true, name: true, avatar_url: true, slug: true } },
        author: {
          select: {
            id: true,
            profile: { select: { full_name: true, avatar_url: true } },
          },
        },
        event: {
          select: {
            id: true, title: true, start_time: true,
            location: true, training_points: true, status: true,
          },
        },
      },
    });

    return this.formatPost(post, authorId);
  },

  // ── LẤY NEWSFEED (cursor-based pagination) ───────────────
  async getNewsfeed(userId: string, query: GetNewsfeedQuery) {
    const { cursor, limit, page_id } = query;

    // Lấy danh sách page user đang follow
     const followingPages = await prisma.pageFollower.findMany({
       where: { user_id: userId },
       select: { page_id: true },
     });
     const followingPageIds = followingPages.map(f => f.page_id);

     // Nếu user không follow trang nào và không có page_id cụ thể → return empty
     if (followingPageIds.length === 0 && !page_id) {
       return { data: [], next_cursor: null };
     }

     // Nếu có page_id được chỉ định, sử dụng nó; nếu không, dùng followingPageIds
     // (đã đảm bảo followingPageIds không empty ở đây nếu không có page_id)

    // Xác định điểm bắt đầu cursor
    let cursorCondition = {};
    if (cursor) {
      const cursorPost = await prisma.post.findUnique({
        where: { id: cursor },
        select: { created_at: true },
      });
      if (cursorPost) {
        cursorCondition = { created_at: { lt: cursorPost.created_at } };
      }
    }

    const where: any = {
      ...cursorCondition,
      ...(page_id
        ? { page_id }
        : { page_id: { in: followingPageIds } }
      ),
    };

    const posts = await prisma.post.findMany({
      where,
      take: limit + 1, // Lấy thêm 1 để biết còn trang tiếp không
      orderBy: { created_at: 'desc' },
      include: {
        page: { select: { id: true, name: true, avatar_url: true, slug: true } },
        author: {
          select: {
            id: true,
            profile: { select: { full_name: true, avatar_url: true } },
          },
        },
        event: {
          select: {
            id: true, title: true, start_time: true,
            end_time: true, location: true,
            training_points: true, status: true,
            current_slots: true, max_slots: true,
          },
        },
        likes: {
          where: { user_id: userId },
          select: { id: true },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });

    // Xác định cursor tiếp theo
    const hasMore = posts.length > limit;
    const data = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data: data.map(p => this.formatPost(p, userId)),
      next_cursor: nextCursor,
    };
  },

  // ── LẤY CHI TIẾT BÀI VIẾT ────────────────────────────────
  async getPostById(postId: string, userId: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        page: { select: { id: true, name: true, avatar_url: true, slug: true } },
        author: {
          select: {
            id: true,
            profile: { select: { full_name: true, avatar_url: true } },
          },
        },
        event: {
          select: {
            id: true, title: true, start_time: true,
            end_time: true, location: true,
            training_points: true, status: true,
          },
        },
        likes: {
          where: { user_id: userId },
          select: { id: true },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });

    if (!post) {
      throw { statusCode: 404, message: 'Không tìm thấy bài viết' };
    }

    return this.formatPost(post, userId);
  },

  // ── CẬP NHẬT BÀI VIẾT (PAGE_ADMIN) ──────────────────────
  async updatePost(postId: string, authorId: string, input: UpdatePostInput & { image_urls?: string[] }) {
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      throw { statusCode: 404, message: 'Không tìm thấy bài viết' };
    }
    if (post.author_id !== authorId) {
      throw { statusCode: 403, message: 'Bạn không có quyền chỉnh sửa bài viết này' };
    }

    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(input.content && { content: input.content }),
        ...(input.image_urls !== undefined && {
image_urls: input.image_urls && input.image_urls.length > 0 ? JSON.stringify(input.image_urls) : Prisma.JsonNull
         }),
      },
      include: {
        page: { select: { id: true, name: true, avatar_url: true } },
        author: {
          select: {
            id: true,
            profile: { select: { full_name: true, avatar_url: true } },
          },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });

    return this.formatPost(updated, authorId);
  },

  // ── XÓA BÀI VIẾT (PAGE_ADMIN) ────────────────────────────
  async deletePost(postId: string, authorId: string, role: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      throw { statusCode: 404, message: 'Không tìm thấy bài viết' };
    }

    // System Admin có thể xóa bất kỳ bài nào
    if (role !== 'SYSTEM_ADMIN' && post.author_id !== authorId) {
      throw { statusCode: 403, message: 'Bạn không có quyền xóa bài viết này' };
    }

    await prisma.post.delete({ where: { id: postId } });
  },

  // ── TOGGLE LIKE ───────────────────────────────────────────
  async toggleLike(postId: string, userId: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw { statusCode: 404, message: 'Không tìm thấy bài viết' };
    }

    const existing = await prisma.like.findUnique({
      where: { user_id_post_id: { user_id: userId, post_id: postId } },
    });

    if (existing) {
      // Đã like → unlike
      await prisma.$transaction([
        prisma.like.delete({
          where: { user_id_post_id: { user_id: userId, post_id: postId } },
        }),
        prisma.post.update({
          where: { id: postId },
          data: { likes_count: { decrement: 1 } },
        }),
      ]);
      return { liked: false, message: 'Đã bỏ thích' };
    } else {
      // Chưa like → like
      await prisma.$transaction([
        prisma.like.create({ data: { user_id: userId, post_id: postId } }),
        prisma.post.update({
          where: { id: postId },
          data: { likes_count: { increment: 1 } },
        }),
      ]);
      return { liked: true, message: 'Đã thích bài viết' };
    }
  },

  // ── TẠO BÌNH LUẬN ─────────────────────────────────────────
  async createComment(postId: string, userId: string, input: CreateCommentInput) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw { statusCode: 404, message: 'Không tìm thấy bài viết' };
    }

    // Nếu là reply, kiểm tra comment cha tồn tại và thuộc bài này
    if (input.parent_id) {
      const parent = await prisma.comment.findUnique({
        where: { id: input.parent_id },
      });
      if (!parent || parent.post_id !== postId) {
        throw { statusCode: 404, message: 'Không tìm thấy bình luận gốc' };
      }
      // Chỉ cho phép reply 1 cấp
      if (parent.parent_id) {
        throw { statusCode: 400, message: 'Chỉ được phép trả lời bình luận gốc' };
      }
    }

    const comment = await prisma.$transaction(async (tx) => {
      const newComment = await tx.comment.create({
        data: {
          post_id: postId,
          user_id: userId,
          parent_id: input.parent_id,
          content: input.content,
        },
        include: {
          user: {
            select: {
              id: true,
              profile: { select: { full_name: true, avatar_url: true, student_id: true } },
            },
          },
          _count: { select: { replies: true } },
        },
      });

      // Tăng comments_count (chỉ tính comment gốc)
      if (!input.parent_id) {
        await tx.post.update({
          where: { id: postId },
          data: { comments_count: { increment: 1 } },
        });
      }

      return newComment;
    });

    return comment;
  },

  // ── LẤY DANH SÁCH BÌNH LUẬN ──────────────────────────────
  async getComments(postId: string, query: GetCommentsQuery) {
    const { cursor, limit, parent_id } = query;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw { statusCode: 404, message: 'Không tìm thấy bài viết' };
    }

    let cursorCondition = {};
    if (cursor) {
      const cursorComment = await prisma.comment.findUnique({
        where: { id: cursor },
        select: { created_at: true },
      });
      if (cursorComment) {
        cursorCondition = { created_at: { gt: cursorComment.created_at } };
      }
    }

    const comments = await prisma.comment.findMany({
      where: {
        post_id: postId,
        parent_id: parent_id || null, // null = lấy comment gốc
        ...cursorCondition,
      },
      take: limit + 1,
      orderBy: { created_at: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { full_name: true, avatar_url: true } },
          },
        },
        _count: { select: { replies: true } },
      },
    });

    const hasMore = comments.length > limit;
    const data = hasMore ? comments.slice(0, limit) : comments;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, next_cursor: nextCursor };
  },

  // ── XÓA BÌNH LUẬN ────────────────────────────────────────
  async deleteComment(commentId: string, userId: string, role: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw { statusCode: 404, message: 'Không tìm thấy bình luận' };
    }

    if (role !== 'SYSTEM_ADMIN' && comment.user_id !== userId) {
      throw { statusCode: 403, message: 'Bạn không có quyền xóa bình luận này' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } });

      // Giảm comments_count nếu là comment gốc
      if (!comment.parent_id) {
        await tx.post.update({
          where: { id: comment.post_id },
          data: { comments_count: { decrement: 1 } },
        });
      }
    });
  },

  // ── HELPER: Format post response ─────────────────────────
  formatPost(post: any, userId: string) {
    return {
      ...post,
      // Prisma returns Json fields already parsed, so no need for JSON.parse
      image_urls: Array.isArray(post.image_urls) ? post.image_urls : [],
      is_liked: post.likes ? post.likes.length > 0 : false,
      likes_count: post._count?.likes ?? post.likes_count,
      comments_count: post._count?.comments ?? post.comments_count,
      likes: undefined,
      _count: undefined,
    };
  },
};
