const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const env = dotenv.parse(fs.readFileSync(path.resolve('backend', '.env'), 'utf-8'));
const pool = new Pool({ connectionString: env.DATABASE_URL });

async function check() {
  const count = await pool.query('SELECT COUNT(*) FROM "StockReservation"');
  console.log('Total StockReservation rows:', count.rows[0].count);

  const recent = await pool.query('SELECT id, "sessionId", status, "expiresAt", "createdAt" FROM "StockReservation" ORDER BY "createdAt" DESC LIMIT 30');
  console.log('Recent reservations:');
  console.table(recent.rows);

  const bySession = await pool.query(`
    SELECT "sessionId", COUNT(*) as cnt, MIN("createdAt") as first_created, MAX("createdAt") as last_created
    FROM "StockReservation"
    GROUP BY "sessionId"
    ORDER BY cnt DESC
    LIMIT 10
  `);
  console.log('\nTop sessions by reservation count:');
  console.table(bySession.rows);

  await pool.end();
}

check().catch(console.error);

