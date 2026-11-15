require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const o = await pool.query('SELECT * FROM "Order" WHERE "orderNumber" = $1', ['DSL-2026-731398']);
  console.log('ORDER:', o.rows[0]);
  if (o.rows[0]) {
    const items = await pool.query('SELECT * FROM "OrderItem" WHERE "orderId" = $1', [o.rows[0].id]);
    console.log('ITEMS:', items.rows);
    const payAttempts = await pool.query('SELECT * FROM "PaymentAttempt" WHERE "orderId" = $1', [o.rows[0].id]);
    console.log('PAY ATTEMPTS FOR ORDER:', payAttempts.rows);
  }
  await pool.end();
}
run().catch(console.error);

