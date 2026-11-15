require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('=== 1. ALL PAYMENT ATTEMPTS (Recent 5) ===');
  const attempts = await pool.query(`
    SELECT id, status, "amountCents", "idempotencyKey", "gatewayReference", "orderId", "reservationId", "createdAt", "updatedAt"
    FROM "PaymentAttempt"
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);
  console.table(attempts.rows);

  console.log('=== 2. ALL ORDERS (Recent 5) ===');
  const orders = await pool.query(`
    SELECT id, "orderNumber", "paymentStatus", "orderStatus", "paymentMethod", "totalCents", "subtotalCents", "deliveryCents", "discountCents", "customerEmail", "customerName", "createdAt"
    FROM "Order"
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);
  console.table(orders.rows);

  console.log('=== 3. ORDER ITEMS FOR LATEST ORDER ===');
  if (orders.rows.length > 0) {
    const latestOrderId = orders.rows[0].id;
    const items = await pool.query(`
      SELECT id, "orderId", "productId", "quantity", "unitPriceCents", "totalPriceCents", "productName"
      FROM "OrderItem"
      WHERE "orderId" = $1
    `, [latestOrderId]);
    console.table(items.rows);
  }

  console.log('=== 4. STOCK RESERVATIONS (Recent 5) ===');
  const reservations = await pool.query(`
    SELECT id, status, "sessionId", "orderId", "expiresAt", "createdAt"
    FROM "StockReservation"
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);
  console.table(reservations.rows);

  console.log('=== 5. PROTECTED PRODUCT (cmw0j4cro00089kusmwsbv48t) ===');
  const protectedProd = await pool.query(`
    SELECT id, name, "stockQuantity"
    FROM "Product"
    WHERE id = 'cmw0j4cro00089kusmwsbv48t'
  `);
  console.table(protectedProd.rows);

  console.log('=== 6. PURCHASED PRODUCT (prod-dsl-107) ===');
  const purchasedProd = await pool.query(`
    SELECT id, name, "stockQuantity"
    FROM "Product"
    WHERE id = 'prod-dsl-107'
  `);
  console.table(purchasedProd.rows);

  console.log('=== 7. STORE SETTINGS ===');
  const settings = await pool.query(`
    SELECT id, "onlineCardEnabled", "codEnabled", "bankTransferEnabled"
    FROM "StoreSettings"
  `);
  console.table(settings.rows);

  await pool.end();
}

main().catch(console.error);
