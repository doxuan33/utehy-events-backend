import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { UpdateProfileInput, ChangePasswordInput, GetUsersQuery } from './users.schema';

// Danh sách huy hiệu và điều kiện trao tự động
const BADGE_CONDITIONS = [
  { name: 'Tân Binh',         minEvents: 1,  minPoints: 0  },
  { name: 'Nhiệt Huyết',      minEvents: 5,  minPoints: 0  },
  { name: 'Cống Hiến',        minEvents: 0,  minPoints: 50 },
];

export const usersService = {

  // ── XEM PROFILE BẤT KỲ USER ──────────────────────────────
  async getUserProfile(targetUserId: string) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        profile: {
          include: {
            user_badges: {
              include: { badge: true },
              orderBy: { awarded_at: 'desc' },
            },
          },
        },
      },
    });

    if (!user) {
      throw { statusCode: 404, message: 'Không tìm thấy người dùng' };
    }

    // Đếm số sự kiện đã tham gia
    const attendedCount = await prisma.registration.count({
      where: { user_id: targetUserId, status: 'ATTENDED' },
    });

    // Lấy lịch sử tham gia gần nhất (5 sự kiện)
    const recentEvents = await prisma.registration.findMany({
      where: { user_id: targetUserId, status: 'ATTENDED' },
      take: 5,
      orderBy: { updated_at: 'desc' },
      include: {
        event: {
          select: {
            id: true, title: true, start_time: true,
            training_points: true, banner_url: true,
            page: { select: { name: true } },
            category: { select: { name: true, color_hex: true } },
          },
        },
      },
    });

    // Lấy toàn bộ danh sách sự kiện đã tham gia
    const allParticipatedEvents = await prisma.registration.findMany({
      where: { user_id: targetUserId, status: 'ATTENDED' },
      orderBy: { updated_at: 'desc' },
      include: {
        event: {
          select: {
            id: true, title: true, start_time: true, end_time: true,
            training_points: true, banner_url: true, location: true,
            status: true,
            category: { select: { name: true, color_hex: true } },
            page: { select: { name: true, slug: true, avatar_url: true } },
          },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      full_name: user.profile?.full_name,
      student_id: user.profile?.student_id,
      class_name: user.profile?.class_name,
      faculty: user.profile?.faculty,
      phone: user.profile?.phone,
      avatar_url: user.profile?.avatar_url,
      training_points: user.profile?.training_points ?? 0,
      attended_events_count: attendedCount,
      badges: user.profile?.user_badges.map(ub => ({
        id: ub.badge.id,
        name: ub.badge.name,
        description: ub.badge.description,
        icon_url: ub.badge.icon_url,
        awarded_at: ub.awarded_at,
      })),
      recent_events: recentEvents.map(r => r.event),
      participated_events: allParticipatedEvents.map(r => ({
        registration_id: r.id,
        registered_at: r.registered_at,
        event: r.event,
      })),
    };
  },

  // ── CẬP NHẬT AVATAR (UPLOAD) ─────────────────────────────
  async updateAvatar(userId: string, avatarUrl: string | null) {
    const profile = await prisma.profile.findUnique({
      where: { user_id: userId },
    });

    if (!profile) {
      throw { statusCode: 404, message: 'Không tìm thấy hồ sơ người dùng' };
    }

    const updated = await prisma.profile.update({
      where: { user_id: userId },
      data: {
        avatar_url: avatarUrl,
      },
    });

    return updated;
  },

  // ── CẬP NHẬT PROFILE CỦA BẢN THÂN ───────────────────────
  async updateProfile(userId: string, input: UpdateProfileInput) {
    const profile = await prisma.profile.findUnique({
      where: { user_id: userId },
    });

    if (!profile) {
      throw { statusCode: 404, message: 'Không tìm thấy hồ sơ người dùng' };
    }

    const updated = await prisma.profile.update({
      where: { user_id: userId },
      data: {
        ...(input.full_name  && { full_name: input.full_name }),
        ...(input.class_name && { class_name: input.class_name }),
        ...(input.faculty    && { faculty: input.faculty }),
        ...(input.phone      && { phone: input.phone }),
        ...(input.avatar_url && { avatar_url: input.avatar_url }),
      },
    });

    return updated;
  },

  // ── ĐỔI MẬT KHẨU ─────────────────────────────────────────
  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw { statusCode: 404, message: 'Không tìm thấy người dùng' };
    }

    // Kiểm tra mật khẩu hiện tại
    const isValid = await bcrypt.compare(input.current_password, user.password);
    if (!isValid) {
      throw { statusCode: 400, message: 'Mật khẩu hiện tại không đúng' };
    }

    const hashed = await bcrypt.hash(input.new_password, 12);

    // Đổi mật khẩu + xóa toàn bộ refresh token (bắt đăng nhập lại)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password: hashed },
      }),
      prisma.refreshToken.deleteMany({ where: { user_id: userId } }),
    ]);
  },

  // ── XEM ĐIỂM RÈN LUYỆN CHI TIẾT ─────────────────────────
  async getTrainingPoints(userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { user_id: userId },
      select: { training_points: true },
    });

    if (!profile) {
      throw { statusCode: 404, message: 'Không tìm thấy hồ sơ' };
    }

    // Lấy lịch sử cộng điểm từ checkins
    const pointHistory = await prisma.checkin.findMany({
      where: { user_id: userId, points_awarded: { gt: 0 } },
      orderBy: { checked_in_at: 'desc' },
      include: {
        registration: {
          include: {
            event: {
              select: {
                id: true, title: true, start_time: true,
                category: { select: { name: true, color_hex: true } },
                page: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // Thống kê theo danh mục
    const categoryStats = await prisma.checkin.groupBy({
      by: ['registration_id'],
      where: { user_id: userId },
      _sum: { points_awarded: true },
    });

    return {
      total_points: profile.training_points,
      history: pointHistory.map(c => ({
        points: c.points_awarded,
        checked_in_at: c.checked_in_at,
        method: c.method,
        event: c.registration.event,
      })),
    };
  },

  // ── TỰ ĐỘNG TRAO HUY HIỆU sau khi check-in ───────────────
  async checkAndAwardBadges(userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { user_id: userId },
      select: { id: true, training_points: true },
    });

    if (!profile) return;

    const attendedCount = await prisma.registration.count({
      where: { user_id: userId, status: 'ATTENDED' },
    });

    // Lấy huy hiệu user đã có
    const ownedBadges = await prisma.userBadge.findMany({
      where: { profile_id: profile.id },
      select: { badge: { select: { name: true } } },
    });
    const ownedNames = ownedBadges.map(b => b.badge.name);

    for (const condition of BADGE_CONDITIONS) {
      // Bỏ qua nếu đã có huy hiệu này
      if (ownedNames.includes(condition.name)) continue;

      const meetsEvents = condition.minEvents === 0 || attendedCount >= condition.minEvents;
      const meetsPoints = condition.minPoints === 0 || profile.training_points >= condition.minPoints;

      if (meetsEvents && meetsPoints) {
        const badge = await prisma.badge.findUnique({
          where: { name: condition.name },
        });
        if (badge) {
          await prisma.userBadge.create({
            data: { profile_id: profile.id, badge_id: badge.id },
          });
        }
      }
    }
  },

  // ── LẤY DANH SÁCH USER (SYSTEM_ADMIN) ────────────────────
  async getUsers(query: GetUsersQuery) {
    const { page, limit, search, role } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(role && { role }),
      ...(search && {
        OR: [
          { email: { contains: search } },
          { profile: { full_name: { contains: search } } },
          { profile: { student_id: { contains: search } } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true, email: true, role: true, is_active: true, created_at: true,
          profile: {
            select: {
              full_name: true, student_id: true, class_name: true,
              avatar_url: true, training_points: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  },

  // ── KHÓA / MỞ KHÓA TÀI KHOẢN (SYSTEM_ADMIN) ─────────────
  async toggleUserActive(targetUserId: string, adminId: string) {
    if (targetUserId === adminId) {
      throw { statusCode: 400, message: 'Không thể khóa tài khoản của chính mình' };
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw { statusCode: 404, message: 'Không tìm thấy người dùng' };
    }
    if (user.role === 'SYSTEM_ADMIN') {
      throw { statusCode: 403, message: 'Không thể khóa tài khoản System Admin' };
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { is_active: !user.is_active },
      select: { id: true, email: true, is_active: true, role: true },
    });

    // Nếu khóa tài khoản → xóa toàn bộ refresh token
    if (!updated.is_active) {
      await prisma.refreshToken.deleteMany({ where: { user_id: targetUserId } });
    }

    return {
      ...updated,
      message: updated.is_active ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản',
    };
  },

  // ── IMPORT SINH VIÊN TỪ EXCEL ──────────────────────────────
  async bulkCreateStudents(students: any[]) {
    // Hàm làm sạch chuỗi
    const cleanString = (str: any): string => {
      if (typeof str !== 'string') return '';
      return str.trim().replace(/\s+/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '');
    };

    // Hàm viết hoa các từ
    const capitalizeWords = (str: string): string => {
      return str.replace(/\b\w/g, (l) => l.toUpperCase());
    };

    // Hàm làm sạch số điện thoại
    const cleanPhone = (phone: any): string | null => {
      if (!phone) return null;
      const cleaned = String(phone).replace(/[^0-9+]/g, '').trim();
      if (cleaned.startsWith('84')) return '0' + cleaned.slice(2);
      if (cleaned.startsWith('+84')) return '0' + cleaned.slice(3);
      return cleaned;
    };

    const DEFAULT_PASSWORD = 'Student@123';
    const results = { success: 0, failed: 0, errors: [] as { row: number; student_id: string; message: string }[] };

    // Hash password 1 lần duy nhất
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // Gom tất cả email và MSSV (loại bỏ rỗng) để check trùng 1 lần
    const emails = students.map(s => s.email || s['Email']).filter(Boolean);
    const studentIds = students.map(s => s.student_id || s.MSSV || s['Mã số sinh viên']).filter(Boolean);

    // Kiểm tra trùng lặp bằng 1 query duy nhất
    const existingUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { in: emails } },
          { profile: { student_id: { in: studentIds } } }
        ]
      },
      include: { profile: true }
    });

    if (existingUsers.length > 0) {
      throw new Error('Có sinh viên trong danh sách đã tồn tại (trùng Email hoặc MSSV)!');
    }

    // Tạo mảng operations - NADATTLE ARRAY, KHÔNG for...of bên trong transaction
    const operations: any[] = [];

    for (let i = 0; i < students.length; i++) {
      const data = students[i];
      const rowIndex = i + 2;

      try {
        const studentIdRaw = data.student_id || data.MSSV || data['Mã số sinh viên'];
        if (!studentIdRaw) {
          results.failed++;
          results.errors.push({
            row: rowIndex,
            student_id: 'N/A',
            message: 'Thiếu MSSV'
          });
          continue;
        }

        const studentId = cleanString(studentIdRaw);
        if (!/^\d{8,10}$/.test(studentId)) {
          results.failed++;
          results.errors.push({
            row: rowIndex,
            student_id: studentId,
            message: `MSSV không hợp lệ: ${studentId}`
          });
          continue;
        }

        const fullNameRaw = data.full_name || data['Họ và tên'] || data['Họ tên'];
        if (!fullNameRaw) {
          results.failed++;
          results.errors.push({
            row: rowIndex,
            student_id: studentId,
            message: 'Thiếu họ tên'
          });
          continue;
        }
        const full_name = capitalizeWords(cleanString(fullNameRaw));

        const class_name = data.class_name || data['Lớp'] || data['Lớp học'];
        const class_clean = class_name ? cleanString(class_name).toUpperCase() : '';

        const faculty = data.faculty || data['Khoa'] || data['Tên khoa'];
        const faculty_clean = faculty ? capitalizeWords(cleanString(faculty)) : '';

        const phoneRaw = data.phone || data['Số điện thoại'] || data['SDT'];
        const phone = phoneRaw ? cleanPhone(phoneRaw) : null;
        if (phone && !/^(0|\+84)[0-9]{9}$/.test(phone)) {
          results.failed++;
          results.errors.push({
            row: rowIndex,
            student_id: studentId,
            message: `Số điện thoại không hợp lệ: ${phone}`
          });
          continue;
        }

        const emailRaw = data.email || data['Email'];
        const finalEmail = emailRaw ? cleanString(emailRaw).toLowerCase() : `${studentId}@student.utehy.edu.vn`;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)) {
          results.failed++;
          results.errors.push({
            row: rowIndex,
            student_id: studentId,
            message: `Email không hợp lệ: ${finalEmail}`
          });
          continue;
        }

        // Thêm operation vào mảng (KHÔNG await ở đây)
        operations.push(
          prisma.user.create({
            data: {
              email: finalEmail,
              password: hashedPassword,
              role: 'STUDENT',
              profile: {
                create: {
                  full_name,
                  student_id: studentId,
                  class_name: class_clean,
                  faculty: faculty_clean,
                  phone,
                  training_points: 0,
                }
              }
            }
          })
        );
      } catch (err: any) {
        results.failed++;
        const student_id = (data.student_id || data.MSSV || 'N/A').toString();
        results.errors.push({
          row: rowIndex,
          student_id,
          message: err.message || 'Lỗi không xác định'
        });
      }
    }

    // Nếu không có operation nào thì trả về kết quả
    if (operations.length === 0) {
      return results;
    }

    // Bắn toàn bộ operations vào DB trong 1 nhịp duy nhất
    // Prisma sẽ tự batching và tối ưu connection
    await prisma.$transaction(operations);

    results.success = operations.length;
    return results;
  },
};

export default usersService;
