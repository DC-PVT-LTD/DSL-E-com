import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StoreSettingsService, STORE_SETTINGS_DEFAULT_ID } from './store-settings.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('StoreSettingsService - PostgreSQL Integration Tests (dsl_stationery_test)', () => {
  let pool: Pool;
  let prisma: PrismaService;
  let auditService: AuditService;
  let service: StoreSettingsService;
  let activeDatabase: string;

  beforeAll(async () => {
    const testDbUrl = process.env.TEST_DATABASE_URL;
    if (!testDbUrl || !testDbUrl.includes('dsl_stationery_test')) {
      throw new Error('CRITICAL SAFETY VIOLATION: TEST_DATABASE_URL does not point to dsl_stationery_test');
    }

    pool = new Pool({ connectionString: testDbUrl });

    // CRITICAL DATABASE SAFETY GUARD
    const dbCheck = await pool.query('SELECT current_database()');
    activeDatabase = dbCheck.rows[0].current_database;
    if (activeDatabase !== 'dsl_stationery_test') {
      throw new Error(`CRITICAL SAFETY ABORT: Connected to ${activeDatabase}, expected dsl_stationery_test!`);
    }

    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter }) as unknown as PrismaService;
    auditService = new AuditService(prisma);
    service = new StoreSettingsService(prisma, auditService);

    // Clean existing StoreSettings row in test database
    await pool.query('DELETE FROM "StoreSettings" WHERE id = $1', [STORE_SETTINGS_DEFAULT_ID]);

    // Ensure a valid admin user exists for AuditLog foreign key
    await prisma.user.upsert({
      where: { email: 'admin-stage3-1@test.com' },
      update: {},
      create: {
        id: 'test-admin-stage3-1',
        email: 'admin-stage3-1@test.com',
        name: 'Stage 3.1 Test Admin',
        role: 'ADMIN',
      },
    });
  });

  afterAll(async () => {
    // Reset test row
    if (pool && activeDatabase === 'dsl_stationery_test') {
      await pool.query('DELETE FROM "StoreSettings" WHERE id = $1', [STORE_SETTINGS_DEFAULT_ID]);
      await pool.end();
    }
  });

  it('confirms the active database is strictly dsl_stationery_test', () => {
    expect(activeDatabase).toBe('dsl_stationery_test');
  });

  it('safely initializes StoreSettings record on first read without exposing bank transfer', async () => {
    await prisma.storeSettings.deleteMany({
      where: { id: STORE_SETTINGS_DEFAULT_ID },
    });
    const publicSettings = await service.getPublicSettings();
    expect(publicSettings.bankTransferEnabled).toBe(false);
    expect(publicSettings.bankTransfer).toBeNull();
    expect(publicSettings.codEnabled).toBe(true);

    const dbRow = await prisma.storeSettings.findUnique({
      where: { id: STORE_SETTINGS_DEFAULT_ID },
    });
    expect(dbRow).not.toBeNull();
    expect(dbRow?.bankTransferEnabled).toBe(false);
    expect(dbRow?.bankName).toBeNull();
  });

  it('enforces backend completeness validation when attempting to enable Bank Transfer', async () => {
    await expect(
      service.updateBankTransferSettings(
        {
          bankTransferEnabled: true,
          bankName: 'Test Commercial Bank',
          // Missing account number, holder, branch, instructions
        },
        'test-admin-stage3-1',
      ),
    ).rejects.toThrow('Cannot enable Bank Transfer without all required details');
  });

  it('persists complete bank details in PostgreSQL and activates public endpoint', async () => {
    const validConfig = {
      bankTransferEnabled: true,
      bankName: 'Hatton National Bank',
      accountHolderName: 'DSL Stationery (Pvt) Ltd',
      accountNumber: '009988776655',
      branchName: 'Head Office Branch',
      branchCode: '001',
      bankCode: '7083',
      paymentInstructions: 'Please transfer funds to HNB account and use order number as reference.',
      referenceInstructions: 'Enter your 12-digit transaction ID.',
      bankLogoUrl: 'https://example.com/hnb.png',
    };

    const adminResult = await service.updateBankTransferSettings(validConfig, 'test-admin-stage3-1');

    expect(adminResult.bankTransferEnabled).toBe(true);
    expect(adminResult.bankTransfer.isConfigComplete).toBe(true);
    expect(adminResult.bankTransfer.maskedAccountNumber).toBe('••••••••6655');

    // Verify in PostgreSQL database directly
    const pgCheck = await pool.query('SELECT * FROM "StoreSettings" WHERE id = $1', [
      STORE_SETTINGS_DEFAULT_ID,
    ]);
    expect(pgCheck.rows.length).toBe(1);
    expect(pgCheck.rows[0].bankName).toBe('Hatton National Bank');
    expect(pgCheck.rows[0].accountNumber).toBe('009988776655');
    expect(pgCheck.rows[0].bankTransferEnabled).toBe(true);

    // Verify public endpoint returns complete details
    const publicSettings = await service.getPublicSettings();
    expect(publicSettings.bankTransferEnabled).toBe(true);
    expect(publicSettings.bankTransfer).not.toBeNull();
    expect(publicSettings.bankTransfer?.bankName).toBe('Hatton National Bank');
    expect(publicSettings.bankTransfer?.accountNumber).toBe('009988776655');

    // Verify AuditLog in PostgreSQL
    const auditCheck = await pool.query(
      'SELECT * FROM "AuditLog" WHERE "entityType" = $1 AND "entityId" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      ['StoreSettings', STORE_SETTINGS_DEFAULT_ID],
    );
    expect(auditCheck.rows.length).toBe(1);
    expect(auditCheck.rows[0].userId).toBe('test-admin-stage3-1');
    expect(auditCheck.rows[0].action).toBe('UPDATE_STORE_SETTINGS');
    // Ensure raw account number is NOT in the audit description
    expect(auditCheck.rows[0].description).not.toContain('009988776655');
    expect(auditCheck.rows[0].description).toContain('••••••••6655');
  });

  it('allows disabling Bank Transfer while preserving configured bank information', async () => {
    const adminResult = await service.updateBankTransferSettings(
      {
        bankTransferEnabled: false,
      },
      'test-admin-stage3-1',
    );

    expect(adminResult.bankTransferEnabled).toBe(false);
    expect(adminResult.bankTransfer.bankName).toBe('Hatton National Bank');
    expect(adminResult.bankTransfer.accountNumber).toBe('009988776655');

    // Public endpoint must now suppress Bank Transfer
    const publicSettings = await service.getPublicSettings();
    expect(publicSettings.bankTransferEnabled).toBe(false);
    expect(publicSettings.bankTransfer).toBeNull();
  });
});
