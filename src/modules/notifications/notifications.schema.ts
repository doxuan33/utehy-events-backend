import { z } from 'zod';

export const createNotificationSchema = z.object({
  user_id: z.string().uuid('user_id không hợp lệ'),
  type: z.enum([
    'MANDATORY_EVENT',
    'GLOBAL_EVENT',
    'EVENT_UPDATE',
    'EVENT_CANCEL',
    'EVENT_REMINDER',
    'CHECKIN_SUCCESS',
    'CLUB_JOIN_RESULT',
    'NEW_POST',
    'BADGE_UNLOCKED',
    'NEW_JOIN_REQUEST',
    'EVENT_APPROVED',
    'EVENT_REJECTED',
    'EVENT_FULL',
    'NEW_EVENT_REQUEST',
    'NEW_CLUB_REQUEST',
    'PENALTY_APPLIED',
    'SYSTEM',
  ]),
  title: z.string().min(1).max(255),
  body: z.string().min(1),
  data: z.record(z.string(), z.any()).optional(), // JSON payload tuỳ ý
});

export const getNotificationsQuerySchema = z.object({
  page: z.string().optional().transform(v => parseInt(v || '1')),
  limit: z.string().optional().transform(v => Math.min(parseInt(v || '20'), 50)),
  is_read: z.enum(['true', 'false']).optional().transform(v =>
    v === undefined ? undefined : v === 'true'
  ),
});

export type CreateNotificationInput  = z.infer<typeof createNotificationSchema>;
export type GetNotificationsQuery    = z.infer<typeof getNotificationsQuerySchema>;