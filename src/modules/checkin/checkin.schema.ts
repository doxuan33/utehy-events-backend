import { z } from 'zod';

export const scanQrSchema = z.object({
  token: z.string().min(1, 'Token không được để trống'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const manualCheckinSchema = z.object({
  event_id: z.string().min(1, 'event_id không được để trống'),
  student_id: z.string().min(1, 'MSSV không được để trống'),
});

export const gpsCheckinSchema = z.object({
  event_id: z.string().uuid('event_id không hợp lệ'),
  token: z.string().min(1, 'Token không được để trống'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const importCheckinSchema = z.object({
  studentIds: z.array(z.string().min(1, 'MSSV không được để trống')),
});

export type ScanQrInput      = z.infer<typeof scanQrSchema>;
export type ManualCheckinInput = z.infer<typeof manualCheckinSchema>;
export type GpsCheckinInput  = z.infer<typeof gpsCheckinSchema>;
export type ImportCheckinInput = z.infer<typeof importCheckinSchema>;
