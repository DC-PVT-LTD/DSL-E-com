require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');
async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const perms = await pool.query('SELECT key, "displayName", category FROM permissions ORDER BY category, key');
  console.log('Total permissions:', perms.rows.length);
  console.log(perms.rows);
  await pool.end();
}
run().catch(console.error);
