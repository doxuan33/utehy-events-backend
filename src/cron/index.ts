import cron from 'node-cron';
import prisma from '../config/database';
import { notificationsService } from '../modules/notifications/notifications.service';
import { logger } from '../shared/utils/logger';

// ── Job 1: Nhắc nhở sự kiện (mỗi 15 phút) ─────────────────────
const eventReminderJob = cron.schedule('*/15 * * * *', async () => {
  try {
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Tìm các sự kiện APPROVED sắp diễn ra trong 2 giờ tới
    const upcomingEvents = await prisma.event.findMany({
      where: {
        status: 'APPROVED',
        start_time: {
          gte: now,
          lte: twoHoursLater,
        },
      },
      select: {
        id: true,
        title: true,
        registrations: {
          where: { status: 'APPROVED' },
          select: {
            user_id: true,
          },
        },
      },
    });

    if (upcomingEvents.length === 0) {
      logger.info(`[CRON EVENT_REMINDER] Không có sự kiện nào cần nhắc nhở vào lúc ${now.toISOString()}`);
      return;
    }

    for (const event of upcomingEvents) {
      const userIds = event.registrations.map(reg => reg.user_id);
      if (userIds.length > 0) {
        await notificationsService.notifyEventReminder(userIds, event.title, event.id);
      }
    }

    logger.info(
      `[CRON EVENT_REMINDER] Đã gửi nhắc nhở cho ${upcomingEvents.length} sự kiện`
    );
  } catch (error: any) {
    logger.error('[CRON EVENT_REMINDER] Lỗi:', error?.message);
  }
}, { scheduled: true });

// ── Job 2: Tự động đóng sự kiện & gửi thông báo đánh giá (mỗi 5 phút) ─────────────────
const eventCloseJob = cron.schedule('*/5 * * * *', async () => {
  try {
    const now = new Date();

    // Tìm các sự kiện ONGOING đã qua giờ kết thúc
    const expiredEvents = await prisma.event.findMany({
      where: {
        status: 'ONGOING',
        end_time: { lt: now },
      },
      select: {
        id: true,
        title: true,
        is_penalty_active: true,
        penalty_points: true,
        registrations: {
          where: {
            status: { in: ['ATTENDED', 'REGISTERED', 'APPROVED'] },
          },
          select: {
            user_id: true,
            status: true,
          },
        },
      },
    });

    if (expiredEvents.length === 0) {
      logger.info(`[CRON EVENT_CLOSE] Không có sự kiện nào cần đóng vào lúc ${now.toISOString()}`);
      return;
    }

    // Update status các sự kiện thành CLOSED trong transaction
    const eventIds = expiredEvents.map((e: any) => e.id);
    await prisma.$transaction(async (tx: any) => {
      await tx.event.updateMany({
        where: { id: { in: eventIds } },
        data: { status: 'CLOSED' },
      });
    });

    for (const event of expiredEvents) {
      const absentRegs = event.registrations.filter(
        (reg) => reg.status === 'REGISTERED' || reg.status === 'APPROVED'
      );
      const absentUserIds = absentRegs.map((reg) => reg.user_id);

      // Cập nhật Database cho các sinh viên vắng mặt
      if (absentUserIds.length > 0) {
        await prisma.$transaction(async (tx) => {
          // Cập nhật trạng thái của các đăng ký này thành ABSENT
          await tx.registration.updateMany({
            where: {
              event_id: event.id,
              status: { in: ['REGISTERED', 'APPROVED'] },
            },
            data: {
              status: 'ABSENT',
              is_penalized: event.is_penalty_active ? true : false,
            },
          });

          // NẾU event.is_penalty_active === true
          if (event.is_penalty_active && event.penalty_points > 0) {
            // Truy xuất bảng Profile của những sinh viên bị vắng mặt
            const profiles = await tx.profile.findMany({
              where: { user_id: { in: absentUserIds } },
              select: { id: true, training_points: true },
            });

            // Trừ đi số điểm tương ứng (training_points = Math.max(0, training_points - event.penalty_points))
            for (const profile of profiles) {
              await tx.profile.update({
                where: { id: profile.id },
                data: {
                  training_points: Math.max(0, profile.training_points - event.penalty_points),
                },
              });
            }
          }
        });

        // Gửi thông báo phạt PENALTY_APPLIED bên ngoài transaction
        if (event.is_penalty_active && event.penalty_points > 0) {
          await notificationsService.createBulkNotifications(absentUserIds, {
            type: 'PENALTY_APPLIED',
            title: 'Phạt điểm rèn luyện do vắng mặt',
            body: `📉 Bạn bị trừ ${event.penalty_points} điểm rèn luyện do vắng mặt không phép tại sự kiện "${event.title}".`,
            data: { event_id: event.id },
          }).catch((err) => logger.error('[CRON EVENT_CLOSE] Lỗi gửi thông báo phạt:', err));
        }
      }

      // Thông báo đánh giá cho sinh viên đã tham gia
      const attendedUserIds = event.registrations
        .filter((reg) => reg.status === 'ATTENDED')
        .map((reg) => reg.user_id);

      if (attendedUserIds.length > 0) {
        await notificationsService.createBulkNotifications(attendedUserIds, {
          type: 'SYSTEM',
          title: 'Kết thúc sự kiện - Đánh giá Ban tổ chức',
          body: `Sự kiện "${event.title}" đã kết thúc. Hãy vào đánh giá 5 sao cho Ban tổ chức nhé!`,
          data: { event_id: event.id },
        }).catch((err) => logger.error('[CRON EVENT_CLOSE] Lỗi gửi thông báo đánh giá:', err));
      }
    }

    logger.info(
      `[CRON EVENT_CLOSE] Đã đóng ${expiredEvents.length} sự kiện và xử lý chuyên cần`
    );
  } catch (error: any) {
    logger.error('[CRON EVENT_CLOSE] Lỗi:', error?.message);
  }
}, { scheduled: true });

// ── Khởi tạo toàn bộ cron jobs ───────────────────────────────
export function initCronJobs() {
  try {
    eventReminderJob.start();
    logger.info('✅ Cron Job [EVENT_REMINDER] đã khởi chạy (mỗi 15 phút)');

    eventCloseJob.start();
    logger.info('✅ Cron Job [EVENT_CLOSE] đã khởi chạy (mỗi 5 phút)');

    logger.info('🚀 Tất cả cron jobs đã được kích hoạt');
  } catch (error: any) {
    logger.error('[CRON] Lỗi khi khởi chạy cron jobs:', error?.message);
  }
}

export { eventReminderJob, eventCloseJob };
