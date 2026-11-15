require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE "isActive" = true)::int AS "active",
      COUNT(*) FILTER (WHERE "isActive" = false)::int AS "inactive",
      COUNT(*) FILTER (WHERE "stockQuantity" = 0)::int AS "outOfStock",
      COUNT(*) FILTER (WHERE "stockQuantity" > 0 AND "stockQuantity" <= "lowStockThreshold")::int AS "lowStock",
      COUNT(*) FILTER (WHERE "stockQuantity" > "lowStockThreshold")::int AS "healthy"
    FROM "Product";
  `);
  console.log('Product stock health analytics:', res.rows[0]);

  const brandRes = await pool.query(`
    SELECT b.id, b.name, COUNT(p.id)::int AS count
    FROM "Brand" b
    LEFT JOIN "Product" p ON p."brandId" = b.id
    GROUP BY b.id, b.name
    ORDER BY count DESC
    LIMIT 10;
  `);
  console.log('Top Brands:', brandRes.rows);

  const catRes = await pool.query(`
    SELECT c.id, c.name, COUNT(p.id)::int AS count
    FROM "Category" c
    LEFT JOIN "Product" p ON p."categoryId" = c.id
    WHERE c."parentId" IS NULL
    GROUP BY c.id, c.name
    ORDER BY count DESC
    LIMIT 10;
  `);
  console.log('Top Parent Categories:', catRes.rows);

  await pool.end();
}

main().catch(console.error);

