import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storeSettingsService } from '../storeSettingsService';
import { apiClient } from '@/lib/api/apiClient';

describe('storeSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPublicSettings', () => {
    it('calls GET /store-settings/public and returns unwrapped data', async () => {
      const mockResponse = {
        success: true,
        data: {
          codEnabled: true,
          onlineCardEnabled: false,
          bankTransferEnabled: true,
          bankTransfer: {
            bankName: 'Commercial Bank of Ceylon',
            accountHolderName: 'DSL Stationery (Pvt) Ltd',
            accountNumber: '1000123456',
            branchName: 'City Office',
            branchCode: '001',
            bankCode: '7010',
            paymentInstructions: 'Deposit total amount.',
            referenceInstructions: 'Enter deposit reference.',
            bankLogoUrl: null,
          },
        },
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockResponse as any);

      const result = await storeSettingsService.getPublicSettings();
      expect(getSpy).toHaveBeenCalledWith('/store-settings/public');
      expect(result.bankTransferEnabled).toBe(true);
      expect(result.bankTransfer?.bankName).toBe('Commercial Bank of Ceylon');
      expect(result.bankTransfer?.accountNumber).toBe('1000123456');
    });

    it('returns bankTransfer as null when Bank Transfer is disabled', async () => {
      const mockResponse = {
        success: true,
        data: {
          codEnabled: true,
          onlineCardEnabled: false,
          bankTransferEnabled: false,
          bankTransfer: null,
        },
      };

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockResponse as any);

      const result = await storeSettingsService.getPublicSettings();
      expect(result.bankTransferEnabled).toBe(false);
      expect(result.bankTransfer).toBeNull();
    });
  });

  describe('getAdminSettings', () => {
    it('calls GET /store-settings/admin and returns full configuration', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'default',
          flatDeliveryFeeCents: 35000,
          freeDeliveryThresholdCents: 500000,
          hotlinePhone: '+94 11 200 9000',
          whatsappNumber: '+94 77 123 4567',
          contactEmail: 'support@dslstationery.lk',
          codEnabled: true,
          bankTransferEnabled: true,
          onlineCardEnabled: false,
          bankTransfer: {
            bankName: 'Commercial Bank',
            accountHolderName: 'DSL Stationery',
            accountNumber: '1000123456',
            maskedAccountNumber: '••••••••3456',
            branchName: 'Main Branch',
            branchCode: '001',
            bankCode: '7010',
            paymentInstructions: 'Transfer exact amount',
            referenceInstructions: 'Use order reference',
            bankLogoUrl: null,
            isConfigComplete: true,
          },
          updatedAt: '2026-11-14T10:00:00.000Z',
        },
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockResponse as any);

      const result = await storeSettingsService.getAdminSettings();
      expect(getSpy).toHaveBeenCalledWith('/store-settings/admin');
      expect(result.bankTransfer.maskedAccountNumber).toBe('••••••••3456');
      expect(result.bankTransfer.isConfigComplete).toBe(true);
    });
  });

  describe('updateBankTransfer', () => {
    it('calls PUT /store-settings/admin/bank-transfer with payload', async () => {
      const payload = {
        bankTransferEnabled: true,
        bankName: 'Hatton National Bank',
        accountHolderName: 'DSL Stationery (Pvt) Ltd',
        accountNumber: '001122334455',
        branchName: 'Corporate Branch',
        branchCode: '010',
        bankCode: '7083',
        paymentInstructions: 'Deposit into HNB corporate account.',
        referenceInstructions: 'Enter your deposit slip reference.',
        bankLogoUrl: 'https://example.com/hnb.png',
      };

      const mockResponse = {
        success: true,
        data: {
          id: 'default',
          bankTransferEnabled: true,
          bankTransfer: {
            ...payload,
            maskedAccountNumber: '••••••••4455',
            isConfigComplete: true,
          },
        },
      };

      const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValueOnce(mockResponse as any);

      const result = await storeSettingsService.updateBankTransfer(payload);
      expect(putSpy).toHaveBeenCalledWith('/store-settings/admin/bank-transfer', payload);
      expect(result.bankTransferEnabled).toBe(true);
      expect(result.bankTransfer.maskedAccountNumber).toBe('••••••••4455');
    });

    it('propagates API error when backend rejects incomplete configuration', async () => {
      vi.spyOn(apiClient, 'put').mockRejectedValueOnce(
        new Error('Cannot enable Bank Transfer without all required details.'),
      );

      await expect(
        storeSettingsService.updateBankTransfer({
          bankTransferEnabled: true,
          bankName: 'Test Bank',
        }),
      ).rejects.toThrow('Cannot enable Bank Transfer without all required details.');
    });
  });
});

