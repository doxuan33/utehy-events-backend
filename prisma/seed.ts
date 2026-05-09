import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu...');

  // ── 1. XÓA DỮ LIỆU CŨ (theo thứ tự FK) ──────────────────
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.checkin.deleteMany();
  await prisma.qrToken.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.eventCategory.deleteMany();
  await prisma.pageFollower.deleteMany();
  await prisma.pageMember.deleteMany();
  await prisma.page.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Đã xóa dữ liệu cũ');

  // ── 2. DANH MỤC SỰ KIỆN ──────────────────────────────────
  const categories = await Promise.all([
    prisma.eventCategory.create({ data: { name: 'Tình nguyện',     default_training_points: 15, color_hex: '#22C55E' } }),
    prisma.eventCategory.create({ data: { name: 'Học thuật',       default_training_points: 10, color_hex: '#3B82F6' } }),
    prisma.eventCategory.create({ data: { name: 'Văn nghệ - TDTT', default_training_points: 5,  color_hex: '#F59E0B' } }),
    prisma.eventCategory.create({ data: { name: 'Chính trị - XH',  default_training_points: 10, color_hex: '#EF4444' } }),
    prisma.eventCategory.create({ data: { name: 'Kỹ năng mềm',     default_training_points: 5,  color_hex: '#8B5CF6' } }),
    prisma.eventCategory.create({ data: { name: 'Khác',            default_training_points: 5,  color_hex: '#6B7280' } }),
  ]);
  console.log('✅ Tạo danh mục sự kiện');

  // ── 3. HUY HIỆU ──────────────────────────────────────────
  const badges = await Promise.all([
    prisma.badge.create({ data: { name: 'Tân Binh',    description: 'Tham gia sự kiện đầu tiên',         icon_url: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png', condition: 'attended_events >= 1'  } }),
    prisma.badge.create({ data: { name: 'Nhiệt Huyết', description: 'Tham gia 5 sự kiện',                icon_url: 'https://cdn-icons-png.flaticon.com/512/1828/1828919.png', condition: 'attended_events >= 5'  } }),
    prisma.badge.create({ data: { name: 'Cống Hiến',   description: 'Đạt 50 điểm rèn luyện',            icon_url: 'https://cdn-icons-png.flaticon.com/512/1828/1828961.png', condition: 'training_points >= 50' } }),
    prisma.badge.create({ data: { name: 'Xuất Sắc',    description: 'Đạt 100 điểm rèn luyện',           icon_url: 'https://cdn-icons-png.flaticon.com/512/1828/1828970.png', condition: 'training_points >= 100'} }),
    prisma.badge.create({ data: { name: 'Nhà Lãnh Đạo',description: 'Là ban tổ chức của 3 sự kiện',     icon_url: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png', condition: 'organized_events >= 3' } }),
  ]);
  console.log('✅ Tạo huy hiệu');

  // ── 4. TẠO USERS ─────────────────────────────────────────
  const pw = async (plain: string) => bcrypt.hash(plain, 12);

  // System Admin
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@utehy.edu.vn',
      password: await pw('Admin@1234'),
      role: 'SYSTEM_ADMIN',
      is_active: true,
      profile: {
        create: {
          student_id: '00000001',
          full_name: 'Quản Trị Viên UTEHY',
          class_name: 'CTSV',
          faculty: 'Phòng CTSV',
          phone: '0901234567',
          training_points: 0,
        },
      },
    },
  });

  // Page Admin CLB 1
  const pageAdmin1 = await prisma.user.create({
    data: {
      email: 'btc.hocthuat@utehy.edu.vn',
      password: await pw('Admin@1234'),
      role: 'PAGE_ADMIN',
      is_active: true,
      profile: {
        create: {
          student_id: '21100001',
          full_name: 'Trần Thị Minh Châu',
          class_name: 'DHKTPM17A',
          faculty: 'Công nghệ thông tin',
          phone: '0912345678',
          training_points: 25,
        },
      },
    },
  });

  // Page Admin CLB 2
  const pageAdmin2 = await prisma.user.create({
    data: {
      email: 'btc.tinhnguyen@utehy.edu.vn',
      password: await pw('Admin@1234'),
      role: 'PAGE_ADMIN',
      is_active: true,
      profile: {
        create: {
          student_id: '21100002',
          full_name: 'Nguyễn Văn Hoàng',
          class_name: 'DHCK17B',
          faculty: 'Cơ khí',
          phone: '0923456789',
          training_points: 30,
        },
      },
    },
  });

  // Sinh viên 1
  const sv1 = await prisma.user.create({
    data: {
      email: '21104050@utehy.edu.vn',
      password: await pw('Sinhvien@1234'),
      role: 'STUDENT',
      is_active: true,
      profile: {
        create: {
          student_id: '21104050',
          full_name: 'Nguyễn Văn An',
          class_name: 'DHKTPM17A',
          faculty: 'Công nghệ thông tin',
          phone: '0934567890',
          training_points: 40,
        },
      },
    },
  });

  // Sinh viên 2
  const sv2 = await prisma.user.create({
    data: {
      email: '21104051@utehy.edu.vn',
      password: await pw('Sinhvien@1234'),
      role: 'STUDENT',
      is_active: true,
      profile: {
        create: {
          student_id: '21104051',
          full_name: 'Lê Thị Bích',
          class_name: 'DHKTPM17A',
          faculty: 'Công nghệ thông tin',
          phone: '0945678901',
          training_points: 15,
        },
      },
    },
  });

  // Sinh viên 3
  const sv3 = await prisma.user.create({
    data: {
      email: '21104052@utehy.edu.vn',
      password: await pw('Sinhvien@1234'),
      role: 'STUDENT',
      is_active: true,
      profile: {
        create: {
          student_id: '21104052',
          full_name: 'Phạm Văn Cường',
          class_name: 'DHCK17B',
          faculty: 'Cơ khí',
          phone: '0956789012',
          training_points: 5,
        },
      },
    },
  });

  console.log('✅ Tạo users');

  // ── 5. TẠO PAGES (CLB) ───────────────────────────────────
  const page1 = await prisma.page.create({
    data: {
      name: 'CLB Học Thuật UTEHY',
      slug: 'clb-hoc-thuat',
      description: 'Câu lạc bộ học thuật dành cho sinh viên yêu thích nghiên cứu khoa học',
      avatar_url: 'https://picsum.photos/seed/clb1/200',
      cover_url: 'https://picsum.photos/seed/clb1cover/800/300',
      is_verified: true,
      members: {
        create: [
          { user_id: pageAdmin1.id, is_owner: true },
        ],
      },
      followers: {
        create: [
          { user_id: sv1.id },
          { user_id: sv2.id },
        ],
      },
    },
  });

  const page2 = await prisma.page.create({
    data: {
      name: 'CLB Tình Nguyện UTEHY',
      slug: 'clb-tinh-nguyen',
      description: 'Câu lạc bộ tình nguyện - Vì cộng đồng, vì xã hội',
      avatar_url: 'https://picsum.photos/seed/clb2/200',
      cover_url: 'https://picsum.photos/seed/clb2cover/800/300',
      is_verified: true,
      members: {
        create: [
          { user_id: pageAdmin2.id, is_owner: true },
        ],
      },
      followers: {
        create: [
          { user_id: sv1.id },
          { user_id: sv3.id },
        ],
      },
    },
  });

  console.log('✅ Tạo CLB');

  // ── 6. TẠO SỰ KIỆN ───────────────────────────────────────
  const now = new Date();
  const future = (days: number, hours = 8) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hours, 0, 0, 0);
    return d;
  };
  const past = (days: number, hours = 8) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    d.setHours(hours, 0, 0, 0);
    return d;
  };

  // Sự kiện 1: APPROVED - sắp diễn ra
  const event1 = await prisma.event.create({
    data: {
      page_id: page1.id,
      category_id: categories[1].id, // Học thuật
      title: 'Hội thảo AI và Machine Learning 2026',
      description: 'Buổi hội thảo chuyên sâu về ứng dụng AI trong học tập và nghiên cứu khoa học tại UTEHY.',
      location: 'Hội trường A - UTEHY',
      latitude: 20.9517,
      longitude: 106.3333,
      checkin_radius_m: 200,
      start_time: future(7),
      end_time: future(7, 11),
      registration_deadline: future(5),
      max_slots: 100,
      current_slots: 2,
      training_points: 10,
      status: 'APPROVED',
      requires_approval: false,
      banner_url: 'https://picsum.photos/seed/event1/800/400',
    },
  });

  // Sự kiện 2: PENDING - chờ duyệt
  const event2 = await prisma.event.create({
    data: {
      page_id: page1.id,
      category_id: categories[4].id, // Kỹ năng mềm
      title: 'Workshop Kỹ Năng Thuyết Trình',
      description: 'Rèn luyện kỹ năng thuyết trình và giao tiếp hiệu quả trong môi trường chuyên nghiệp.',
      location: 'Phòng học B201 - UTEHY',
      start_time: future(14),
      end_time: future(14, 11),
      registration_deadline: future(10),
      max_slots: 50,
      current_slots: 0,
      training_points: 5,
      status: 'PENDING',
      requires_approval: false,
      banner_url: 'https://picsum.photos/seed/event2/800/400',
    },
  });

  // Sự kiện 3: CLOSED - đã kết thúc
  const event3 = await prisma.event.create({
    data: {
      page_id: page2.id,
      category_id: categories[0].id, // Tình nguyện
      title: 'Ngày Hội Tình Nguyện Mùa Xuân',
      description: 'Hoạt động tình nguyện dọn dẹp vệ sinh môi trường và tặng quà cho người nghèo.',
      location: 'Sân vận động UTEHY',
      start_time: past(10),
      end_time: past(10, 16),
      registration_deadline: past(12),
      max_slots: 200,
      current_slots: 3,
      training_points: 15,
      status: 'CLOSED',
      requires_approval: false,
      banner_url: 'https://picsum.photos/seed/event3/800/400',
    },
  });

  // Sự kiện 4: ONGOING - đang điểm danh
  const event4 = await prisma.event.create({
    data: {
      page_id: page2.id,
      category_id: categories[2].id, // Văn nghệ
      title: 'Liên Hoan Văn Nghệ Sinh Viên 2026',
      description: 'Đêm văn nghệ chào mừng ngày thành lập trường với nhiều tiết mục đặc sắc.',
      location: 'Hội trường lớn - UTEHY',
      latitude: 20.9520,
      longitude: 106.3340,
      checkin_radius_m: 300,
      start_time: past(0),
      end_time: future(0, 22),
      registration_deadline: past(1),
      max_slots: 300,
      current_slots: 2,
      training_points: 5,
      status: 'ONGOING',
      requires_approval: false,
      banner_url: 'https://picsum.photos/seed/event4/800/400',
    },
  });

  console.log('✅ Tạo sự kiện');

  // ── 7. TẠO ĐĂNG KÝ ───────────────────────────────────────
  // Đăng ký sự kiện 1 (APPROVED - sắp tới)
  await prisma.registration.create({
    data: { user_id: sv1.id, event_id: event1.id, status: 'REGISTERED' },
  });
  await prisma.registration.create({
    data: { user_id: sv2.id, event_id: event1.id, status: 'REGISTERED' },
  });

  // Đăng ký sự kiện 3 (CLOSED - đã kết thúc)
  const reg3_sv1 = await prisma.registration.create({
    data: { user_id: sv1.id, event_id: event3.id, status: 'ATTENDED' },
  });
  const reg3_sv2 = await prisma.registration.create({
    data: { user_id: sv2.id, event_id: event3.id, status: 'ATTENDED' },
  });
  const reg3_sv3 = await prisma.registration.create({
    data: { user_id: sv3.id, event_id: event3.id, status: 'ABSENT' },
  });

  // Đăng ký sự kiện 4 (ONGOING - đang điểm danh)
  const reg4_sv1 = await prisma.registration.create({
    data: { user_id: sv1.id, event_id: event4.id, status: 'REGISTERED' },
  });
  await prisma.registration.create({
    data: { user_id: sv3.id, event_id: event4.id, status: 'REGISTERED' },
  });

  console.log('✅ Tạo đăng ký');

  // ── 8. TẠO CHECKIN (cho sự kiện đã CLOSED) ───────────────
  await prisma.checkin.create({
    data: {
      registration_id: reg3_sv1.id,
      user_id: sv1.id,
      method: 'QR_SCAN',
      points_awarded: 15,
      checked_in_at: past(10),
    },
  });
  await prisma.checkin.create({
    data: {
      registration_id: reg3_sv2.id,
      user_id: sv2.id,
      method: 'MANUAL',
      points_awarded: 15,
      checked_in_at: past(10),
    },
  });

  console.log('✅ Tạo checkin');

  // ── 9. TẠO QR TOKEN (cho sự kiện ONGOING) ────────────────
  await prisma.qrToken.create({
    data: {
      event_id: event4.id,
      token: 'test-qr-token-event4-' + Date.now(),
      expires_at: future(0, 23),
    },
  });

  console.log('✅ Tạo QR token');

  // ── 10. TẠO POSTS ─────────────────────────────────────────
  const post1 = await prisma.post.create({
    data: {
      page_id: page1.id,
      author_id: pageAdmin1.id,
      event_id: event1.id,
      content: '🎉 CLB Học Thuật UTEHY thông báo: Hội thảo AI và Machine Learning 2026 đã được mở đăng ký! Đây là cơ hội tuyệt vời để các bạn sinh viên tiếp cận với công nghệ mới nhất. Nhanh tay đăng ký ngay!',
      image_urls: JSON.stringify(['https://picsum.photos/seed/post1/800/400']),
    },
  });

  const post2 = await prisma.post.create({
    data: {
      page_id: page2.id,
      author_id: pageAdmin2.id,
      content: '❤️ Cảm ơn tất cả các bạn tình nguyện viên đã tham gia Ngày Hội Tình Nguyện Mùa Xuân vừa qua! Chúng ta đã cùng nhau làm sạch môi trường và mang lại nụ cười cho nhiều hoàn cảnh khó khăn.',
      image_urls: JSON.stringify([
        'https://picsum.photos/seed/post2a/800/400',
        'https://picsum.photos/seed/post2b/800/400',
      ]),
    },
  });

  console.log('✅ Tạo bài viết');

  // ── 11. TẠO LIKES & COMMENTS ─────────────────────────────
  await prisma.like.create({ data: { user_id: sv1.id, post_id: post1.id } });
  await prisma.like.create({ data: { user_id: sv2.id, post_id: post1.id } });
  await prisma.like.create({ data: { user_id: sv1.id, post_id: post2.id } });

  const comment1 = await prisma.comment.create({
    data: {
      post_id: post1.id,
      user_id: sv1.id,
      content: 'Hay quá! Mình đã đăng ký rồi, mong chờ lắm ạ 🔥',
    },
  });

  await prisma.comment.create({
    data: {
      post_id: post1.id,
      user_id: sv2.id,
      content: 'CLB mình làm event chất lượng thật sự!',
    },
  });

  // Reply comment
  await prisma.comment.create({
    data: {
      post_id: post1.id,
      user_id: pageAdmin1.id,
      parent_id: comment1.id,
      content: 'Cảm ơn bạn đã ủng hộ! Hẹn gặp bạn tại sự kiện nhé 😊',
    },
  });

  // Cập nhật likes_count và comments_count
  await prisma.post.update({ where: { id: post1.id }, data: { likes_count: 2, comments_count: 2 } });
  await prisma.post.update({ where: { id: post2.id }, data: { likes_count: 1, comments_count: 0 } });

  console.log('✅ Tạo likes & comments');

  // ── 12. TẠO NOTIFICATIONS ────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        user_id: sv1.id,
        type: 'EVENT_APPROVED',
        title: '✅ Sự kiện đã được duyệt',
        body: 'Sự kiện "Hội thảo AI và Machine Learning 2026" đã được phê duyệt',
        is_read: false,
      },
      {
        user_id: sv1.id,
        type: 'CHECKIN_SUCCESS',
        title: '✅ Điểm danh thành công',
        body: 'Bạn đã điểm danh sự kiện "Ngày Hội Tình Nguyện Mùa Xuân" và nhận +15 điểm rèn luyện',
        is_read: true,
      },
      {
        user_id: sv2.id,
        type: 'EVENT_NEW',
        title: '🎉 Sự kiện mới từ CLB Học Thuật UTEHY',
        body: 'Hội thảo AI và Machine Learning 2026',
        is_read: false,
      },
    ],
  });

  console.log('✅ Tạo notifications');

  // ── 13. TRAO HUY HIỆU ─────────────────────────────────────
  const sv1Profile = await prisma.profile.findUnique({ where: { user_id: sv1.id } });
  const sv2Profile = await prisma.profile.findUnique({ where: { user_id: sv2.id } });

  if (sv1Profile) {
    await prisma.userBadge.create({
      data: { profile_id: sv1Profile.id, badge_id: badges[0].id }, // Tân Binh
    });
  }
  if (sv2Profile) {
    await prisma.userBadge.create({
      data: { profile_id: sv2Profile.id, badge_id: badges[0].id }, // Tân Binh
    });
  }

  console.log('✅ Trao huy hiệu');

  // ── TỔNG KẾT ─────────────────────────────────────────────
  console.log('\n🎉 Seed hoàn tất! Dữ liệu mẫu:');
  console.log('');
  console.log('👤 Tài khoản:');
  console.log('   System Admin : admin@utehy.edu.vn       / Admin@1234');
  console.log('   Page Admin 1 : btc.hocthuat@utehy.edu.vn / Admin@1234');
  console.log('   Page Admin 2 : btc.tinhnguyen@utehy.edu.vn / Admin@1234');
  console.log('   Sinh viên 1  : 21104050 (MSSV)           / Sinhvien@1234');
  console.log('   Sinh viên 2  : 21104051 (MSSV)           / Sinhvien@1234');
  console.log('   Sinh viên 3  : 21104052 (MSSV)           / Sinhvien@1234');
  console.log('');
  console.log('📋 Sự kiện:');
  console.log('   event1: APPROVED  - Hội thảo AI (sắp tới)');
  console.log('   event2: PENDING   - Workshop Kỹ Năng (chờ duyệt)');
  console.log('   event3: CLOSED    - Tình Nguyện (đã kết thúc)');
  console.log('   event4: ONGOING   - Văn Nghệ (đang điểm danh)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());