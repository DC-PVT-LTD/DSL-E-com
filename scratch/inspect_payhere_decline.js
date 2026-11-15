require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  const attempts = await pool.query(`
    SELECT id, status, "amountCents", "idempotencyKey", "gatewayReference", "createdAt"
    FROM "PaymentAttempt"
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);
  console.log('RECENT PAYMENT ATTEMPTS:');
  console.table(attempts.rows);

  const orders = await pool.query(`
    SELECT id, "orderNumber", "paymentStatus", "orderStatus", "createdAt"
    FROM "Order"
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);
  console.log('RECENT ORDERS:');
  console.table(orders.rows);

  const reservations = await pool.query(`
    SELECT id, status, "sessionId", "expiresAt", "createdAt"
    FROM "StockReservation"
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);
  console.log('RECENT RESERVATIONS:');
  console.table(reservations.rows);

  const protectedProd = await pool.query(`
    SELECT id, name, "stockQuantity"
    FROM "Product"
    WHERE id = 'cmw0j4cro00089kusmwsbv48t'
  `);
  console.log('PROTECTED PRODUCT:', protectedProd.rows[0]);

  await pool.end();
}

main().catch(console.error);

