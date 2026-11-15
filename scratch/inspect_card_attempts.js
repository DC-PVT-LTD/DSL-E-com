require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query('SELECT * FROM "PaymentAttempt" WHERE "paymentMethod" = $1', ['CARD_PAYHERE']);
  console.log('PaymentAttempts for CARD_PAYHERE: count =', res.rowCount);
  res.rows.forEach(r => {
    console.log({
      id: r.id,
      amountCents: r.amountCents,
      status: r.status,
      idempotencyKey: r.idempotencyKey,
      gatewayReference: r.gatewayReference,
      createdAt: r.createdAt,
      gatewayPayloadKeys: r.gatewayPayload ? Object.keys(r.gatewayPayload) : null,
      gatewayPayloadSummary: r.gatewayPayload ? {
        orderId: r.gatewayPayload.orderId,
        paymentMethod: r.gatewayPayload.paymentMethod,
        hasTotals: !!r.gatewayPayload.totals
      } : null
    });
  });
  await pool.end();
}

main().catch(console.error);

