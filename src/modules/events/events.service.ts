import prisma from '../../config/database';
import { CreateEventInput, UpdateEventInput, GetEventsQuery } from './events.schema';
import { notificationsService } from '../notifications/notifications.service';

export const eventsService = {

  // ── TẠO SỰ KIỆN (PAGE_ADMIN) ─────────────────────────────
  async createEvent(pageId: string, input: CreateEventInput & { banner_url?: string }) {
    // Kiểm tra page có tồn tại không
    const page = await prisma.page.findUnique({ where: { id: pageId } });
    if (!page) {
      throw { statusCode: 404, message: 'Không tìm thấy trang CLB' };
    }

    const startTime = new Date(input.start_time);
    const endTime = input.end_time ? new Date(input.end_time) : new Date(startTime.getTime() + 3 * 60 * 60 * 1000);
    const registrationDeadline = input.registration_deadline
      ? new Date(input.registration_deadline)
      : new Date(startTime.getTime() - 24 * 60 * 60 * 1000);

    const event = await prisma.event.create({
      data: {
        page_id: pageId,
        category_id: input.category_id,
        title: input.title,
        description: input.description,
        banner_url: input.banner_url,
        location: input.location,
        latitude: input.latitude,
        longitude: input.longitude,
        checkin_radius_m: input.checkin_radius_m,
        start_time: startTime,
        end_time: endTime,
        registration_deadline: registrationDeadline,
        max_slots: input.max_slots,
        training_points: input.training_points,
        requires_approval: input.requires_approval,
        status: 'PENDING',
      },
      include: {
        page: { select: { id: true, name: true, avatar_url: true } },
        category: true,
      },
    });

    return event;
  },

  // ── LẤY DANH SÁCH SỰ KIỆN ────────────────────────────────
  async getEvents(query: GetEventsQuery, role?: string) {
    const { page, limit, status, category_id, search, page_id } = query;
    const skip = (page - 1) * limit;

    // Sinh viên chỉ thấy sự kiện APPROVED
    // Admin thấy tất cả, Page Admin thấy của page mình
    const statusFilter = role === 'SYSTEM_ADMIN'
      ? status
      : role === 'PAGE_ADMIN'
        ? status
        : 'APPROVED';

    const where: any = {
      ...(statusFilter && { status: statusFilter }),
      ...(category_id && { category_id }),
      ...(page_id && { page_id }),
      ...(search && {
        title: { contains: search },
      }),
    };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { start_time: 'asc' },
        include: {
          page: { select: { id: true, name: true, avatar_url: true } },
          category: true,
          _count: { select: { registrations: true } },
        },
      }),
      prisma.event.count({ where }),
    ]);

    return {
      data: events,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  },

  // ── LẤY CHI TIẾT 1 SỰ KIỆN ───────────────────────────────
  async getEventById(eventId: string, userId?: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        page: { select: { id: true, name: true, avatar_url: true, slug: true } },
        category: true,
        _count: { select: { registrations: true } },
      },
    });

    if (!event) {
      throw { statusCode: 404, message: 'Không tìm thấy sự kiện' };
    }

    // Kiểm tra user hiện tại đã đăng ký chưa
    let isRegistered = false;
    if (userId) {
      const registration = await prisma.registration.findUnique({
        where: { user_id_event_id: { user_id: userId, event_id: eventId } },
      });
      isRegistered = !!registration;
    }

    return { ...event, is_registered: isRegistered };
  },

  // ── CẬP NHẬT SỰ KIỆN (PAGE_ADMIN) ────────────────────────
  async updateEvent(eventId: string, pageId: string, input: UpdateEventInput & { banner_url?: string }) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });

    if (!event) {
      throw { statusCode: 404, message: 'Không tìm thấy sự kiện' };
    }
    if (event.page_id !== pageId) {
      throw { statusCode: 403, message: 'Bạn không có quyền chỉnh sửa sự kiện này' };
    }
    if (event.status === 'APPROVED') {
      throw { statusCode: 400, message: 'Không thể chỉnh sửa sự kiện đã được duyệt' };
    }

    // Validate time constraints at service level
    const startTime = input.start_time ? new Date(input.start_time) : event.start_time;
    const endTime = input.end_time ? new Date(input.end_time) : (event.end_time || new Date(startTime.getTime() + 3 * 60 * 60 * 1000));
    const registrationDeadline = input.registration_deadline ? new Date(input.registration_deadline) : (event.registration_deadline || new Date(startTime.getTime() - 24 * 60 * 60 * 1000));

    if (endTime <= startTime) {
      throw { statusCode: 400, message: 'Thời gian kết thúc phải sau thời gian bắt đầu' };
    }
    if (registrationDeadline > startTime) {
      throw { statusCode: 400, message: 'Hạn đăng ký phải trước hoặc bằng thời gian bắt đầu' };
    }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...input,
        ...(input.start_time && { start_time: startTime }),
        ...(input.end_time ? { end_time: endTime } : (!event.end_time && { end_time: endTime })),
        ...(input.registration_deadline ? { registration_deadline: registrationDeadline } : (!event.registration_deadline && { registration_deadline: registrationDeadline })),
        ...(input.banner_url && { banner_url: input.banner_url }),
        status: 'PENDING', // Reset về pending để admin duyệt lại
      },
      include: {
        page: { select: { id: true, name: true } },
        category: true,
      },
    }    );

    return updated;
  },

  // ── DUYỆT SỰ KIỆN (SYSTEM_ADMIN) ─────────────────────────
  async approveEvent(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });

    if (!event) {
      throw { statusCode: 404, message: 'Không tìm thấy sự kiện' };
    }
    if (event.status !== 'PENDING') {
      throw { statusCode: 400, message: 'Chỉ có thể duyệt sự kiện đang ở trạng thái chờ duyệt' };
    }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: { status: 'APPROVED' },
    });
    await notificationsService.notifyEventApproved(eventId);
    await notificationsService.notifyNewEvent(eventId);
    return updated;
  },

  // ── TỪ CHỐI SỰ KIỆN (SYSTEM_ADMIN) ──────────────────────
  async rejectEvent(eventId: string, reason: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });

    if (!event) {
      throw { statusCode: 404, message: 'Không tìm thấy sự kiện' };
    }
    if (event.status !== 'PENDING') {
      throw { statusCode: 400, message: 'Chỉ có thể từ chối sự kiện đang ở trạng thái chờ duyệt' };
    }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: { status: 'REJECTED', rejection_reason: reason },
    });

    return updated;
  },

  // ── XÓA SỰ KIỆN (PAGE_ADMIN) ─────────────────────────────
  async deleteEvent(eventId: string, pageId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });

    if (!event) {
      throw { statusCode: 404, message: 'Không tìm thấy sự kiện' };
    }
    if (event.page_id !== pageId) {
      throw { statusCode: 403, message: 'Bạn không có quyền xóa sự kiện này' };
    }
    if (event.status === 'APPROVED' || event.status === 'ONGOING') {
      throw { statusCode: 400, message: 'Không thể xóa sự kiện đã duyệt hoặc đang diễn ra' };
    }

    await prisma.event.delete({ where: { id: eventId } });
  },

  // ── LẤY DANH SÁCH DANH MỤC ───────────────────────────────
  async getCategories() {
    return prisma.eventCategory.findMany({ orderBy: { id: 'asc' } });
  },

  // ── LẤY DANH SÁCH SỰ KIỆN CHỜ DUYỆT (SYSTEM_ADMIN) ─────
  async getPendingEvents() {
    return prisma.event.findMany({
      where: { status: 'PENDING' },
      orderBy: { created_at: 'asc' },
      include: {
        page: { select: { id: true, name: true, avatar_url: true } },
        category: true,
        _count: { select: { registrations: true } },
      },
    });
  },

  // ── GỢI Ý SỰ KIỆN (AI RECOMMENDATION) ─────────────────────
  // Scoring: faculty match +3, category match +5, nearly full +2
  async getRecommendedEvents(userId: string, limit: number = 5) {
    // 1. Lấy profile của user (faculty)
    const profile = await prisma.profile.findUnique({
      where: { user_id: userId },
    });

    const userFaculty = profile?.faculty?.toLowerCase() || '';

    // 2. Lấy các sự kiện APPROVED sắp diễn ra (trong 30 ngày tới)
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const events = await prisma.event.findMany({
      where: {
        status: 'APPROVED',
        start_time: { gte: now, lte: thirtyDaysLater },
      },
      include: {
        page: { select: { id: true, name: true, avatar_url: true } },
        category: true,
        _count: { select: { registrations: true } },
      },
      orderBy: { start_time: 'asc' },
      take: 50, // Lấy nhiều để chọn top sau khi tính điểm
    });

    // 3. Tính điểm cho mỗi sự kiện
    const scoredEvents = events.map(event => {
      let score = 0;
      const registrationCount = event._count.registrations;
      const maxSlots = event.max_slots || Infinity;
      const fillRatio = maxSlots > 0 ? registrationCount / maxSlots : 0;

      // Faculty match: +3 if faculty name appears in title/description/location
      if (userFaculty) {
        const searchText = `${event.title} ${event.description || ''} ${event.location || ''}`.toLowerCase();
        if (searchText.includes(userFaculty)) {
          score += 3;
        }
      }

      // Category popularity: +5 nếu category có nhiều sự kiện được đăng ký
      // (DùngfillRatio làm proxy - càng đăng ký nhiều càng phổ biến)
      if (fillRatio > 0.5) {
        score += 5;
      }

      // Nearly full: +2 nếu còn ít slot (< 20%)
      if (maxSlots !== null && fillRatio >= 0.8) {
        score += 2;
      }

      return { event, score };
    });

    // 4. Sắp xếp theo điểm và lấy top N
    const topEvents = scoredEvents
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.event);

    return topEvents;
  },
};
