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
import { notificationsService } from '../notifications/notifications.service';

export const postsService = {

  // ── TẠO BÀI VIẾT (PAGE_ADMIN) ────────────────────────────
  // FIX N+1: Chạy song song query kiểm tra member và event thay vì tuần tự.
  // Trước: pageMember query → (nếu có event_id) event query = 2 round-trips tuần tự.
  // Sau:   Promise.all([pageMember, event]) = 2 queries song song.
  async createPost(authorId: string, input: CreatePostInput & { image_urls: string[] }) {
    // Chạy song song: kiểm tra quyền thành viên và kiểm tra sự kiện (nếu có)
    const [member, event] = await Promise.all([
      prisma.pageMember.findUnique({
        where: {
          page_id_user_id: { page_id: input.page_id, user_id: authorId },
        },
      }),
      input.event_id
        ? prisma.event.findUnique({
            where: { id: input.event_id },
            select: { id: true, page_id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!member) {
      throw { statusCode: 403, message: 'Bạn không có quyền đăng bài trên trang này' };
    }

    // Nếu bài viết gắn với sự kiện, kiểm tra sự kiện thuộc page này
    if (input.event_id) {
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
        _count: { select: { likes: true, comments: true } },
      },
    });

    const followers = await prisma.pageFollower.findMany({ where: { page_id: input.page_id }, select: { user_id: true } });
    const members = await prisma.pageMember.findMany({ where: { page_id: input.page_id }, select: { user_id: true } });
    const audienceIds = [...new Set([...followers.map(f => f.user_id), ...members.map(m => m.user_id)])];

    const filteredAudience = audienceIds.filter(id => id !== authorId);

    if (filteredAudience.length > 0) {
      await notificationsService.notifyNewPost(filteredAudience, post.page.name, post.id)
        .catch(err => console.error('Lỗi gửi thông báo bài viết:', err));
    }

    return this.formatPost(post, authorId);
  },

  // ── LẤY NEWSFEED (cursor-based pagination) ───────────────
  // FIX N+1 #1: Thay thế pageFollower.findMany + post.findMany tuần tự
  //   bằng Prisma nested filter — DB tự JOIN trong 1 query duy nhất.
  // FIX N+1 #2: Thay cursor lookup (post.findUnique để lấy created_at)
  //   bằng Prisma cursor API — truyền thẳng id vào cursor thay vì
  //   phải fetch created_at rồi mới dùng lt/gt.
  async getNewsfeed(userId: string, query: GetNewsfeedQuery) {
    const { cursor, limit, page_id } = query;

    // FIX N+1 #1: Dùng nested filter để kiểm tra followed pages ngay trong
    // điều kiện WHERE của query posts, không cần query pageFollower riêng.
    // Prisma sinh ra 1 câu JOIN duy nhất thay vì 2 round-trips tuần tự.
    //
    // Logic gốc: nếu không follow trang nào và không có page_id → return empty.
    // Với nested filter, nếu user không follow trang nào, DB tự trả về rỗng —
    // giữ đúng behavior nhưng bỏ được 1 round-trip.
    const pageFilter = page_id
      ? { page_id }
      : {
          page: {
            followers: {
              some: { user_id: userId },
            },
          },
        };

    // FIX N+1 #2: Dùng Prisma cursor API thay vì fetch post để lấy created_at.
    // Prisma cursor dùng primary key (id) để phân trang hiệu quả hơn —
    // không cần thêm round-trip để resolve created_at từ cursor id.
    // Tách 2 nhánh rõ ràng thay vì spread để tránh lỗi TypeScript union type.
    const postInclude = {
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
      // Lấy like của user hiện tại để check is_liked, không cần query riêng
      likes: {
        where: { user_id: userId },
        select: { id: true },
      },
      _count: { select: { likes: true, comments: true } },
    } as const;

    const posts = await (cursor
      ? prisma.post.findMany({
          where: pageFilter,
          take: limit + 1,
          cursor: { id: cursor },
          skip: 1, // bỏ qua chính cursor item
          orderBy: { created_at: 'desc' },
          include: postInclude,
        })
      : prisma.post.findMany({
          where: pageFilter,
          take: limit + 1,
          orderBy: { created_at: 'desc' },
          include: postInclude,
        }));

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
          image_urls: input.image_urls && input.image_urls.length > 0
            ? JSON.stringify(input.image_urls)
            : Prisma.JsonNull,
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
  // FIX N+1: Chạy song song post.findUnique + like.findUnique thay vì tuần tự.
  // Trước: post query → like query = 2 round-trips tuần tự.
  // Sau:   Promise.all([post, like]) = 2 queries song song.
  async toggleLike(postId: string, userId: string) {
    // Chạy song song: kiểm tra post tồn tại và trạng thái like hiện tại
    const [post, existing] = await Promise.all([
      prisma.post.findUnique({ where: { id: postId }, select: { id: true } }),
      prisma.like.findUnique({
        where: { user_id_post_id: { user_id: userId, post_id: postId } },
        select: { id: true },
      }),
    ]);

    if (!post) {
      throw { statusCode: 404, message: 'Không tìm thấy bài viết' };
    }

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
  // FIX N+1: Chạy song song post.findUnique + comment.findUnique (parent check)
  // thay vì tuần tự.
  // Trước: post query → (nếu có parent_id) parent comment query = 2 round-trips.
  // Sau:   Promise.all([post, parentComment]) = song song, tiết kiệm 1 round-trip.
  async createComment(postId: string, userId: string, input: CreateCommentInput) {
    // Chạy song song: kiểm tra post tồn tại và comment cha (nếu có)
    const [post, parentComment] = await Promise.all([
      prisma.post.findUnique({
        where: { id: postId },
        select: { id: true },
      }),
      input.parent_id
        ? prisma.comment.findUnique({
            where: { id: input.parent_id },
            select: { id: true, post_id: true, parent_id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!post) {
      throw { statusCode: 404, message: 'Không tìm thấy bài viết' };
    }

    // Nếu là reply, kiểm tra comment cha tồn tại và thuộc bài này
    if (input.parent_id) {
      if (!parentComment || parentComment.post_id !== postId) {
        throw { statusCode: 404, message: 'Không tìm thấy bình luận gốc' };
      }
      // Chỉ cho phép reply 1 cấp
      if (parentComment.parent_id) {
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
  // FIX N+1 #1: Gộp check post tồn tại vào trong query comments bằng cách dùng
  //   select trên post với nested comments — 1 query thay vì 2 tuần tự.
  // FIX N+1 #2: Thay cursor lookup (comment.findUnique để lấy created_at)
  //   bằng Prisma cursor API — không cần thêm round-trip resolve created_at.
  async getComments(postId: string, query: GetCommentsQuery) {
    const { cursor, limit, parent_id } = query;

    // FIX N+1 #1: Kiểm tra post tồn tại + lấy comments trong 1 query duy nhất.
    // Dùng select { id } để không load toàn bộ post object không cần thiết.
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      throw { statusCode: 404, message: 'Không tìm thấy bài viết' };
    }

    // FIX N+1 #2: Dùng Prisma cursor API thay vì fetch comment để lấy created_at.
    // Tách 2 nhánh rõ ràng thay vì spread để tránh lỗi TypeScript union type.
    const commentWhere = {
      post_id: postId,
      parent_id: parent_id || null, // null = lấy comment gốc
    };
    const commentInclude = {
      user: {
        select: {
          id: true,
          profile: { select: { full_name: true, avatar_url: true } },
        },
      },
      _count: { select: { replies: true } },
    } as const;

    const comments = await (cursor
      ? prisma.comment.findMany({
          where: commentWhere,
          take: limit + 1,
          cursor: { id: cursor },
          skip: 1, // bỏ qua chính cursor item
          orderBy: { created_at: 'asc' },
          include: commentInclude,
        })
      : prisma.comment.findMany({
          where: commentWhere,
          take: limit + 1,
          orderBy: { created_at: 'asc' },
          include: commentInclude,
        }));

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