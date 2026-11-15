const path = require('path');
const { Pool } = require(path.join(__dirname, '../backend/node_modules/pg'));

async function main() {
  const pool = new Pool({ connectionString: 'postgresql://postgres:yehara123@A@localhost:5432/dsl_stationery?schema=public' });
  const users = await pool.query('SELECT id, email, role, "roleId" FROM "User" WHERE email = $1', ['admin@dslstationery.lk']);
  console.log('Admin in dev DB:', users.rows[0]);
  const roles = await pool.query('SELECT id, slug, name FROM roles');
  console.log('Roles in dev DB:', roles.rows);
  await pool.end();
}

main().catch(console.error);
