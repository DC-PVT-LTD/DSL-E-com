require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');
async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query('SELECT * FROM "StoreSettings"');
    console.log('StoreSettings rows count:', res.rows.length);
    console.log('StoreSettings data:', res.rows);
  } catch (err) {
    console.error('Error querying StoreSettings:', err.message);
  } finally {
    await pool.end();
  }
}
run();

