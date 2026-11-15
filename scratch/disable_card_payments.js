require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  console.log('--- Setting StoreSettings.onlineCardEnabled = false ---');
  const updateRes = await pool.query(`
    UPDATE "StoreSettings"
    SET "onlineCardEnabled" = false, "updatedAt" = NOW()
    WHERE id = 'default'
    RETURNING id, "onlineCardEnabled", "codEnabled", "bankTransferEnabled", "updatedAt"
  `);
  console.log('UPDATED SETTINGS:');
  console.table(updateRes.rows);

  console.log('--- Verification Read-Back ---');
  const readRes = await pool.query(`
    SELECT id, "onlineCardEnabled", "codEnabled", "bankTransferEnabled", "updatedAt"
    FROM "StoreSettings"
    WHERE id = 'default'
  `);
  console.table(readRes.rows);

  if (readRes.rows[0].onlineCardEnabled === false) {
    console.log('VERIFICATION CONFIRMED: onlineCardEnabled is strictly false.');
  } else {
    throw new Error('Verification failed: onlineCardEnabled is not false!');
  }

  await pool.end();
}

run().catch(console.error);

