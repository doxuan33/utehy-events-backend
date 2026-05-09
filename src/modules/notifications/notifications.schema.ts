import { z } from 'zod';

export const createNotificationSchema = z.object({
  user_id: z.string().uuid('user_id không hợp lệ'),
  type: z.enum([
    'EVENT_APPROVED',
    'EVENT_NEW',
    'EVENT_REMINDER',
    'CHECKIN_SUCCESS',
    'REGISTRATION_OPEN',
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