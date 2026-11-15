require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');
async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const orders = await pool.query('SELECT id, "orderNumber", "customerEmail", "customerName", "totalCents", "paymentStatus", "orderStatus", "createdAt" FROM "Order"');
  console.log('Orders in DB:', orders.rows);
  const addresses = await pool.query('SELECT id, "userId", "fullName", city, district FROM "Address"');
  console.log('Addresses in DB:', addresses.rows);
  await pool.end();
}
run().catch(console.error);

