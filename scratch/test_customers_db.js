require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

async function testCustomerQuery() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Query customers
  const customers = await pool.query(`
    SELECT id, name, email, phone, role, "isActive", "isEmailVerified", "createdAt"
    FROM "User"
    WHERE role = 'CUSTOMER'
    ORDER BY "createdAt" DESC
  `);
  console.log('Real customer count from DB:', customers.rows.length);
  console.log('Customers in DB:', customers.rows.map(c => ({ id: c.id, name: c.name, email: c.email, status: c.isActive ? 'Active' : 'Suspended' })));

  // Query admin users to verify exclusion
  const staff = await pool.query(`
    SELECT count(*) FROM "User" WHERE role IN ('ADMIN', 'STAFF', 'MANAGER')
  `);
  console.log('Admin/Staff count excluded from directory:', staff.rows[0].count);

  await pool.end();
}

testCustomerQuery().catch(console.error);

