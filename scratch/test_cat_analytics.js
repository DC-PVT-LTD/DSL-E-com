require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const counts = await pool.query(`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE "parentId" IS NULL)::int AS "parents",
      COUNT(*) FILTER (WHERE "parentId" IS NOT NULL)::int AS "subcategories",
      COUNT(*) FILTER (WHERE "featured" = true)::int AS "featured"
    FROM "Category";
  `);
  console.log('Category Counts:', counts.rows[0]);

  const catUsage = await pool.query(`
    SELECT
      COUNT(DISTINCT c.id) FILTER (WHERE p.id IS NOT NULL OR sp.id IS NOT NULL)::int AS "withProducts",
      COUNT(DISTINCT c.id) FILTER (WHERE p.id IS NULL AND sp.id IS NULL)::int AS "empty"
    FROM "Category" c
    LEFT JOIN "Product" p ON p."categoryId" = c.id
    LEFT JOIN "Product" sp ON sp."subcategoryId" = c.id;
  `);
  console.log('Category usage:', catUsage.rows[0]);

  const brandCounts = await pool.query(`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE "featured" = true)::int AS "featured"
    FROM "Brand";
  `);
  console.log('Brand Counts:', brandCounts.rows[0]);

  const brandUsage = await pool.query(`
    SELECT
      COUNT(DISTINCT b.id) FILTER (WHERE p.id IS NOT NULL)::int AS "withProducts",
      COUNT(DISTINCT b.id) FILTER (WHERE p.id IS NULL AND sp.id IS NULL)::int AS "empty"
    FROM "Brand" b
    LEFT JOIN "Product" p ON p."brandId" = b.id
    LEFT JOIN "Product" sp ON sp."brandId" = b.id;
  `);
  console.log('Brand usage:', brandUsage.rows[0]);

  await pool.end();
}

main().catch(console.error);
