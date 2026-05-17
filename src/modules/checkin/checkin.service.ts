import prisma from '../../config/database';
import { qrService } from './qr.service';
import { haversineDistance } from '../../shared/utils/geoHelper';
import { usersService } from '../users/users.service';
import { ScanQrInput, ManualCheckinInput, GpsCheckinInput, ImportCheckinInput } from './checkin.schema';
import { notificationsService } from '../notifications/notifications.service';

export const checkinService = {

  // ── QUÉT MÃ QR (STUDENT) ─────────────────────────────────
  async scanQr(userId: string, input: ScanQrInput) {
    const qrToken = await qrService.verifyToken(input.token);
    const event = qrToken.event;

    if (event.status !== 'ONGOING') {
      throw { statusCode: 400, message: 'Sự kiện chưa bắt đầu hoặc đã kết thúc điểm danh' };
    }

    if (
      event.latitude !== null &&
      event.longitude !== null &&
      input.latitude !== undefined &&
      input.longitude !== undefined
    ) {
      const distance = haversineDistance(
        input.latitude,
        input.longitude,
        Number(event.latitude),
        Number(event.longitude)
      );

      if (distance > event.checkin_radius_m) {
        throw {
          statusCode: 400,
          message: `Bạn đang ở cách sự kiện ${Math.round(distance)}m. Vui lòng đến gần hơn (trong vòng ${event.checkin_radius_m}m)`,
        };
      }
    }

     const registration = await prisma.registration.findUnique({
       where: { user_id_event_id: { user_id: userId, event_id: event.id } },
     });

     if (registration?.status === 'ATTENDED') {
       throw { statusCode: 409, message: 'Bạn đã điểm danh sự kiện này rồi' };
     }

     if (registration?.status === 'CANCELLED') {
       throw { statusCode: 403, message: 'Đăng ký của bạn đã bị hủy' };
     }

     const result = await prisma.$transaction(async (tx) => {
       // Tự động đăng ký nếu chưa có, hoặc cập nhật nếu đã có
       const updatedRegistration = await tx.registration.upsert({
         where: { user_id_event_id: { user_id: userId, event_id: event.id } },
         update: { status: 'ATTENDED' },
         create: { user_id: userId, event_id: event.id, status: 'ATTENDED' },
       });

       const checkin = await tx.checkin.create({
         data: {
           registration_id: updatedRegistration.id,
           user_id: userId,
           qr_token_id: qrToken.id,
           method: 'QR_SCAN',
           checkin_lat: input.latitude,
           checkin_lng: input.longitude,
           points_awarded: event.training_points,
         },
       });

       await tx.profile.update({
         where: { user_id: userId },
         data: { training_points: { increment: event.training_points } },
       });
       return checkin;
     });

    await usersService.checkAndAwardBadges(userId);
    await notificationsService.notifyCheckinSuccess(
        userId,
        event.title,
        event.training_points
    );

    const profile = await prisma.profile.findUnique({
        where: { user_id: userId },
        select: { training_points: true, full_name: true },
        });

        return {
        success: true,
        message: `Điểm danh thành công! +${event.training_points} điểm rèn luyện`,
        points_earned: event.training_points,
        total_points: profile?.training_points ?? 0,
        student_name: profile?.full_name,
        event_title: event.title,
        checked_in_at: result.checked_in_at,
    };
  },

  // ── ĐIỂM DANH GPS (STUDENT - BẮT BUỘC CÓ TỌA ĐỘ) ───────────
  async gpsCheckin(userId: string, input: GpsCheckinInput) {
    const qrToken = await qrService.verifyToken(input.token);
    const event = qrToken.event;

    if (event.status !== 'ONGOING') {
      throw { statusCode: 400, message: 'Sự kiện chưa bắt đầu hoặc đã kết thúc điểm danh' };
    }

    if (!event.latitude || !event.longitude) {
      throw { statusCode: 400, message: 'Sự kiện chưa có tọa độ' };
    }

    const eventLat = Number(event.latitude);
    const eventLng = Number(event.longitude);
    const distance = haversineDistance(input.lat, input.lng, eventLat, eventLng);

    const radius = event.checkin_radius_m || 200;
    if (distance > radius) {
      throw { 
        statusCode: 400, 
        message: `Bạn đang ở quá xa sự kiện (cách ${distance.toFixed(0)}m, bán kính ${radius}m)` 
      };
    }

     const registration = await prisma.registration.findUnique({
       where: { user_id_event_id: { user_id: userId, event_id: event.id } },
     });

     if (registration?.status === 'ATTENDED') {
       throw { statusCode: 409, message: 'Bạn đã điểm danh sự kiện này rồi' };
     }

     if (registration?.status === 'CANCELLED') {
       throw { statusCode: 403, message: 'Đăng ký của bạn đã bị hủy' };
     }

     const result = await prisma.$transaction(async (tx) => {
       // Tự động đăng ký nếu chưa có, hoặc cập nhật nếu đã có
       const updatedRegistration = await tx.registration.upsert({
         where: { user_id_event_id: { user_id: userId, event_id: event.id } },
         update: { status: 'ATTENDED' },
         create: { user_id: userId, event_id: event.id, status: 'ATTENDED' },
       });

       const checkin = await tx.checkin.create({
         data: {
           registration_id: updatedRegistration.id,
           user_id: userId,
           qr_token_id: qrToken.id,
           method: 'QR_SCAN',
           checkin_lat: input.lat,
           checkin_lng: input.lng,
           points_awarded: event.training_points,
         },
       });

       await tx.profile.update({
         where: { user_id: userId },
         data: { training_points: { increment: event.training_points } },
       });
       return checkin;
     });

    await usersService.checkAndAwardBadges(userId);
    await notificationsService.notifyCheckinSuccess(
      userId, event.title, event.training_points);

    const profile = await prisma.profile.findUnique({
      where: { user_id: userId },
      select: { training_points: true, full_name: true },
    });

    return {
      success: true,
      message: `Điểm danh GPS thành công! Khoảng cách: ${distance.toFixed(0)}m`,
      points_earned: event.training_points,
      total_points: profile?.training_points ?? 0,
      student_name: profile?.full_name,
      event_title: event.title,
      distance: distance.toFixed(0) + 'm',
      checked_in_at: result.checked_in_at,
    };
  },

  // ── ĐIỂM DANH THỦ CÔNG BẰNG MSSV (PAGE_ADMIN) ───────────
  async manualCheckin(adminUserId: string, input: ManualCheckinInput) {
    const event = await prisma.event.findUnique({ where: { id: input.event_id } });

    if (!event) {
      throw { statusCode: 404, message: 'Không tìm thấy sự kiện' };
    }
    // Đã gỡ bỏ điều kiện check ONGOING để admin có thể điểm danh bù bất kỳ lúc nào

    const isMember = await prisma.pageMember.findUnique({
      where: { page_id_user_id: { page_id: event.page_id, user_id: adminUserId } },
    });
    if (!isMember) {
      throw { statusCode: 403, message: 'Bạn không có quyền điểm danh cho sự kiện này' };
    }

    const profile = await prisma.profile.findUnique({
      where: { student_id: input.student_id },
      include: { user: true },
    });

    if (!profile) {
      throw { statusCode: 404, message: `Không tìm thấy sinh viên có MSSV ${input.student_id}` };
    }

    await prisma.$transaction(async (tx) => {
      // Dùng Upsert: Nếu sinh viên chưa từng đăng ký thì hệ thống tự động đăng ký và đánh dấu ATTENDED
      const registration = await tx.registration.upsert({
        where: { user_id_event_id: { user_id: profile.user.id, event_id: input.event_id } },
        update: { status: 'ATTENDED' },
        create: { user_id: profile.user.id, event_id: input.event_id, status: 'ATTENDED' },
      });

      // Kiểm tra xem đã có dòng checkin chưa (tránh cộng điểm 2 lần nếu admin lỡ bấm 2 nhát)
      const existingCheckin = await tx.checkin.findFirst({
        where: { registration_id: registration.id }
      });

      if (!existingCheckin) {
        await tx.checkin.create({
          data: {
            registration_id: registration.id,
            user_id: profile.user.id,
            method: 'MANUAL',
            points_awarded: event.training_points,
          },
        });

        await tx.profile.update({
          where: { user_id: profile.user.id },
          data: { training_points: { increment: event.training_points } },
        });
      }
    });

    await usersService.checkAndAwardBadges(profile.user.id);

    return {
      success: true,
      message: `Điểm danh bù thành công cho ${profile.full_name}`,
      student_name: profile.full_name,
      student_id: profile.student_id,
      points_earned: event.training_points,
    };
  },

  // ── IMPORT ĐIỂM DANH HÀNG LOẠT BẰNG DANH SÁCH MSSV (PAGE_ADMIN) ─
  async importCheckinStudents(eventId: string, adminUserId: string, studentIds: string[]) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw { statusCode: 404, message: 'Không tìm thấy sự kiện' };

    const isMember = await prisma.pageMember.findUnique({
      where: { page_id_user_id: { page_id: event.page_id, user_id: adminUserId } },
    });
    if (!isMember) throw { statusCode: 403, message: 'Bạn không có quyền quản lý sự kiện này' };

    // [N+1 FIX] Bổ sung select profile để lấy sẵn full_name, student_id trong cùng 1 query,
    // tránh phải query lại Profile khi cần log hoặc trả về kết quả chi tiết.
    const users = await prisma.user.findMany({
      where: { profile: { student_id: { in: studentIds } } },
      select: {
        id: true,
        profile: {
          select: {
            full_name: true,
            student_id: true,
          },
        },
      },
    });

    if (users.length === 0) throw { statusCode: 404, message: 'Không tìm thấy sinh viên nào trong hệ thống' };

    let successCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const user of users) {
        const registration = await tx.registration.upsert({
          where: { user_id_event_id: { user_id: user.id, event_id: eventId } },
          update: { status: 'ATTENDED' },
          create: { user_id: user.id, event_id: eventId, status: 'ATTENDED' },
        });

        const existingCheckin = await tx.checkin.findFirst({
          where: { registration_id: registration.id },
        });

        if (!existingCheckin) {
          await tx.checkin.create({
            data: {
              registration_id: registration.id,
              user_id: user.id,
              method: 'MANUAL',
              points_awarded: event.training_points,
            },
          });
          successCount++;
        }
      }
    });

    return { message: `Đã điểm danh bù thành công ${successCount} sinh viên.` };
  },

  // ── LẤY QR TOKEN CHO SỰ KIỆN ─────────────────────────────
  async getEventQrToken(eventId: string) {
    const token = await qrService.generateToken(eventId);
    return { token: token.token, expires_at: token.expires_at, ttl: token.ttl };
  },

  // ── BẬT CHẾ ĐỘ ĐIỂM DANH (PAGE_ADMIN) ───────────────────
  async startCheckin(eventId: string, adminUserId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });

    if (!event) {
      throw { statusCode: 404, message: 'Không tìm thấy sự kiện' };
    }
    if (event.status !== 'APPROVED') {
      throw { statusCode: 400, message: 'Chỉ có thể bắt đầu điểm danh cho sự kiện đã được duyệt' };
    }

    const isMember = await prisma.pageMember.findUnique({
      where: { page_id_user_id: { page_id: event.page_id, user_id: adminUserId } },
    });
    if (!isMember) {
      throw { statusCode: 403, message: 'Bạn không có quyền thao tác sự kiện này' };
    }

    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'ONGOING' },
    });

    const qrToken = await qrService.generateToken(eventId);
    return { message: 'Đã bắt đầu điểm danh', event_id: eventId, first_token: qrToken };
  },

  // ── KẾT THÚC ĐIỂM DANH (PAGE_ADMIN) ─────────────────────
  async endCheckin(eventId: string, adminUserId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });

    if (!event) {
      throw { statusCode: 404, message: 'Không tìm thấy sự kiện' };
    }
    if (event.status !== 'ONGOING') {
      throw { statusCode: 400, message: 'Sự kiện không đang trong trạng thái điểm danh' };
    }

    const isMember = await prisma.pageMember.findUnique({
      where: { page_id_user_id: { page_id: event.page_id, user_id: adminUserId } },
    });
    if (!isMember) {
      throw { statusCode: 403, message: 'Bạn không có quyền thao tác sự kiện này' };
    }

    await prisma.qrToken.deleteMany({ where: { event_id: eventId } });

    await prisma.registration.updateMany({
      where: { event_id: eventId, status: { in: ['REGISTERED', 'APPROVED'] } },
      data: { status: 'ABSENT' },
    });

    await prisma.event.update({ where: { id: eventId }, data: { status: 'CLOSED' } });

    const stats = await prisma.registration.groupBy({
      by: ['status'], where: { event_id: eventId }, _count: true,
    });

    return { message: 'Đã kết thúc điểm danh', stats: stats.map(s => ({ status: s.status, count: s._count })) };
  },

  // ── LẤY QR TOKEN MỚI NHẤT (PAGE_ADMIN) ──────────────────
  async getCurrentToken(eventId: string, adminUserId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });

    if (!event || event.status !== 'ONGOING') {
      throw { statusCode: 400, message: 'Sự kiện không đang trong trạng thái điểm danh' };
    }

    const isMember = await prisma.pageMember.findUnique({
      where: { page_id_user_id: { page_id: event.page_id, user_id: adminUserId } },
    });
    if (!isMember) {
      throw { statusCode: 403, message: 'Bạn không có quyền truy cập' };
    }

    const qrToken = await qrService.generateToken(eventId);
    return qrToken;
  },

  // ── SSE STREAM QR (PAGE_ADMIN) ────────────────────────────
  async streamQr(eventId: string, adminUserId: string, res: any) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });

    if (!event) {
      throw { statusCode: 404, message: 'Không tìm thấy sự kiện' };
    }

    const isMember = await prisma.pageMember.findUnique({
      where: { page_id_user_id: { page_id: event.page_id, user_id: adminUserId } },
    });
    if (!isMember) {
      throw { statusCode: 403, message: 'Bạn không có quyền truy cập' };
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendToken = async () => {
      try {
        const token = await qrService.generateToken(eventId);
        res.write(`data: ${JSON.stringify(token)}\n\n`);
      } catch {
        res.write(`data: ${JSON.stringify({ error: 'Sự kiện đã kết thúc' })}\n\n`);
        clearInterval(interval);
        res.end();
      }
    };

    await sendToken();
    const interval = setInterval(sendToken, 15000);
    res.on('close', () => { clearInterval(interval); });
  },

  // ── XEM LỊCH SỬ ĐIỂM DANH (PAGE_ADMIN) ──────────────────
  async getCheckinHistory(eventId: string, adminUserId: string) {
    // [N+1 FIX] Gom event + isMember check + checkin list: dùng findUnique với
    // _count: { select: { registrations: true } } để trả thêm tổng số đăng ký
    // của event trong cùng 1 query, giúp Frontend tính tỉ lệ tham dự mà không cần gọi thêm API.
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!event) {
      throw { statusCode: 404, message: 'Không tìm thấy sự kiện' };
    }

    const isMember = await prisma.pageMember.findUnique({
      where: { page_id_user_id: { page_id: event.page_id, user_id: adminUserId } },
    });
    if (!isMember) {
      throw { statusCode: 403, message: 'Bạn không có quyền xem' };
    }

    // [N+1 FIX] Bổ sung include registration để lấy sẵn registered_at và status
    // của từng đăng ký trong cùng 1 query findMany, tránh Frontend phải gọi thêm
    // API riêng để biết sinh viên đăng ký lúc nào / trạng thái ban đầu là gì.
    const checkins = await prisma.checkin.findMany({
      where: { registration: { event_id: eventId } },
      orderBy: { checked_in_at: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            profile: {
              select: {
                full_name: true, student_id: true, class_name: true,
                avatar_url: true,
              },
            },
          },
        },
        // [N+1 FIX] Lấy thêm registered_at và status từ registration trong cùng query,
        // tuân thủ quy tắc: giữ nguyên tên cột registered_at, không đổi thành created_at.
        registration: {
          select: {
            registered_at: true,
            status: true,
          },
        },
      },
    });

    return {
      event_title: event.title,
      total_registrations: event._count.registrations,
      total_checkins: checkins.length,
      checkins: checkins.map(c => ({
        id: c.id,
        method: c.method,
        checked_in_at: c.checked_in_at,
        points_awarded: c.points_awarded,
        registered_at: c.registration.registered_at,
        registration_status: c.registration.status,
        student: c.user.profile,
      })),
    };
  },
};