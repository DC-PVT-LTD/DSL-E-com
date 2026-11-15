require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query('SELECT id, "userId", city, district FROM "Address" LIMIT 10');
  console.log('Saved addresses in DB:', res.rows);
  await pool.end();
}

main().catch(console.error);

