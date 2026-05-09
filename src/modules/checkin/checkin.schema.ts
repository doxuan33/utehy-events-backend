import { z } from 'zod';

export const scanQrSchema = z.object({
  token: z.string().min(1, 'Token không được để trống'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const manualCheckinSchema = z.object({
  event_id: z.string().uuid('event_id không hợp lệ'),
  student_id: z.string().regex(/^\d{8}$/, 'MSSV phải gồm đúng 8 chữ số'),
});

export const gpsCheckinSchema = z.object({
  event_id: z.string().uuid('event_id không hợp lệ'),
  token: z.string().min(1, 'Token không được để trống'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type ScanQrInput      = z.infer<typeof scanQrSchema>;
export type ManualCheckinInput = z.infer<typeof manualCheckinSchema>;
export type GpsCheckinInput  = z.infer<typeof gpsCheckinSchema>;
