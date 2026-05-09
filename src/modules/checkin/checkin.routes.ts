import { Router } from 'express';
import { checkinController } from './checkin.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

// ── SINH VIÊN ĐIỂM DANH ──────────────────────────────────────
router.post('/scan',        authenticate, checkinController.scanQr);      // QR checkin
router.post('/scan-gps',    authenticate, checkinController.scanGps);      // GPS checkin (Haversine)

// ── PAGE ADMIN ĐIỂM DANH THỦ CÔNG ────────────────────────────
router.post('/manual',   authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), checkinController.manualCheckin);

// ── QUẢN LÝ BUỔI ĐIỂM DANH ───────────────────────────────────
router.post('/events/:eventId/start', authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), checkinController.startCheckin);
router.post('/events/:eventId/end',   authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), checkinController.endCheckin);
router.get('/events/:eventId/token',  authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), checkinController.getCurrentToken);

// ── LẤY QR TOKEN CHO SỰ KIỆN (HIỂN THỊ MÀN HÌNH) ─────────────
router.get('/events/:eventId/qr-token', authenticate, checkinController.getEventQrToken);

// ── SSE STREAM QR (TRÌNH CHIẾU MÀN HÌNH LỚN) ──────────────────
router.get('/events/:eventId/stream', authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), checkinController.streamQr);

// ── XEM LỊCH SỬ ĐIỂM DANH ───────────────────────────────────
router.get('/events/:eventId/history', authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), checkinController.getCheckinHistory);

export default router;
