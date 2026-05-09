import { z } from 'zod';

export const updateProfileSchema = z.object({
  full_name: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(150).nullish().or(z.literal('')),
  class_name: z.string().max(50).nullish().or(z.literal('')),
  faculty: z.string().max(150).nullish().or(z.literal('')),
  phone: z
    .string()
    .nullish()
    .or(z.literal(''))
    .refine((val) => !val || /^(0|\+84)[0-9]{9}$/.test(val), 'Số điện thoại không hợp lệ'),
  avatar_url: z.string().url('URL avatar không hợp lệ').nullish().or(z.literal('')),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  new_password: z
    .string()
    .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
    .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 chữ số'),
}).refine(
  (data) => data.current_password !== data.new_password,
  { message: 'Mật khẩu mới phải khác mật khẩu hiện tại', path: ['new_password'] }
);

export const getUsersQuerySchema = z.object({
  page: z.string().optional().transform(v => parseInt(v || '1')),
  limit: z.string().optional().transform(v => Math.min(parseInt(v || '20'), 100)),
  search: z.string().optional(),
  role: z.enum(['STUDENT', 'PAGE_ADMIN', 'SYSTEM_ADMIN']).optional(),
});

export const importStudentsSchema = z.object({
  students: z.array(z.object({
    student_id: z.string().min(1, 'MSSV không được để trống'),
    full_name: z.string().min(1, 'Họ tên không được để trống'),
    class_name: z.string().optional(),
    faculty: z.string().optional(),
    email: z.string().email('Email không hợp lệ').optional(),
    phone: z.string().optional(),
  })).min(1, 'Danh sách sinh viên không được để trống'),
});

export type UpdateProfileInput  = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type GetUsersQuery       = z.infer<typeof getUsersQuerySchema>;
export type ImportStudentsInput = z.infer<typeof importStudentsSchema>;
