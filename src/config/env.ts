import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  GOOGLE_FORM_WEBHOOK_SECRET: z.string().default(''),
  FRONTEND_URL: z.string().default('http://localhost:3000'), // Comma-separated allowed origins
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
  NGROK_AUTH_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Thiếu biến môi trường:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

// Helper to get CORS origins as array or boolean
export const getCorsOrigins = (): string | string[] | boolean => {
  if (!env.FRONTEND_URL) return true; // Allow all in dev if not set
  return env.FRONTEND_URL.split(',').map((url: string) => url.trim());
};
