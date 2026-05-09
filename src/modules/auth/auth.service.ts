import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { RegisterInput, LoginInput } from './auth.schema';

// ── Helpers ──────────────────────────────────────────────────

function generateAccessToken(payload: { id: string; role: string }) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as any,
  });
}

function generateRefreshToken(payload: { id: string; role: string }) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as any,
  });
}

// Hash refresh token trước khi lưu DB (bảo mật)
function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── Service functions ────────────────────────────────────────

export const authService = {

  // ── ĐĂNG KÝ ──────────────────────────────────────────────
  async register(input: RegisterInput) {
    // 1. Kiểm tra email đã tồn tại chưa
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingUser) {
      throw { statusCode: 409, message: 'Email này đã được sử dụng' };
    }

    // 2. Kiểm tra MSSV đã tồn tại chưa (nếu có nhập)
    if (input.student_id) {
      const existingProfile = await prisma.profile.findUnique({
        where: { student_id: input.student_id },
      });
      if (existingProfile) {
        throw { statusCode: 409, message: 'MSSV này đã được đăng ký' };
      }
    }

    // 3. Hash mật khẩu
    const hashedPassword = await bcrypt.hash(input.password, 12);

    // 4. Tạo user + profile trong 1 transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          role: 'STUDENT',
        },
      });

      await tx.profile.create({
        data: {
          user_id: newUser.id,
          full_name: input.full_name,
          student_id: input.student_id,
          class_name: input.class_name,
          faculty: input.faculty,
          phone: input.phone,
        },
      });

      return newUser;
    });

    // 5. Tạo tokens
    const accessToken  = generateAccessToken({ id: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id, role: user.role });

    // 6. Lưu refresh token vào DB
    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token: hashToken(refreshToken),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: input.full_name,
      },
    };
  },

  // ── ĐĂNG NHẬP ────────────────────────────────────────────
  async login(input: LoginInput) {
    const { identifier, password } = input;

    // Phát hiện đang nhập MSSV hay Email
    const isMSSV = /^\d{8}$/.test(identifier);

    let user: any = null;

    if (isMSSV) {
        // Sinh viên đăng nhập bằng MSSV
        const profile = await prisma.profile.findUnique({
        where: { student_id: identifier },
        include: {
            user: true,
        },
        });

        if (!profile) {
        throw { statusCode: 401, message: 'MSSV hoặc mật khẩu không đúng' };
        }

        user = {
        ...profile.user,
        profile,
        };

    } else {
        // PAGE_ADMIN / SYSTEM_ADMIN đăng nhập bằng Email
        const foundUser = await prisma.user.findUnique({
        where: { email: identifier },
        include: { profile: true },
        });

        if (!foundUser) {
        throw { statusCode: 401, message: 'Email hoặc mật khẩu không đúng' };
        }

        // Chặn sinh viên đăng nhập bằng email
        if (foundUser.role === 'STUDENT') {
        throw {
            statusCode: 400,
            message: 'Sinh viên vui lòng đăng nhập bằng MSSV',
        };
        }

        user = foundUser;
    }

    // Kiểm tra tài khoản bị khóa
    if (!user.is_active) {
        throw { statusCode: 403, message: 'Tài khoản đã bị khóa. Vui lòng liên hệ Phòng CTSV' };
    }

    // So sánh mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        const msg = isMSSV
        ? 'MSSV hoặc mật khẩu không đúng'
        : 'Email hoặc mật khẩu không đúng';
        throw { statusCode: 401, message: msg };
    }

    // Tạo tokens
    const accessToken  = generateAccessToken({ id: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id, role: user.role });

    // Lưu refresh token
    await prisma.refreshToken.create({
        data: {
        user_id: user.id,
        token: hashToken(refreshToken),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    });

    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.profile?.full_name,
        student_id: user.profile?.student_id,
        avatar_url: user.profile?.avatar_url,
        training_points: user.profile?.training_points,
        },
    };
    },

  // ── LÀM MỚI TOKEN ────────────────────────────────────────
  async refreshToken(token: string) {
    // 1. Xác thực chữ ký của refresh token
    let decoded: { id: string; role: string };
    try {
      decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as any;
    } catch {
      throw { statusCode: 401, message: 'Refresh token không hợp lệ hoặc đã hết hạn' };
    }

    // 2. Kiểm tra token có trong DB không (chống tái sử dụng)
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: hashToken(token) },
    });
    if (!storedToken) {
      throw { statusCode: 401, message: 'Refresh token không tồn tại hoặc đã bị thu hồi' };
    }

    // 3. Kiểm tra token hết hạn trong DB
    if (storedToken.expires_at < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw { statusCode: 401, message: 'Refresh token đã hết hạn, vui lòng đăng nhập lại' };
    }

    // 4. Xóa token cũ (rotation - mỗi lần refresh dùng token mới)
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // 5. Tạo cặp token mới
    const newAccessToken  = generateAccessToken({ id: decoded.id, role: decoded.role });
    const newRefreshToken = generateRefreshToken({ id: decoded.id, role: decoded.role });

    // 6. Lưu refresh token mới
    await prisma.refreshToken.create({
      data: {
        user_id: decoded.id,
        token: hashToken(newRefreshToken),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  },

  // ── ĐĂNG XUẤT ────────────────────────────────────────────
  async logout(token: string) {
    // Xóa refresh token khỏi DB → token đó không dùng được nữa
    await prisma.refreshToken.deleteMany({
      where: { token: hashToken(token) },
    });
  },

  // ── LẤY THÔNG TIN USER HIỆN TẠI ─────────────────────────
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: { user_badges: { include: { badge: true } } },
        },
      },
    });

    if (!user) {
      throw { statusCode: 404, message: 'Không tìm thấy người dùng' };
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.profile?.full_name,
      student_id: user.profile?.student_id,
      class_name: user.profile?.class_name,
      faculty: user.profile?.faculty,
      phone: user.profile?.phone,
      avatar_url: user.profile?.avatar_url,
      training_points: user.profile?.training_points,
      badges: user.profile?.user_badges.map((ub) => ({
        id: ub.badge.id,
        name: ub.badge.name,
        icon_url: ub.badge.icon_url,
        awarded_at: ub.awarded_at,
      })),
    };
  },
};