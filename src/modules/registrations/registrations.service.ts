import prisma from '../../config/database';
import { GetRegistrationsQuery, UpdateRegistrationInput } from './registrations.schema';
import { notificationsService } from '../notifications/notifications.service';

export const registrationsService = {

  // ── ĐĂNG KÝ THAM GIA SỰ KIỆN (STUDENT) ──────────────────
  async registerEvent(userId: string, eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw { statusCode: 404, message: 'Không tìm thấy sự kiện' };
    }
    if (event.status !== 'APPROVED') {
      throw { statusCode: 400, message: 'Sự kiện chưa được duyệt hoặc đã đóng đăng ký' };
    }

    if (new Date() > event.registration_deadline) {
      throw { statusCode: 400, message: 'Đã hết hạn đăng ký sự kiện này' };
    }

    const existing = await prisma.registration.findUnique({
      where: { user_id_event_id: { user_id: userId, event_id: eventId } },
    });
    if (existing) {
      if (existing.status === 'CANCELLED') {
        const updated = await prisma.registration.update({
          where: { id: existing.id },
          data: { status: 'REGISTERED' },
        });

        await prisma.event.update({
          where: { id: eventId },
          data: { current_slots: { increment: 1 } },
        });

        return updated;
      }
      throw { statusCode: 409, message: 'Bạn đã đăng ký sự kiện này rồi' };
    }

    if (event.max_slots !== null && event.current_slots >= event.max_slots) {
      throw { statusCode: 400, message: 'Sự kiện đã hết chỗ đăng ký' };
    }

    const conflictingEvent = await prisma.registration.findFirst({
      where: {
        user_id: userId,
        status: { in: ['REGISTERED', 'ATTENDED'] },
        event: {
          status: 'APPROVED',
          AND: [
            { start_time: { lt: event.end_time } },
            { end_time: { gt: event.start_time } },
          ],
        },
      },
      include: { event: { select: { title: true, start_time: true } } },
    });

    if (conflictingEvent) {
      throw {
        statusCode: 400,
        message: `Bạn đã có sự kiện "${conflictingEvent.event.title}" vào thời gian này. Vui lòng hủy sự kiện kia trước khi đăng ký!`,
      };
    }

    const registration = await prisma.$transaction(async (tx) => {
      const eventData = await tx.event.findUnique({
        where: { id: eventId },
        select: { max_slots: true, current_slots: true, requires_approval: true },
      });

      if (!eventData) {
        throw { statusCode: 404, message: 'Không tìm thấy sự kiện' };
      }

      if (eventData.max_slots !== null && eventData.current_slots >= eventData.max_slots) {
        throw { statusCode: 400, message: 'Sự kiện đã hết chỗ đăng ký' };
      }

      const newReg = await tx.registration.create({
        data: {
          user_id: userId,
          event_id: eventId,
          status: 'REGISTERED',
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              start_time: true,
              end_time: true,
              location: true,
              training_points: true,
              requires_approval: true,
            },
          },
        },
      });

      try {
        await tx.event.update({
          where: {
            id: eventId,
            ...(eventData.max_slots !== null
              ? { current_slots: { lt: eventData.max_slots } }
              : {}),
          },
          data: { current_slots: { increment: 1 } },
        });
      } catch (err: any) {
        if (err.code === 'P2025' || err.meta?.cause?.code === 'P2025') {
          throw { statusCode: 400, message: 'Sự kiện đã hết chỗ đăng ký (race condition)' };
        }
        throw err;
      }

      return newReg;
    });

    if (event.max_slots !== null && event.current_slots + 1 === event.max_slots) {
      const pageAdmins = await prisma.pageMember.findMany({
        where: { page_id: event.page_id },
        select: { user_id: true },
      });
      if (pageAdmins.length > 0) {
        await Promise.all(
          pageAdmins.map(({ user_id }) =>
            notificationsService
              .notifyEventFull(user_id, event.title, eventId)
              .catch((err) => console.error('Lỗi thông báo full slot:', err))
          )
        );
      }
    }

    return registration;
  },

  // ── HỦY ĐĂNG KÝ (STUDENT) ────────────────────────────────
  async cancelRegistration(userId: string, eventId: string) {
    const registration = await prisma.registration.findUnique({
      where: { user_id_event_id: { user_id: userId, event_id: eventId } },
      include: { event: true },
    });

    if (!registration) {
      throw { statusCode: 404, message: 'Bạn chưa đăng ký sự kiện này' };
    }

    if (registration.status === 'CANCELLED') {
      throw { statusCode: 400, message: 'Đăng ký này đã được hủy trước đó' };
    }

    if (registration.status === 'ATTENDED') {
      throw { statusCode: 400, message: 'Không thể hủy đăng ký sau khi đã điểm danh' };
    }

    // Kiểm tra thời hạn hủy (trước giờ bắt đầu ít nhất 1 tiếng)
    const oneHourBeforeStart = new Date(registration.event.start_time);
    oneHourBeforeStart.setHours(oneHourBeforeStart.getHours() - 1);

    if (new Date() > oneHourBeforeStart) {
      throw {
        statusCode: 400,
        message: 'Chỉ có thể hủy đăng ký trước giờ bắt đầu sự kiện ít nhất 1 tiếng',
      };
    }

    // Hủy đăng ký + giảm slot trong 1 transaction
    await prisma.$transaction(async (tx) => {
      await tx.registration.update({
        where: { id: registration.id },
        data: { status: 'CANCELLED' },
      });

      await tx.event.update({
        where: { id: eventId },
        data: { current_slots: { decrement: 1 } },
      });
    });

    return { message: 'Hủy đăng ký thành công' };
  },

  // ── XEM LỊCH SỬ ĐĂNG KÝ CỦA BẢN THÂN (STUDENT) ──────────
  async getMyRegistrations(userId: string, query: GetRegistrationsQuery) {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      user_id: userId,
      ...(status && { status }),
    };

    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        skip,
        take: limit,
        orderBy: { registered_at: 'desc' },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              banner_url: true,
              start_time: true,
              end_time: true,
              location: true,
              training_points: true,
              status: true,
              page: { select: { id: true, name: true, avatar_url: true } },
              category: true,
              // [N+1 FIX] Gom sẵn tổng số đăng ký của sự kiện để Frontend hiển thị
              // "X/Y người đã đăng ký" mà không cần gọi thêm API đếm riêng
              _count: { select: { registrations: true } },
            },
          },
        },
      }),
      prisma.registration.count({ where }),
    ]);

    return {
      data: registrations,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  },

  // ── XEM DANH SÁCH ĐĂNG KÝ CỦA SỰ KIỆN (PAGE_ADMIN) ──────
  async getEventRegistrations(
    eventId: string,
    pageId: string,
    query: GetRegistrationsQuery
  ) {
    // Kiểm tra event thuộc page này không
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw { statusCode: 404, message: 'Không tìm thấy sự kiện' };
    }
    if (event.page_id !== pageId) {
      throw { statusCode: 403, message: 'Bạn không có quyền xem danh sách này' };
    }

    const { page, limit, status, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      event_id: eventId,
      ...(status && { status }),
      ...(search && {
        user: {
          OR: [
            { profile: { full_name: { contains: search } } },
            { profile: { student_id: { contains: search } } },
          ],
        },
      }),
    };

    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        skip,
        take: limit,
        orderBy: { registered_at: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  full_name: true,
                  student_id: true,
                  class_name: true,
                  faculty: true,
                  avatar_url: true,
                  phone: true,
                },
              },
            },
          },
        },
      }),
      prisma.registration.count({ where }),
    ]);

    return {
      data: registrations,
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
      event: {
        id: event.id,
        title: event.title,
        start_time: event.start_time,
        max_slots: event.max_slots,
        current_slots: event.current_slots,
      },
    };
  },

  // ── DUYỆT / TỪ CHỐI ĐĂNG KÝ (PAGE_ADMIN - sự kiện chọn lọc) ──
  async updateRegistrationStatus(
    registrationId: string,
    pageId: string,
    input: UpdateRegistrationInput
  ) {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { event: true },
    });

    if (!registration) {
      throw { statusCode: 404, message: 'Không tìm thấy đăng ký' };
    }
    if (registration.event.page_id !== pageId) {
      throw { statusCode: 403, message: 'Bạn không có quyền thao tác' };
    }
    if (!registration.event.requires_approval) {
      throw { statusCode: 400, message: 'Sự kiện này không yêu cầu duyệt đăng ký' };
    }

    return prisma.registration.update({
      where: { id: registrationId },
      data: { status: input.status },
    });
  },
};