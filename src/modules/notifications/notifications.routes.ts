import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

// GET /api/v1/notifications
router.get('/', authenticate, (req, res) => {
  res.json({
    status: 'success',
    data: {
      data: [],
      meta: { total: 0, page: 1, limit: 20, unread_count: 0 }
    }
  });
});

// GET /api/v1/notifications/unread-count
router.get('/unread-count', authenticate, (req, res) => {
  res.json({
    status: 'success',
    data: { unread_count: 0 }
  });
});

// GET /api/v1/notifications/stream (SSE)
router.get('/stream', authenticate, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

export default router;
