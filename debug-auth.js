const prisma = require('./src/config/database').default;

async function debug() {
  try {
    const profile = await prisma.profile.findUnique({
      where: { student_id: '21104050' },
      include: { user: true },
    });

    console.log('Profile found:', !!profile);
    if (profile) {
      console.log('Student ID:', profile.student_id);
      console.log('User email:', profile.user.email);
      console.log('User password hash:', profile.user.password);
      console.log('User is_active:', profile.user.is_active);
    } else {
      const count = await prisma.profile.count();
      console.log('Total profiles in DB:', count);
      const firstFive = await prisma.profile.findMany({ take: 5, select: { student_id: true, full_name: true } });
      console.log('First 5 profiles:', firstFive);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debug();
