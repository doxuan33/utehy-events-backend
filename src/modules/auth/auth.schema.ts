import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z
    .string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 chữ số'),
  full_name: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(150),
  student_id: z
    .string()
    .regex(/^\d{8}$/, 'MSSV phải gồm đúng 8 chữ số')
    .optional(),
  class_name: z.string().max(50).optional(),
  faculty: z.string().max(150).optional(),
  phone: z
    .string()
    .regex(/^(0|\+84)[0-9]{9}$/, 'Số điện thoại không hợp lệ')
    .optional(),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Vui lòng nhập Email hoặc MSSV'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  new_password: z
    .string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 chữ số'),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token không được để trống'),
});

// Typescript types tự sinh từ schema
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput  = z.infer<typeof refreshTokenSchema>;