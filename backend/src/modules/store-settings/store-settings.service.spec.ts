import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { StoreSettingsService, STORE_SETTINGS_DEFAULT_ID, maskAccountNumber } from './store-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('StoreSettingsService', () => {
  let service: StoreSettingsService;
  let mockPrisma: any;
  let mockAudit: any;

  const validBankConfig = {
    bankTransferEnabled: true,
    bankName: 'Commercial Bank of Ceylon',
    accountHolderName: 'DSL Stationery (Pvt) Ltd',
    accountNumber: '100012345678',
    branchName: 'Kollupitiya Branch',
    branchCode: '003',
    bankCode: '7010',
    paymentInstructions: 'Please deposit total amount and use Order ID as reference.',
    referenceInstructions: 'Enter your 8-digit transaction number.',
    bankLogoUrl: 'https://example.com/logo.png',
  };

  beforeEach(() => {
    mockPrisma = {
      storeSettings: {
        findUnique: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
      },
    };

    mockAudit = {
      recordAuditLog: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    service = new StoreSettingsService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('maskAccountNumber', () => {
    it('returns null for null, undefined, or empty values', () => {
      expect(maskAccountNumber(null)).toBeNull();
      expect(maskAccountNumber(undefined)).toBeNull();
      expect(maskAccountNumber('')).toBeNull();
      expect(maskAccountNumber('   ')).toBeNull();
    });

    it('returns bullets for short numbers (<= 4 chars)', () => {
      expect(maskAccountNumber('1234')).toBe('••••');
      expect(maskAccountNumber('99')).toBe('••••');
    });

    it('masks all but the last 4 characters for standard numbers', () => {
      expect(maskAccountNumber('123456789012')).toBe('••••••••9012');
      expect(maskAccountNumber('100012345678')).toBe('••••••••5678');
    });
  });

  describe('Initialization & Retrieval', () => {
    it('creates default settings row when no record exists', async () => {
      mockPrisma.storeSettings.findUnique.mockResolvedValue(null);
      mockPrisma.storeSettings.create.mockResolvedValue({
        id: STORE_SETTINGS_DEFAULT_ID,
        flatDeliveryFeeCents: 35000,
        freeDeliveryThresholdCents: 500000,
        hotlinePhone: '+94 11 200 9000',
        whatsappNumber: '+94 77 123 4567',
        contactEmail: 'support@dslstationery.lk',
        codEnabled: true,
        bankTransferEnabled: false,
        onlineCardEnabled: false,
        bankName: null,
        accountHolderName: null,
        accountNumber: null,
        branchName: null,
        branchCode: null,
        bankCode: null,
        paymentInstructions: null,
        referenceInstructions: null,
        bankLogoUrl: null,
        updatedAt: new Date(),
      });

      const res = await service.getPublicSettings();
      expect(mockPrisma.storeSettings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: STORE_SETTINGS_DEFAULT_ID,
            bankTransferEnabled: false,
            bankName: null,
          }),
        }),
      );
      expect(res.bankTransferEnabled).toBe(false);
      expect(res.bankTransfer).toBeNull();
    });
  });

  describe('Public Endpoint Availability Guard', () => {
    it('suppresses Bank Transfer when bankTransferEnabled is false', async () => {
      mockPrisma.storeSettings.findUnique.mockResolvedValue({
        id: STORE_SETTINGS_DEFAULT_ID,
        codEnabled: true,
        onlineCardEnabled: false,
        ...validBankConfig,
        bankTransferEnabled: false,
        updatedAt: new Date(),
      });

      const res = await service.getPublicSettings();
      expect(res.bankTransferEnabled).toBe(false);
      expect(res.bankTransfer).toBeNull();
    });

    it('suppresses Bank Transfer when enabled in DB but bank details are null or incomplete', async () => {
      mockPrisma.storeSettings.findUnique.mockResolvedValue({
        id: STORE_SETTINGS_DEFAULT_ID,
        codEnabled: true,
        onlineCardEnabled: false,
        bankTransferEnabled: true, // Legacy or misconfigured flag
        bankName: 'Some Bank',
        accountHolderName: null, // Incomplete!
        accountNumber: null,
        branchName: null,
        paymentInstructions: null,
        referenceInstructions: null,
        updatedAt: new Date(),
      });

      const res = await service.getPublicSettings();
      expect(res.bankTransferEnabled).toBe(false);
      expect(res.bankTransfer).toBeNull();
    });

    it('suppresses Bank Transfer when required fields contain only whitespace', async () => {
      mockPrisma.storeSettings.findUnique.mockResolvedValue({
        id: STORE_SETTINGS_DEFAULT_ID,
        codEnabled: true,
        onlineCardEnabled: false,
        bankTransferEnabled: true,
        bankName: '   ',
        accountHolderName: '   ',
        accountNumber: '   ',
        branchName: '   ',
        paymentInstructions: '   ',
        referenceInstructions: '   ',
        updatedAt: new Date(),
      });

      const res = await service.getPublicSettings();
      expect(res.bankTransferEnabled).toBe(false);
      expect(res.bankTransfer).toBeNull();
    });

    it('returns sanitized bank instructions when complete and enabled', async () => {
      mockPrisma.storeSettings.findUnique.mockResolvedValue({
        id: STORE_SETTINGS_DEFAULT_ID,
        codEnabled: true,
        onlineCardEnabled: false,
        bankTransferEnabled: true,
        ...validBankConfig,
        updatedAt: new Date(),
      });

      const res = await service.getPublicSettings();
      expect(res.bankTransferEnabled).toBe(true);
      expect(res.bankTransfer).not.toBeNull();
      expect(res.bankTransfer?.bankName).toBe('Commercial Bank of Ceylon');
      expect(res.bankTransfer?.accountNumber).toBe('100012345678');
      expect(res.bankTransfer?.branchCode).toBe('003');
    });
  });

  describe('Admin Settings & Updates', () => {
    it('returns isConfigComplete true when all fields are populated', async () => {
      mockPrisma.storeSettings.findUnique.mockResolvedValue({
        id: STORE_SETTINGS_DEFAULT_ID,
        flatDeliveryFeeCents: 35000,
        freeDeliveryThresholdCents: 500000,
        hotlinePhone: '+94 11 200 9000',
        whatsappNumber: '+94 77 123 4567',
        contactEmail: 'support@dslstationery.lk',
        codEnabled: true,
        onlineCardEnabled: false,
        ...validBankConfig,
        updatedAt: new Date(),
      });

      const adminRes = await service.getAdminSettings();
      expect(adminRes.bankTransfer.isConfigComplete).toBe(true);
      expect(adminRes.bankTransfer.maskedAccountNumber).toBe('••••••••5678');
      expect(adminRes.bankTransfer.accountNumber).toBe('••••••••5678');

      const unmaskedRes = await service.getAdminSettings(true);
      expect(unmaskedRes.bankTransfer.accountNumber).toBe('100012345678');
    });

    it('rejects enabling Bank Transfer with missing required fields (400 Bad Request)', async () => {
      mockPrisma.storeSettings.findUnique.mockResolvedValue({
        id: STORE_SETTINGS_DEFAULT_ID,
        bankTransferEnabled: false,
        bankName: null,
      });

      await expect(
        service.updateBankTransferSettings(
          {
            bankTransferEnabled: true,
            bankName: 'Test Bank',
            // Missing accountHolderName, accountNumber, branchName, paymentInstructions, referenceInstructions
          },
          'admin-user-123',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects input exceeding maximum length constraints', async () => {
      await expect(
        service.updateBankTransferSettings(
          {
            bankTransferEnabled: false,
            bankName: 'A'.repeat(101),
          },
          'admin-user-123',
        ),
      ).rejects.toThrow('Bank name must not exceed 100 characters.');
    });

    it('successfully persists valid bank configuration and records masked audit log', async () => {
      const existingRecord = {
        id: STORE_SETTINGS_DEFAULT_ID,
        bankTransferEnabled: false,
        bankName: null,
        accountHolderName: null,
        accountNumber: null,
        branchName: null,
        branchCode: null,
        bankCode: null,
        paymentInstructions: null,
        referenceInstructions: null,
        bankLogoUrl: null,
        updatedAt: new Date(),
      };

      const updatedRecord = {
        ...existingRecord,
        ...validBankConfig,
      };

      mockPrisma.storeSettings.findUnique
        .mockResolvedValueOnce(existingRecord) // getOrCreate in update
        .mockResolvedValueOnce(updatedRecord); // getAdminSettings at end

      mockPrisma.storeSettings.upsert.mockResolvedValue(updatedRecord);

      const result = await service.updateBankTransferSettings(validBankConfig, 'admin-user-456');

      expect(mockPrisma.storeSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: STORE_SETTINGS_DEFAULT_ID },
          create: expect.objectContaining({
            bankTransferEnabled: true,
            accountNumber: '100012345678',
          }),
        }),
      );

      // Verify Audit Log Masking
      expect(mockAudit.recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_STORE_SETTINGS',
          entityType: 'StoreSettings',
          userId: 'admin-user-456',
          changes: expect.objectContaining({
            bankTransferEnabled: { old: false, new: true },
            accountNumber: { old: null, new: '••••••••5678' }, // MASKED!
            bankName: { old: null, new: 'Commercial Bank of Ceylon' },
          }),
        }),
      );

      expect(result.bankTransfer.isConfigComplete).toBe(true);
    });

    it('allows disabling Bank Transfer without deleting existing bank details', async () => {
      const existingRecord = {
        id: STORE_SETTINGS_DEFAULT_ID,
        ...validBankConfig,
        bankTransferEnabled: true,
        updatedAt: new Date(),
      };

      const updatedRecord = {
        ...existingRecord,
        bankTransferEnabled: false,
      };

      mockPrisma.storeSettings.findUnique
        .mockResolvedValueOnce(existingRecord)
        .mockResolvedValueOnce(updatedRecord);

      mockPrisma.storeSettings.upsert.mockResolvedValue(updatedRecord);

      const result = await service.updateBankTransferSettings(
        {
          bankTransferEnabled: false,
        },
        'admin-user-789',
      );

      expect(result.bankTransferEnabled).toBe(false);
      expect(mockAudit.recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            bankTransferEnabled: { old: true, new: false },
          }),
        }),
      );
    });
  });
});
