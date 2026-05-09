import cron from 'node-cron';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { notificationsService } from '../modules/notifications/notifications.service';
import { logger } from '../shared/utils/logger';
import { CreateNotificationInput } from '../modules/notifications/notifications.schema';

// ── Job 1: Nhắc nhở sự kiện (mỗi 15 phút) ─────────────────────
const eventReminderJob = cron.createTask('*/15 * * * *', async () => {
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

    // Thu thập tất cả thông báo cần tạo
    const notificationsData: CreateNotificationInput[] = [];

    for (const event of upcomingEvents) {
      for (const reg of event.registrations) {
        notificationsData.push({
          user_id: reg.user_id,
          type: 'EVENT_REMINDER' as const,
          title: 'Nhắc nhở tham gia sự kiện',
          body: `Sự kiện "${event.title}" sẽ diễn ra trong vòng 2 giờ tới, đừng quên tham gia nhé!`,
          data: { event_id: event.id },
        });
      }
    }

    // Sử dụng service để tạo bulk notifications
    const chunkSize = 1000;
    for (let i = 0; i < notificationsData.length; i += chunkSize) {
      const chunk = notificationsData.slice(i, i + chunkSize);
      for (const notif of chunk) {
        await prisma.notification.create({
          data: {
            user_id: notif.user_id,
            type: notif.type,
            title: notif.title,
            body: notif.body,
            data: notif.data ? JSON.stringify(notif.data) : Prisma.JsonNull,
          },
        });
      }
    }

    logger.info(
      `[CRON EVENT_REMINDER] Đã tạo ${notificationsData.length} thông báo nhắc nhở cho ${upcomingEvents.length} sự kiện`
    );
  } catch (error: any) {
    logger.error('[CRON EVENT_REMINDER] Lỗi:', error?.message);
  }
}, { noOverlap: true });

// ── Job 2: Tự động đóng sự kiện & gửi thông báo đánh giá (mỗi 5 phút) ─────────────────
const eventCloseJob = cron.createTask('*/5 * * * *', async () => {
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
        registrations: {
          where: { status: 'ATTENDED' },
          select: {
            user_id: true,
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

    // Thu thập thông báo cho sinh viên ATTENDED
    const notificationsData: CreateNotificationInput[] = [];

    for (const event of expiredEvents) {
      for (const reg of (event as any).registrations) {
        notificationsData.push({
          user_id: reg.user_id,
          type: 'SYSTEM' as const,
          title: 'Kết thúc sự kiện - Đánh giá Ban tổ chức',
          body: `Sự kiện "${event.title}" đã kết thúc. Hãy vào đánh giá 5 sao cho Ban tổ chức nhé!`,
          data: { event_id: event.id },
        });
      }
    }

    // Tạo thông báo
    const chunkSize = 1000;
    for (let i = 0; i < notificationsData.length; i += chunkSize) {
      const chunk = notificationsData.slice(i, i + chunkSize);
      for (const notif of chunk) {
        await prisma.notification.create({
          data: {
            user_id: notif.user_id,
            type: notif.type,
            title: notif.title,
            body: notif.body,
            data: notif.data ? JSON.stringify(notif.data) : Prisma.JsonNull,
          },
        });
      }
    }

    logger.info(
      `[CRON EVENT_CLOSE] Đã đóng ${expiredEvents.length} sự kiện và tạo ${notificationsData.length} thông báo đánh giá`
    );
  } catch (error: any) {
    logger.error('[CRON EVENT_CLOSE] Lỗi:', error?.message);
  }
}, { noOverlap: true });

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
