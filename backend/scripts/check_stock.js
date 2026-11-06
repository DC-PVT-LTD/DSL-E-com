const path = require('path');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../src/generated/prisma');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const p = await prisma.product.findUnique({ where: { id: 'cmw0j4cro00089kusmwsbv48t' } });
  console.log('Protected Product:', p ? { id: p.id, name: p.name, stockQuantity: p.stockQuantity } : 'NOT FOUND');
  await prisma.$disconnect();
  await pool.end();
}
main();

