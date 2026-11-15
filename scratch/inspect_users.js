require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');
async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const users = await pool.query('SELECT id, email, name, phone, role, "roleId", "isActive", "createdAt" FROM "User"');
  console.log('Total users:', users.rows.length);
  console.log(users.rows);
  const orders = await pool.query('SELECT count(*), count("userId") as with_user FROM "Order"');
  console.log('Total orders:', orders.rows[0]);
  const sampleOrders = await pool.query('SELECT id, "orderNumber", "userId", "customerName", "customerEmail", "totalCents", "createdAt" FROM "Order" LIMIT 5');
  console.log('Sample orders:', sampleOrders.rows);
  await pool.end();
}
run().catch(console.error);

