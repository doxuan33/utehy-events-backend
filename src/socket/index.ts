import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env, getCorsOrigins } from '../config/env';

/**
 * Khởi tạo Socket.io Server
 * @param httpServer - HTTP server instance
 * @returns Socket.io Server instance
 */
export function initializeSocket(httpServer: any): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: getCorsOrigins(),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Middleware xác thực
  io.use((socket: any, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Không tìm thấy mã xác thực'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { id: string; role: string };
      socket.user = decoded;
      next();
    } catch (error) {
      return next(new Error('Mã xác thực không hợp lệ hoặc đã hết hạn'));
    }
  });

  // Xử lý kết nối
  io.on('connection', (socket: any) => {
    // User connected

    // ──────────────────────────────────────────────────────
    // Sự kiện: Tham gia phòng sự kiện (join_event)
    // ──────────────────────────────────────────────────────
    socket.on('join_event', (eventId: string) => {
      if (!eventId || typeof eventId !== 'string') {
        socket.emit('error', { message: 'event_id không hợp lệ' });
        return;
      }

      const room = `event_${eventId}`;
      socket.join(room);

      socket.emit('joined_event', {
        event_id: eventId,
        room,
        message: 'Đã tham gia phòng sự kiện'
      });

      const roomSockets = io.sockets.adapter.rooms.get(room);
      const participantCount = roomSockets ? roomSockets.size : 0;

      io.to(room).emit('participant_count', {
        event_id: eventId,
        count: participantCount,
      });
    });

    // ──────────────────────────────────────────────────────
    // Sự kiện: Rời phòng sự kiện (leave_event)
    // ──────────────────────────────────────────────────────
    socket.on('leave_event', (eventId: string) => {
      if (!eventId || typeof eventId !== 'string') {
        socket.emit('error', { message: 'event_id không hợp lệ' });
        return;
      }

      const room = `event_${eventId}`;
      socket.leave(room);

      socket.emit('left_event', {
        event_id: eventId,
        message: 'Đã rời phòng sự kiện'
      });

      const roomSockets = io.sockets.adapter.rooms.get(room);
      const participantCount = roomSockets ? roomSockets.size : 0;

      io.to(room).emit('participant_count', {
        event_id: eventId,
        count: participantCount,
      });
    });

    // ──────────────────────────────────────────────────────
    // Sự kiện: Gửi câu hỏi (send_question)
    // ──────────────────────────────────────────────────────
    socket.on('send_question', (data: { event_id: string; content: string }) => {
      const { event_id, content } = data;

      if (!event_id || typeof event_id !== 'string') {
        socket.emit('error', { message: 'event_id không hợp lệ' });
        return;
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        socket.emit('error', { message: 'Nội dung câu hỏi không được để trống' });
        return;
      }

      if (content.length > 1000) {
        socket.emit('error', { message: 'Nội dung câu hỏi quá dài (tối đa 1000 ký tự)' });
        return;
      }

      const room = `event_${event_id}`;

      const questionPayload = {
        id: `q_${Date.now()}_${socket.user?.id}_${Math.random().toString(36).substr(2, 9)}`,
        event_id: event_id,
        user: {
          id: socket.user?.id,
          role: socket.user?.role,
        },
        content: content.trim(),
        timestamp: new Date().toISOString(),
        vote_count: 0,
        has_voted: false,
      };

      socket.to(room).emit('new_question', questionPayload);
      socket.emit('new_question', questionPayload);
    });

    // ──────────────────────────────────────────────────────
    // Sự kiện: Bỏ phiếu câu hỏi (upvote_question)
    // ──────────────────────────────────────────────────────
    socket.on('upvote_question', (data: { event_id: string; question_id: string }) => {
      const { event_id, question_id } = data;

      if (!event_id || typeof event_id !== 'string') {
        socket.emit('error', { message: 'event_id không hợp lệ' });
        return;
      }

      if (!question_id || typeof question_id !== 'string') {
        socket.emit('error', { message: 'question_id không hợp lệ' });
        return;
      }

      const room = `event_${event_id}`;

      const voteUpdatePayload = {
        event_id: event_id,
        question_id: question_id,
        user_id: socket.user?.id,
        timestamp: new Date().toISOString(),
      };

      socket.to(room).emit('update_vote', voteUpdatePayload);
      socket.emit('update_vote', voteUpdatePayload);
    });

    // ──────────────────────────────────────────────────────
    // Sự kiện: Client ngắt kết nối
    // ──────────────────────────────────────────────────────
    socket.on('disconnect', (reason: any) => {
      socket.rooms.forEach((room: string) => {
        if (room !== socket.id) {
          const participantCount = io.sockets.adapter.rooms.get(room)?.size || 0;
          const eventId = room.replace('event_', '');

          io.to(room).emit('participant_count', {
            event_id: eventId,
            count: participantCount,
          });
        }
      });
    });

    // ──────────────────────────────────────────────────────
    // Sự kiện: Ping/Pong
    // ──────────────────────────────────────────────────────
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  });

  io.engine.on('connection_error', (err: any) => {
    console.error('[Socket.io] Connection error:', err);
  });

  console.log('[Socket.io] Server initialized successfully');
  
  return io;
}
