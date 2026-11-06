const { PrismaClient } = require('./backend/src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER', 'STAFF'] } }
  });
  console.log('Admin users:', admins.map(u => ({ id: u.id, email: u.email, role: u.role, active: u.isActive })));

  const tokens = await prisma.refreshToken.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true, role: true } } }
  });
  console.log('Recent refresh tokens:', JSON.stringify(tokens, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);

