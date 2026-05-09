import { z } from 'zod';

// ── Base object for CREATE (có refine kiểm tra ngày tháng) ─────────────────
const eventCreateSchema = z.object({
category_id: z.number().int().positive().optional(),
  title: z.string().min(5, 'Tiêu đề phải có ít nhất 5 ký tự').max(255),
  description: z.string().optional(),
  banner_url: z.string().url('URL ảnh không hợp lệ').optional(),
  location: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  checkin_radius_m: z.number().int().min(50).max(1000).default(200),
  start_time: z.string().datetime('Thời gian bắt đầu không hợp lệ'),
  end_time: z.string().datetime('Thời gian kết thúc không hợp lệ').optional(),
  registration_deadline: z.string().datetime('Hạn đăng ký không hợp lệ').optional(),
  max_slots: z.number().int().positive().optional(),
  training_points: z.number().int().min(0).max(100).default(0),
  requires_approval: z.boolean().default(false),
})
.refine(
   (data) => {
     if (data.end_time && data.start_time) {
       return new Date(data.end_time) > new Date(data.start_time);
     }
     return true;
   },
   { message: 'Thời gian kết thúc phải sau thời gian bắt đầu', path: ['end_time'] }
 )
 .refine(
   (data) => {
     if (data.registration_deadline && data.start_time) {
       return new Date(data.registration_deadline) <= new Date(data.start_time);
     }
     return true;
   },
   { message: 'Hạn đăng ký phải trước hoặc bằng thời gian bắt đầu', path: ['registration_deadline'] }
 );

// ── CREATE ─────────────────────────────────────────────────────
export const createEventSchema = eventCreateSchema;

// ── UPDATE: all fields optional ───────────────────────────────────
export const updateEventSchema = z.object({
  category_id: z.number().int().positive().optional(),
  title: z.string().min(5, 'Tiêu đề phải có ít nhất 5 ký tự').max(255).optional(),
  description: z.string().optional(),
  banner_url: z.string().url('URL ảnh không hợp lệ').optional(),
  location: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  checkin_radius_m: z.number().int().min(50).max(1000).optional(),
  start_time: z.string().datetime('Thời gian bắt đầu không hợp lệ').optional(),
  end_time: z.string().datetime('Thời gian kết thúc không hợp lệ').optional(),
  registration_deadline: z.string().datetime('Hạn đăng ký không hợp lệ').optional(),
  max_slots: z.number().int().positive().optional(),
  training_points: z.number().int().min(0).max(100).optional(),
  requires_approval: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.start_time && data.end_time) {
      return new Date(data.end_time) > new Date(data.start_time);
    }
    return true;
  },
  { message: 'Thời gian kết thúc phải sau thời gian bắt đầu', path: ['end_time'] }
).refine(
  (data) => {
    if (data.registration_deadline && data.start_time) {
      return new Date(data.registration_deadline) <= new Date(data.start_time);
    }
    return true;
  },
  { message: 'Hạn đăng ký phải trước hoặc bằng thời gian bắt đầu', path: ['registration_deadline'] }
);

export const rejectEventSchema = z.object({
  reason: z.string().min(10, 'Lý do từ chối phải có ít nhất 10 ký tự'),
});

export const getEventsQuerySchema = z.object({
  page: z.string().optional().transform(v => parseInt(v || '1')),
  limit: z.string().optional().transform(v => Math.min(parseInt(v || '10'), 50)),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ONGOING', 'CLOSED']).optional(),
  category_id: z.string().optional().transform(v => v ? parseInt(v) : undefined),
  search: z.string().optional(),
  page_id: z.string().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type GetEventsQuery   = z.infer<typeof getEventsQuerySchema>;
