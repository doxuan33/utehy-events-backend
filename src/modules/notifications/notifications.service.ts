import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { CreateNotificationInput, GetNotificationsQuery } from './notifications.schema';

// Map lưu SSE clients: userId → Response object
const sseClients = new Map<string, any>();

export const notificationsService = {

  // ── TẠO THÔNG BÁO (dùng nội bộ từ các module khác) ───────
  async createNotification(input: CreateNotificationInput) {
    const notification = await prisma.notification.create({
      data: {
        user_id: input.user_id,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ? JSON.stringify(input.data) : Prisma.JsonNull,
      },
    });

    // Đẩy realtime qua SSE nếu user đang online
    this.pushToClient(input.user_id, notification);

    return notification;
  },

  // ── TẠO THÔNG BÁO CHO NHIỀU USER CÙNG LÚC ───────────────
  async createBulkNotifications(
    userIds: string[],
    input: Omit<CreateNotificationInput, 'user_id'>
  ) {
    if (userIds.length === 0) return;

    await prisma.notification.createMany({
      data: userIds.map(userId => ({
        user_id: userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ? JSON.stringify(input.data) : Prisma.JsonNull,
      })),
    });

    // Đẩy realtime cho từng user đang online
    userIds.forEach(userId => {
      this.pushToClient(userId, {
        type: input.type,
        title: input.title,
        body: input.body,
      });
    });
  },

  // ── LẤY DANH SÁCH THÔNG BÁO CỦA BẢN THÂN ────────────────
  async getMyNotifications(userId: string, query: GetNotificationsQuery) {
    const { page, limit, is_read } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      user_id: userId,
      ...(is_read !== undefined && { is_read }),
    };

    const [notifications, total, unread_count] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { user_id: userId, is_read: false },
      }),
    ]);

     return {
       data: notifications.map(n => ({
         ...n,
         // Prisma returns Json fields already parsed
         data: n.data || null,
       })),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        unread_count,
      },
    };
  },

  // ── ĐỌC 1 THÔNG BÁO ──────────────────────────────────────
  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw { statusCode: 404, message: 'Không tìm thấy thông báo' };
    }
    if (notification.user_id !== userId) {
      throw { statusCode: 403, message: 'Bạn không có quyền truy cập thông báo này' };
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { is_read: true },
    });
  },

  // ── ĐỌC TẤT CẢ THÔNG BÁO ─────────────────────────────────
  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });

    return { updated_count: result.count };
  },

  // ── XÓA THÔNG BÁO ────────────────────────────────────────
  async deleteNotification(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw { statusCode: 404, message: 'Không tìm thấy thông báo' };
    }
    if (notification.user_id !== userId) {
      throw { statusCode: 403, message: 'Bạn không có quyền xóa thông báo này' };
    }

    await prisma.notification.delete({ where: { id: notificationId } });
  },

  // ── XÓA TẤT CẢ THÔNG BÁO ĐÃ ĐỌC ─────────────────────────
  async deleteAllRead(userId: string) {
    const result = await prisma.notification.deleteMany({
      where: { user_id: userId, is_read: true },
    });

    return { deleted_count: result.count };
  },

  // ── ĐẾM THÔNG BÁO CHƯA ĐỌC ───────────────────────────────
  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });

    return { unread_count: count };
  },

  // ── SSE: Đăng ký kết nối realtime ────────────────────────
  registerClient(userId: string, res: any) {
    // Thiết lập SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Tắt buffering cho Nginx
    res.flushHeaders();

    // Lưu client vào map
    sseClients.set(userId, res);

    // Gửi thông báo kết nối thành công
    res.write(`data: ${JSON.stringify({
      type: 'CONNECTED',
      message: 'Kết nối thông báo realtime thành công',
    })}\n\n`);

    // Gửi số thông báo chưa đọc ngay khi kết nối
    prisma.notification.count({
      where: { user_id: userId, is_read: false },
    }).then(count => {
      res.write(`data: ${JSON.stringify({
        type: 'UNREAD_COUNT',
        unread_count: count,
      })}\n\n`);
    });

    // Heartbeat mỗi 30 giây để giữ kết nối
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);

    // Khi client ngắt kết nối
    res.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(userId);
    });
  },

  // ── SSE: Đẩy thông báo đến client ────────────────────────
  pushToClient(userId: string, data: any) {
    const client = sseClients.get(userId);
    if (client) {
      try {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
        sseClients.delete(userId);
      }
    }
  },

  // ── GỬI THÔNG BÁO SỰ KIỆN MỚI ĐẾN FOLLOWERS ─────────────
  async notifyNewEvent(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { page: true },
    });

    if (!event) return;

    // Lấy tất cả followers của page này
    const followers = await prisma.pageFollower.findMany({
      where: { page_id: event.page_id },
      select: { user_id: true },
    });

    const userIds = followers.map(f => f.user_id);

    await this.createBulkNotifications(userIds, {
      type: 'EVENT_NEW',
      title: `🎉 Sự kiện mới từ ${event.page.name}`,
      body: event.title,
      data: { event_id: eventId, page_id: event.page_id },
    });
  },

  // ── GỬI THÔNG BÁO SỰ KIỆN ĐƯỢC DUYỆT ĐẾN PAGE ADMIN ─────
  async notifyEventApproved(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        page: {
          include: { members: { select: { user_id: true } } },
        },
      },
    });

    if (!event) return;

    const memberIds = event.page.members.map(m => m.user_id);

    await this.createBulkNotifications(memberIds, {
      type: 'EVENT_APPROVED',
      title: '✅ Sự kiện đã được duyệt',
      body: `Sự kiện "${event.title}" đã được phê duyệt và hiện trên Newsfeed`,
      data: { event_id: eventId },
    });
  },

  // ── GỬI THÔNG BÁO ĐIỂM DANH THÀNH CÔNG ──────────────────
  async notifyCheckinSuccess(userId: string, eventTitle: string, points: number) {
    await this.createNotification({
      user_id: userId,
      type: 'CHECKIN_SUCCESS',
      title: '✅ Điểm danh thành công',
      body: `Bạn đã điểm danh sự kiện "${eventTitle}" và nhận được +${points} điểm rèn luyện`,
      data: { points_earned: points },
    });
  },
};