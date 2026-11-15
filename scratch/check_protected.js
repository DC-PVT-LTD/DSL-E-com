const path = require('path');
require(path.join(__dirname, '../backend/node_modules/dotenv')).config({ path: 'backend/.env' });
const { Pool } = require(path.join(__dirname, '../backend/node_modules/pg'));

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prodRes = await pool.query(
    'SELECT id, name, sku, "stockQuantity" FROM "Product" WHERE id = $1',
    ['cmw0j4cro00089kusmwsbv48t']
  );
  console.log('Protected product verification:', prodRes.rows[0]);

  const orderRes = await pool.query('SELECT COUNT(*) FROM "Order"');
  console.log('Total orders in dev DB:', orderRes.rows[0].count);

  const refundRes = await pool.query('SELECT COUNT(*) FROM "RefundRecord"');
  console.log('Total refunds in dev DB:', refundRes.rows[0].count);

  await pool.end();
}

main().catch(console.error);
