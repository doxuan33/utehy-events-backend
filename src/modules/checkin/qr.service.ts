import crypto from 'crypto';
import prisma from '../../config/database';

// TTL cho mã QR (mặc định 15 giây theo yêu cầu của bạn)
const QR_TOKEN_TTL_SECONDS = 15;

export const qrService = {

  // ── TẠO QR TOKEN MỚI ─────────────────────────────────────
  async generateToken(eventId: string) {
    // Xóa token cũ của sự kiện này trước
    await prisma.qrToken.deleteMany({
      where: {
        event_id: eventId,
        expires_at: { lt: new Date() },
      },
    });

    // Tạo token ngẫu nhiên 64 ký tự
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + QR_TOKEN_TTL_SECONDS * 1000);

    const qrToken = await prisma.qrToken.create({
      data: { event_id: eventId, token, expires_at: expiresAt },
    });

    return {
      token: qrToken.token,
      expires_at: qrToken.expires_at,
      ttl: QR_TOKEN_TTL_SECONDS,
    };
  },

  // ── XÁC THỰC TOKEN KHI SINH VIÊN QUÉT ────────────────────
  async verifyToken(token: string) {
    const qrToken = await prisma.qrToken.findUnique({
      where: { token },
      include: { event: true },
    });

    if (!qrToken) {
      throw { statusCode: 400, message: 'Mã QR không hợp lệ' };
    }

    if (new Date() > qrToken.expires_at) {
      throw { statusCode: 400, message: 'Mã QR đã hết hạn, vui lòng quét mã mới' };
    }

    return qrToken;
  },
};
