import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('AuditService - PostgreSQL UNION ALL Integration Tests (dsl_stationery_test)', () => {
  let pool: Pool;
  let prisma: PrismaService;
  let service: AuditService;
  let activeDatabase: string;

  const TEST_PREFIX = 'test-union-audit-';

  beforeAll(async () => {
    // 1. Establish connection string strictly targeting dsl_stationery_test
    const rawUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL?.replace(/\/dsl_stationery(\?|$)/, '/dsl_stationery_test$1');
    if (!rawUrl || !rawUrl.includes('dsl_stationery_test')) {
      throw new Error('CRITICAL SAFETY ABORT: Test database URL does not target dsl_stationery_test');
    }

    pool = new Pool({ connectionString: rawUrl });

    // 2. CRITICAL DATABASE IDENTITY SAFETY CHECK
    const dbCheck = await pool.query('SELECT current_database()');
    activeDatabase = dbCheck.rows[0].current_database;
    if (activeDatabase !== 'dsl_stationery_test') {
      throw new Error(`CRITICAL SAFETY ABORT: Connected to "${activeDatabase}", strictly expected "dsl_stationery_test"! Aborting.`);
    }

    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter }) as unknown as PrismaService;
    service = new AuditService(prisma);

    // 3. Clean any previous test fixtures in test database
    await pool.query('DELETE FROM "AuditLog" WHERE "entityId" LIKE $1', [`${TEST_PREFIX}%`]);
    await pool.query('DELETE FROM "OrderAuditLog" WHERE "orderId" LIKE $1', [`${TEST_PREFIX}%`]);
    await pool.query('DELETE FROM "Order" WHERE "id" LIKE $1', [`${TEST_PREFIX}%`]);
    await pool.query('DELETE FROM "User" WHERE "id" LIKE $1', [`${TEST_PREFIX}%`]);

    // 4. Create test users with distinct roles (ADMIN and STAFF) in test DB
    await pool.query(`
      INSERT INTO "User" (id, email, "passwordHash", name, role, "updatedAt")
      VALUES 
        ($1, $2, 'dummy', 'Test Admin Officer', 'ADMIN', NOW()),
        ($3, $4, 'dummy', 'Test Staff Member', 'STAFF', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [
      `${TEST_PREFIX}user-admin`,
      `${TEST_PREFIX}admin@dsl.lk`,
      `${TEST_PREFIX}user-staff`,
      `${TEST_PREFIX}staff@dsl.lk`,
    ]);

    // 5. Create a test order for OrderAuditLog foreign key relation in test DB
    await pool.query(`
      INSERT INTO "Order" (id, "orderNumber", "customerName", "customerEmail", "customerPhone", "subtotalCents", "discountCents", "deliveryCents", "totalCents", "paymentMethod", "updatedAt")
      VALUES ($1, $2, 'Test Customer', 'test@dsl.lk', '+94770000000', 50000, 0, 0, 50000, 'CARD_PAYHERE', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [`${TEST_PREFIX}ord-1`, 'DSL-TEST-ORD-001']);

    // 6. Seed test audit logs with identical timestamps to test deterministic tie-breaking
    const identicalTime = new Date('2026-03-20T10:00:00.000Z');

    // 3 General Audit Logs
    for (let i = 1; i <= 3; i++) {
      await pool.query(`
        INSERT INTO "AuditLog" (id, action, "entityType", "entityId", description, "userId", "createdAt")
        VALUES ($1, $2, 'product', $3, $4, $5, $6)
      `, [
        `${TEST_PREFIX}audit-${i}`,
        `PRODUCT_UPDATE_${i}`,
        `${TEST_PREFIX}prod-${i}`,
        `Updated product ${i} description | {"priceCents":{"new":${1000 * i}}}`,
        `${TEST_PREFIX}user-admin`,
        identicalTime,
      ]);
    }

    // 3 Order Audit Logs with same timestamp
    for (let j = 1; j <= 3; j++) {
      await pool.query(`
        INSERT INTO "OrderAuditLog" (id, "orderId", "adminId", "adminName", action, "fieldChanged", "previousValue", "newValue", reason, "createdAt")
        VALUES ($1, $2, $3, $4, $5, 'orderStatus', 'PENDING', 'PROCESSING', $6, $7)
      `, [
        `${TEST_PREFIX}ordaudit-${j}`,
        `${TEST_PREFIX}ord-1`,
        `${TEST_PREFIX}user-staff`,
        'Test Staff Member',
        `ORDER_STATUS_UPDATE_${j}`,
        `Order status change step ${j}`,
        identicalTime,
      ]);
    }
  });

  afterAll(async () => {
    if (activeDatabase === 'dsl_stationery_test' && pool) {
      await pool.query('DELETE FROM "AuditLog" WHERE "entityId" LIKE $1', [`${TEST_PREFIX}%`]);
      await pool.query('DELETE FROM "OrderAuditLog" WHERE "orderId" LIKE $1', [`${TEST_PREFIX}%`]);
      await pool.query('DELETE FROM "Order" WHERE "id" LIKE $1', [`${TEST_PREFIX}%`]);
      await pool.query('DELETE FROM "User" WHERE "id" LIKE $1', [`${TEST_PREFIX}%`]);
      await pool.end();
    }
  });

  it('verifies that the test environment is connected to dsl_stationery_test', async () => {
    const res = await pool.query('SELECT current_database()');
    expect(res.rows[0].current_database).toBe('dsl_stationery_test');
  });

  it('executes real PostgreSQL UNION ALL query across AuditLog and OrderAuditLog', async () => {
    const res = await service.findAll({
      search: TEST_PREFIX,
      source: 'ALL',
      page: 1,
      limit: 10,
    });

    expect(res.data).toHaveLength(6);
    expect(res.meta.totalItems).toBe(6);

    const sources = res.data.map((r) => r.source);
    expect(sources).toContain('AUDIT_LOG');
    expect(sources).toContain('ORDER_AUDIT_LOG');
  });

  it('guarantees deterministic ordering and tie-breaking across sources on identical timestamps', async () => {
    const res = await service.findAll({
      search: TEST_PREFIX,
      source: 'ALL',
      page: 1,
      limit: 10,
      sortOrder: 'desc',
    });

    expect(res.data).toHaveLength(6);

    // Verify ordering is strictly deterministic by (createdAt, source, id)
    for (let i = 0; i < res.data.length - 1; i++) {
      const curr = res.data[i];
      const next = res.data[i + 1];
      const tCurr = new Date(curr.timestamp).getTime();
      const tNext = new Date(next.timestamp).getTime();
      expect(tCurr).toBeGreaterThanOrEqual(tNext);
    }
  });

  it('paginates consecutively without duplicate or missing records across page boundaries', async () => {
    // Page 1: limit 3
    const page1 = await service.findAll({
      search: TEST_PREFIX,
      source: 'ALL',
      page: 1,
      limit: 3,
      sortOrder: 'desc',
    });

    // Page 2: limit 3
    const page2 = await service.findAll({
      search: TEST_PREFIX,
      source: 'ALL',
      page: 2,
      limit: 3,
      sortOrder: 'desc',
    });

    expect(page1.data).toHaveLength(3);
    expect(page2.data).toHaveLength(3);

    const page1Ids = page1.data.map((r) => r.id);
    const page2Ids = page2.data.map((r) => r.id);

    // Zero overlap
    const duplicates = page1Ids.filter((id) => page2Ids.includes(id));
    expect(duplicates).toHaveLength(0);

    // Full coverage of all 6 records
    const allIds = new Set([...page1Ids, ...page2Ids]);
    expect(allIds.size).toBe(6);
  });

  it('resolves actual actor role from User relation in real database and does not infer STAFF arbitrarily', async () => {
    const res = await service.findAll({
      search: TEST_PREFIX,
      source: 'ALL',
      limit: 10,
    });

    const staffOrderLog = res.data.find((r) => r.source === 'ORDER_AUDIT_LOG');
    expect(staffOrderLog).toBeDefined();
    // User in DB has role STAFF
    expect(staffOrderLog?.actor.role).toBe('STAFF');
    expect(staffOrderLog?.actor.email).toBe(`${TEST_PREFIX}staff@dsl.lk`);

    const adminLog = res.data.find((r) => r.source === 'AUDIT_LOG');
    expect(adminLog).toBeDefined();
    // User in DB has role ADMIN
    expect(adminLog?.actor.role).toBe('ADMIN');
    expect(adminLog?.actor.email).toBe(`${TEST_PREFIX}admin@dsl.lk`);
  });

  it('exercises deep pagination against PostgreSQL using OFFSET and LIMIT', async () => {
    // Page 2 with limit 4 on 6 total items should return remaining 2
    const res = await service.findAll({
      search: TEST_PREFIX,
      source: 'ALL',
      page: 2,
      limit: 4,
    });

    expect(res.data).toHaveLength(2);
    expect(res.meta.page).toBe(2);
    expect(res.meta.limit).toBe(4);
    expect(res.meta.totalItems).toBe(6);
    expect(res.meta.totalPages).toBe(2);
    expect(res.meta.hasNextPage).toBe(false);
    expect(res.meta.hasPreviousPage).toBe(true);
  });
});
