import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from "path";
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middlewares/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import { env, getCorsOrigins } from './config/env';
import eventsRoutes from './modules/events/events.routes';
import pagesRoutes from './modules/pages/pages.routes';
import registrationsRoutes from './modules/registrations/registrations.routes';
import postsRoutes from './modules/posts/posts.routes';
import usersRoutes from './modules/users/users.routes';
import checkinRoutes from './modules/checkin/checkin.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import adminRoutes from './modules/admin/admin.routes';
import uploadRouter from "./modules/upload/upload.routes";
import webhookRouter from "./modules/webhook/webhook.routes";
import { initializeSocket } from './socket';
import { initCronJobs } from './cron';

const app = express();

// ── Middlewares bảo mật ──────────────────────────────
app.use(helmet());
app.use(cors({ 
  origin: getCorsOrigins(),
  credentials: true,
  optionsSuccessStatus: 200 
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiter toàn cục
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { success: false, message: 'Quá nhiều request, vui lòng thử lại sau' } }));

// ── Routes ───────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'OK', time: new Date(), service: 'UTEHY Social Backend' }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/events', eventsRoutes);
app.use('/api/v1/pages', pagesRoutes);
app.use('/api/v1/registrations', registrationsRoutes);
app.use('/api/v1/posts', postsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/checkin', checkinRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use("/api/v1/upload", uploadRouter);
app.use('/api/v1/webhook', webhookRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Không tìm thấy route' });
});

// ── Global Error Handler (phải đặt CUỐI CÙNG) ───────
app.use(errorHandler);

// ── Khởi tạo HTTP Server ─────────────────────────────────
const PORT = Number(env.PORT) || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📍 Environment: ${env.NODE_ENV}`);
  console.log(`📅 Time: ${new Date().toISOString()}`);
});

  // ── Khởi tạo Socket.io ──────────────────────────────────
  const io = initializeSocket(server);

  // Lưu instance để có thể truy cập từ các module khác nếu cần
  app.set('io', io);

  // ── Khởi tạo Cron Jobs ──────────────────────────────────
  initCronJobs();

// Graceful shutdown
const shutdown = () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
  
  // Force shutdown after 10s
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, server, io };
