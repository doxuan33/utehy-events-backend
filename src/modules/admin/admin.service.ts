import prisma from '../../config/database';

export const adminService = {

  // ── DASHBOARD TỔNG QUAN ───────────────────────────────────
  async getDashboard() {
    const [
      totalUsers,
      totalStudents,
      totalPageAdmins,
      totalPages,
      totalEvents,
      pendingEvents,
      approvedEvents,
      totalRegistrations,
      totalCheckins,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.user.count({ where: { role: 'PAGE_ADMIN' } }),
      prisma.page.count(),
      prisma.event.count(),
      prisma.event.count({ where: { status: 'PENDING' } }),
      prisma.event.count({ where: { status: 'APPROVED' } }),
      prisma.registration.count(),
      prisma.checkin.count(),
    ]);

    // Thống kê sự kiện theo danh mục
    const eventsByCategory = await prisma.event.groupBy({
      by: ['category_id'],
      _count: { id: true },
      where: { status: 'APPROVED' },
    });

    // Lấy tên danh mục
    const categories = await prisma.eventCategory.findMany();
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    // Top 5 sự kiện có nhiều đăng ký nhất
    const topEvents = await prisma.event.findMany({
      where: { status: { in: ['APPROVED', 'ONGOING', 'CLOSED'] } },
      orderBy: { current_slots: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        current_slots: true,
        max_slots: true,
        start_time: true,
        training_points: true,
        page: { select: { name: true } },
        category: { select: { name: true, color_hex: true } },
      },
    });

    // Top 5 sinh viên có điểm rèn luyện cao nhất
    const topStudents = await prisma.profile.findMany({
      orderBy: { training_points: 'desc' },
      take: 5,
      select: {
        full_name: true,
        student_id: true,
        class_name: true,
        training_points: true,
        avatar_url: true,
      },
    });

    // Thống kê đăng ký theo tháng (6 tháng gần nhất)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentRegistrations = await prisma.registration.findMany({
      where: { registered_at: { gte: sixMonthsAgo } },
      select: { registered_at: true },
      orderBy: { registered_at: 'asc' },
    });

    // Group theo tháng
    const registrationsByMonth: Record<string, number> = {};
    recentRegistrations.forEach(r => {
      const key = `${r.registered_at.getFullYear()}-${String(r.registered_at.getMonth() + 1).padStart(2, '0')}`;
      registrationsByMonth[key] = (registrationsByMonth[key] || 0) + 1;
    });

    return {
      summary: {
        total_users: totalUsers,
        total_students: totalStudents,
        total_page_admins: totalPageAdmins,
        total_pages: totalPages,
        total_events: totalEvents,
        pending_events: pendingEvents,
        approved_events: approvedEvents,
        total_registrations: totalRegistrations,
        total_checkins: totalCheckins,
        checkin_rate: totalRegistrations > 0
          ? Math.round((totalCheckins / totalRegistrations) * 100)
          : 0,
      },
      events_by_category: eventsByCategory.map(e => ({
        category: e.category_id ? categoryMap.get(e.category_id) : 'Chưa phân loại',
        count: e._count.id,
      })),
      top_events: topEvents,
      top_students: topStudents,
      registrations_by_month: Object.entries(registrationsByMonth).map(
        ([month, count]) => ({ month, count })
      ),
    };
  },

  // ── DANH SÁCH SỰ KIỆN CHỜ DUYỆT ─────────────────────────
  async getPendingEvents() {
    return prisma.event.findMany({
      where: { status: 'PENDING' },
      orderBy: { created_at: 'asc' },
      include: {
        page: { select: { id: true, name: true, avatar_url: true } },
        category: true,
        _count: { select: { registrations: true } },
      },
    });
  },

  // ── BÁO CÁO ĐIỂM RÈN LUYỆN TOÀN TRƯỜNG ──────────────────
  async getTrainingPointsReport(semester?: string) {
    const profiles = await prisma.profile.findMany({
      where: { training_points: { gt: 0 } },
      orderBy: { training_points: 'desc' },
      include: {
        user: { select: { email: true, is_active: true } },
        user_badges: { include: { badge: true } },
      },
    });

    const total = profiles.length;
    const avgPoints = total > 0
      ? Math.round(profiles.reduce((s, p) => s + p.training_points, 0) / total)
      : 0;

    // Phân loại theo mức điểm
    const excellent = profiles.filter(p => p.training_points >= 90).length;
    const good      = profiles.filter(p => p.training_points >= 70 && p.training_points < 90).length;
    const average   = profiles.filter(p => p.training_points >= 50 && p.training_points < 70).length;
    const below     = profiles.filter(p => p.training_points < 50).length;

    return {
      semester: semester || 'Toàn thời gian',
      summary: {
        total_students: total,
        average_points: avgPoints,
        excellent,  // >= 90
        good,       // 70-89
        average,    // 50-69
        below,      // < 50
      },
      students: profiles.map(p => ({
        student_id: p.student_id,
        full_name: p.full_name,
        class_name: p.class_name,
        faculty: p.faculty,
        email: p.user.email,
        training_points: p.training_points,
        badges_count: p.user_badges.length,
        badges: p.user_badges.map(ub => ub.badge.name),
      })),
    };
  },

  // ── THỐNG KÊ THEO CLB ────────────────────────────────────
  async getPageStats() {
    const pages = await prisma.page.findMany({
      include: {
        _count: {
          select: {
            followers: true,
            events: true,
            posts: true,
          },
        },
        events: {
          where: { status: { in: ['APPROVED', 'ONGOING', 'CLOSED'] } },
          select: {
            _count: { select: { registrations: true } },
            training_points: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return pages.map(page => ({
      id: page.id,
      name: page.name,
      slug: page.slug,
      avatar_url: page.avatar_url,
      is_verified: page.is_verified,
      followers_count: page._count.followers,
      events_count: page._count.events,
      posts_count: page._count.posts,
      total_registrations: page.events.reduce(
        (sum, e) => sum + e._count.registrations, 0
      ),
    }));
  },

  // ── QUẢN LÝ DANH MỤC SỰ KIỆN ─────────────────────────────
  async createCategory(name: string, defaultPoints: number, colorHex?: string) {
    const existing = await prisma.eventCategory.findUnique({ where: { name } });
    if (existing) {
      throw { statusCode: 409, message: 'Danh mục này đã tồn tại' };
    }

    return prisma.eventCategory.create({
      data: {
        name,
        default_training_points: defaultPoints,
        color_hex: colorHex,
      },
    });
  },

  async updateCategory(
    id: number,
    data: { name?: string; default_training_points?: number; color_hex?: string }
  ) {
    const category = await prisma.eventCategory.findUnique({ where: { id } });
    if (!category) {
      throw { statusCode: 404, message: 'Không tìm thấy danh mục' };
    }

    return prisma.eventCategory.update({ where: { id }, data });
  },

  async deleteCategory(id: number) {
    const category = await prisma.eventCategory.findUnique({ where: { id } });
    if (!category) {
      throw { statusCode: 404, message: 'Không tìm thấy danh mục' };
    }

    const inUse = await prisma.event.count({ where: { category_id: id } });
    if (inUse > 0) {
      throw {
        statusCode: 400,
        message: `Không thể xóa danh mục đang được dùng bởi ${inUse} sự kiện`,
      };
    }

    await prisma.eventCategory.delete({ where: { id } });
  },

  // ── QUẢN LÝ HUY HIỆU ─────────────────────────────────────
  async getBadges() {
    return prisma.badge.findMany({
      include: { _count: { select: { user_badges: true } } },
      orderBy: { id: 'asc' },
    });
  },

  async createBadge(data: {
    name: string;
    description: string;
    icon_url: string;
    condition: string;
  }) {
    const existing = await prisma.badge.findUnique({ where: { name: data.name } });
    if (existing) {
      throw { statusCode: 409, message: 'Huy hiệu này đã tồn tại' };
    }

    return prisma.badge.create({ data });
  },

  // ── THỐNG KÊ SỰ KIỆN THEO THỜI GIAN ─────────────────────
  async getEventStats(year?: number) {
    const targetYear = year || new Date().getFullYear();
    const start = new Date(`${targetYear}-01-01`);
    const end   = new Date(`${targetYear}-12-31`);

    const events = await prisma.event.findMany({
      where: { created_at: { gte: start, lte: end } },
      select: {
        status: true,
        created_at: true,
        training_points: true,
        current_slots: true,
        _count: { select: { registrations: true } },
      },
    });

    // Group theo tháng
    const byMonth: Record<string, { total: number; approved: number; registrations: number }> = {};

    events.forEach(e => {
      const month = String(e.created_at.getMonth() + 1).padStart(2, '0');
      const key = `${targetYear}-${month}`;
      if (!byMonth[key]) {
        byMonth[key] = { total: 0, approved: 0, registrations: 0 };
      }
      byMonth[key].total++;
      if (e.status === 'APPROVED' || e.status === 'CLOSED') {
        byMonth[key].approved++;
      }
      byMonth[key].registrations += e._count.registrations;
    });

    return {
      year: targetYear,
      total_events: events.length,
      by_month: Object.entries(byMonth).map(([month, stats]) => ({
        month,
        ...stats,
      })),
      by_status: {
        pending:  events.filter(e => e.status === 'PENDING').length,
        approved: events.filter(e => e.status === 'APPROVED').length,
        rejected: events.filter(e => e.status === 'REJECTED').length,
        ongoing:  events.filter(e => e.status === 'ONGOING').length,
        closed:   events.filter(e => e.status === 'CLOSED').length,
      },
    };
  },
};