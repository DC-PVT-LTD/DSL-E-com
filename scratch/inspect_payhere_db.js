require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const settingsRes = await pool.query('SELECT * FROM "StoreSettings" WHERE id = $1', ['default']);
  console.log('StoreSettings row:');
  console.log(JSON.stringify(settingsRes.rows[0], null, 2));

  const attemptsRes = await pool.query(
    'SELECT id, "amountCents", "paymentMethod", status, "gatewayReference", "createdAt" FROM "PaymentAttempt" ORDER BY "createdAt" DESC LIMIT 10'
  );
  console.log('\nPaymentAttempts count:', attemptsRes.rowCount);
  console.table(attemptsRes.rows);

  const cardOrdersRes = await pool.query(
    'SELECT id, "orderNumber", "totalCents", "paymentMethod", "paymentStatus", "orderStatus", "createdAt" FROM "Order" WHERE "paymentMethod" = $1 ORDER BY "createdAt" DESC LIMIT 10',
    ['CARD_PAYHERE']
  );
  console.log('\nCARD_PAYHERE Orders count:', cardOrdersRes.rowCount);
  console.table(cardOrdersRes.rows);

  const allOrdersRes = await pool.query(
    'SELECT "paymentMethod", "paymentStatus", count(*) FROM "Order" GROUP BY "paymentMethod", "paymentStatus"'
  );
  console.log('\nOrders grouped by paymentMethod & paymentStatus:');
  console.table(allOrdersRes.rows);

  await pool.end();
}

main().catch(console.error);
