const url = process.env.TEST_DATABASE_URL || 'postgresql://postgres:yehara123%40A@localhost:5432/dsl_stationery_test?schema=public';
console.log('Target DB URL:', url.replace(/:[^:@]+@/, ':****@'));
if (!url.includes('dsl_stationery_test')) {
  console.error('Safety check failed: Not dsl_stationery_test');
  process.exit(1);
}
const { Pool } = require('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/backend/node_modules/pg');
const pool = new Pool({ connectionString: url });
async function check() {
  const res = await pool.query('SELECT current_database(), count(*) FROM "PaymentAttempt"');
  console.log('Connected to DB:', res.rows[0].current_database);
  console.log('PaymentAttempt count:', res.rows[0].count);
  const attempts = await pool.query('SELECT id, "orderId", "amountCents", "paymentMethod", status, "gatewayReference", "createdAt" FROM "PaymentAttempt" ORDER BY "createdAt" DESC LIMIT 15');
  console.log('Sample attempts:', JSON.stringify(attempts.rows, null, 2));
  await pool.end();
}
check().catch(console.error);

