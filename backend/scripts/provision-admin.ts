import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '../src/generated/prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.PROVISION_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PROVISION_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Error: PROVISION_ADMIN_EMAIL and PROVISION_ADMIN_PASSWORD environment variables are required.');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('Error: PROVISION_ADMIN_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    if (existingUser.role === UserRole.ADMIN) {
      console.log(`Admin user '${email}' already exists. No password changes made.`);
      process.exit(0);
    } else {
      console.error(`Error: User '${email}' exists but has role '${existingUser.role}'. Manual promotion required.`);
      process.exit(1);
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      name: 'System Administrator',
      role: UserRole.ADMIN,
      passwordHash,
      isActive: true,
    },
  });

  console.log(`Administrator account created successfully: ${email}`);
}

main()
  .catch((e) => {
    console.error('Error running admin provisioning script:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

