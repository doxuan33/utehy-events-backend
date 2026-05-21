import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { CreateNotificationInput, GetNotificationsQuery } from './notifications.schema';

// Map lưu SSE clients: userId → Response object
const sseClients = new Map<string, any>();

export const notificationsService = {

  // ── BASE FUNCTIONS ───────────────────────────────────────
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
    this.pushToClient(input.user_id, notification);
    return notification;
  },

  async createBulkNotifications(userIds: string[], input: Omit<CreateNotificationInput, 'user_id'>) {
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
    userIds.forEach(userId => this.pushToClient(userId, { ...input, user_id: userId }));
  },

  async getMyNotifications(userId: string, query: GetNotificationsQuery) {
    const { page = 1, limit = 20, is_read } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.NotificationWhereInput = { user_id: userId };
    if (is_read !== undefined) where.is_read = is_read;

    const [data, total, unread_count] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { created_at: 'desc' }, skip, take: limit }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { user_id: userId, is_read: false } }),
    ]);

    return { data, meta: { total, page, limit, unread_count } };
  },

  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({ where: { user_id: userId, is_read: false } });
    return { unread_count: count };
  },

  async markAsRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { is_read: true },
    });
  },

  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });
    return { updated_count: result.count };
  },

  async deleteNotification(notificationId: string, userId: string) {
    return prisma.notification.deleteMany({
      where: { id: notificationId, user_id: userId },
    });
  },

  registerClient(userId: string, res: any) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const initialData = { type: 'CONNECTED', message: 'SSE Connection Established' };
    res.write(`data: ${JSON.stringify(initialData)}\n\n`);

    sseClients.set(userId, res);
    const keepAlive = setInterval(() => { res.write(': keep-alive\n\n'); }, 30000);

    res.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(userId);
    });
  },

  pushToClient(userId: string, data: any) {
    const client = sseClients.get(userId);
    if (client) {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  },

  // ── NHÓM A: SỰ KIỆN & ĐIỂM DANH ───────────────────────
  async notifyMandatoryEvent(studentIds: string[], eventName: string, eventId: string) {
    await this.createBulkNotifications(studentIds, {
      type: 'MANDATORY_EVENT',
      title: '📌 Bắt buộc tham gia sự kiện',
      body: `Bạn đã được thêm vào danh sách BẮT BUỘC tham gia sự kiện ${eventName}. Vui lòng kiểm tra lịch trình!`,
      data: { event_id: eventId },
    });
  },

  async notifyGlobalEvent(pageName: string, eventName: string, eventId: string) {
    const allStudents = await prisma.user.findMany({ where: { role: 'STUDENT' }, select: { id: true } });
    const studentIds = allStudents.map(s => s.id);
    await this.createBulkNotifications(studentIds, {
      type: 'GLOBAL_EVENT',
      title: '📣 Sự kiện Toàn trường mới!',
      body: `${pageName} vừa tổ chức sự kiện toàn trường: ${eventName}. Khám phá ngay!`,
      data: { event_id: eventId },
    });
  },

  async notifyCheckinSuccess(userId: string, eventName: string, points: number, eventId: string) {
    await this.createNotification({
      user_id: userId,
      type: 'CHECKIN_SUCCESS',
      title: '✅ Điểm danh thành công!',
      body: `Bạn vừa được cộng ${points} điểm rèn luyện từ sự kiện ${eventName}.`,
      data: { event_id: eventId },
    });
  },

  async notifyEventUpdateOrCancel(studentIds: string[], eventName: string, eventId: string, isCancelled: boolean) {
    const statusTxt = isCancelled ? 'đã bị hủy' : 'vừa có sự thay đổi';
    await this.createBulkNotifications(studentIds, {
      type: isCancelled ? 'EVENT_CANCEL' : 'EVENT_UPDATE',
      title: `⚠️ Cập nhật sự kiện ${eventName}`,
      body: `Sự kiện ${eventName} mà bạn đã đăng ký ${statusTxt}. Vui lòng xem chi tiết!`,
      data: { event_id: eventId },
    });
  },

  async notifyEventReminder(studentIds: string[], eventName: string, eventId: string) {
    await this.createBulkNotifications(studentIds, {
      type: 'EVENT_REMINDER',
      title: '⏰ Nhắc nhở sự kiện',
      body: `Sự kiện ${eventName} sẽ diễn ra vào ngày mai. Đừng quên tham gia nhé!`,
      data: { event_id: eventId },
    });
  },

  // ── NHÓM B & C: CLB & GAMIFICATION ────────────────────
  async notifyClubJoinResult(userId: string, pageName: string, pageId: string, isApproved: boolean) {
    await this.createNotification({
      user_id: userId,
      type: 'CLUB_JOIN_RESULT',
      title: isApproved ? '🎉 Chúc mừng!' : '❌ Rất tiếc',
      body: isApproved 
        ? `Yêu cầu tham gia Câu lạc bộ ${pageName} của bạn đã được phê duyệt.`
        : `Yêu cầu tham gia Câu lạc bộ ${pageName} của bạn chưa được phê duyệt lần này.`,
      data: { page_id: pageId },
    });
  },

  async notifyNewPost(followerIds: string[], pageName: string, postId: string) {
    await this.createBulkNotifications(followerIds, {
      type: 'NEW_POST',
      title: `📰 Thông báo mới từ ${pageName}`,
      body: `${pageName} vừa đăng một thông báo mới. Bấm để xem chi tiết.`,
      data: { post_id: postId },
    });
  },

  async notifyBadgeUnlocked(userId: string, badgeName: string) {
    await this.createNotification({
      user_id: userId,
      type: 'BADGE_UNLOCKED',
      title: '🏅 Huy hiệu mới!',
      body: `Tuyệt vời! Bạn vừa mở khóa huy hiệu danh giá: ${badgeName}.`,
    });
  },

  // ── NHÓM D: PAGE ADMIN ────────────────────────────────
  async notifyNewJoinRequest(pageAdminId: string, studentName: string, pageId: string) {
    await this.createNotification({
      user_id: pageAdminId,
      type: 'NEW_JOIN_REQUEST',
      title: '👋 Yêu cầu tham gia mới',
      body: `Sinh viên ${studentName} vừa gửi yêu cầu gia nhập Câu lạc bộ của bạn. Hãy xét duyệt ngay.`,
      data: { page_id: pageId },
    });
  },

  async notifyEventApprovalResult(pageAdminId: string, eventName: string, eventId: string, isApproved: boolean, reason?: string) {
    await this.createNotification({
      user_id: pageAdminId,
      type: isApproved ? 'EVENT_APPROVED' : 'EVENT_REJECTED',
      title: isApproved ? '✅ Sự kiện đã được duyệt' : '🚫 Sự kiện bị từ chối',
      body: isApproved 
        ? `Sự kiện ${eventName} của bạn đã được hệ thống phê duyệt và xuất bản.`
        : `Sự kiện ${eventName} đã bị từ chối. Lý do: ${reason || 'Không xác định'}. Vui lòng chỉnh sửa lại.`,
      data: { event_id: eventId },
    });
  },

  async notifyEventFull(pageAdminId: string, eventName: string, eventId: string) {
    await this.createNotification({
      user_id: pageAdminId,
      type: 'EVENT_FULL',
      title: '🔥 Sự kiện đã đầy!',
      body: `Sự kiện ${eventName} đã đạt đủ số lượng người đăng ký tối đa.`,
      data: { event_id: eventId },
    });
  },

  // ── NHÓM E: SYSTEM ADMIN ──────────────────────────────
  async notifyNewEventRequest(systemAdminIds: string[], pageName: string, eventName: string, eventId: string) {
    await this.createBulkNotifications(systemAdminIds, {
      type: 'NEW_EVENT_REQUEST',
      title: '📝 Yêu cầu duyệt sự kiện',
      body: `Page ${pageName} vừa gửi yêu cầu xuất bản sự kiện mới: ${eventName}. Vui lòng kiểm duyệt.`,
      data: { event_id: eventId },
    });
  },

  // ── XÓA TẤT CẢ THÔNG BÁO ĐÃ ĐỌC ─────────────────────────
  async deleteAllRead(userId: string) {
    const result = await prisma.notification.deleteMany({
      where: { user_id: userId, is_read: true },
    });
    return { deleted_count: result.count };
  },
  
  async notifyNewClubRequest(systemAdminIds: string[], studentName: string) {
    await this.createBulkNotifications(systemAdminIds, {
      type: 'NEW_CLUB_REQUEST',
      title: '🏢 Yêu cầu thành lập CLB',
      body: `Có một yêu cầu thành lập Câu lạc bộ/Trang mới từ người dùng ${studentName}.`,
    });
  }
};