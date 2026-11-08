import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promotionService } from '../promotionService';
import { apiClient } from '@/lib/api/apiClient';
import { PromotionValidationResult, PromotionReportingSummary } from '@/types/promotion';

vi.mock('@/lib/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('promotionService (Frontend API Client)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Customer Endpoints', () => {
    it('validates a promo code authoritatively', async () => {
      const mockResult: PromotionValidationResult = {
        valid: true,
        code: 'WELCOME10',
        promotionId: 'promo-1',
        promotionName: 'Welcome 10%',
        promotionType: 'PERCENTAGE',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        discountAmountCents: 5000,
        eligibleBaseCents: 50000,
        bundleDiscountCents: 0,
        isFreeDelivery: false,
        isStackableWithSchoolPacks: false,
        message: 'Promo code WELCOME10 applied: 10% off',
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        success: true,
        data: mockResult,
      });

      const result = await promotionService.validatePromoCode({
        code: 'welcome10',
        items: [{ productId: 'prod-1', quantity: 2 }],
      });

      expect(apiClient.post).toHaveBeenCalledWith('promotions/validate', {
        code: 'welcome10',
        items: [{ productId: 'prod-1', quantity: 2 }],
      });
      expect(result.valid).toBe(true);
      expect(result.discountAmountCents).toBe(5000);
    });

    it('applies a promo code to cart', async () => {
      const mockResult: PromotionValidationResult = {
        valid: true,
        code: 'FREESHIP',
        promotionId: 'promo-2',
        promotionName: 'Free Islandwide Delivery',
        promotionType: 'FREE_DELIVERY',
        discountType: 'FREE_DELIVERY',
        discountValue: 0,
        discountAmountCents: 35000,
        eligibleBaseCents: 50000,
        bundleDiscountCents: 0,
        isFreeDelivery: true,
        isStackableWithSchoolPacks: true,
        message: 'Free delivery applied',
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        success: true,
        data: mockResult,
      });

      const result = await promotionService.applyPromoCode({
        code: 'FREESHIP',
        items: [{ productId: 'prod-1', quantity: 1 }],
      });

      expect(apiClient.post).toHaveBeenCalledWith('promotions/apply', {
        code: 'FREESHIP',
        items: [{ productId: 'prod-1', quantity: 1 }],
      });
      expect(result.isFreeDelivery).toBe(true);
    });

    it('removes applied promo code', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        success: true,
        data: { removed: true },
      });

      const result = await promotionService.removePromoCode();
      expect(apiClient.post).toHaveBeenCalledWith('promotions/remove', {});
      expect(result.removed).toBe(true);
    });
  });

  describe('Admin Endpoints', () => {
    it('fetches promotions with search and filters', async () => {
      const mockList = {
        items: [
          {
            id: 'promo-1',
            name: 'Back to School',
            status: 'ACTIVE',
            promotionType: 'PERCENTAGE',
            priority: 10,
            isStackableWithSchoolPacks: false,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        success: true,
        data: mockList,
      });

      const result = await promotionService.getAdminPromotions({
        status: 'ACTIVE',
        search: 'Back',
      });

      expect(apiClient.get).toHaveBeenCalledWith('admin/promotions', {
        params: { status: 'ACTIVE', search: 'Back' },
      });
      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe('Back to School');
    });

    it('creates a new promotion with isStackableWithSchoolPacks flag', async () => {
      const mockPromo = {
        id: 'promo-new',
        name: 'Flash Sale',
        promotionType: 'FIXED_AMOUNT',
        discountValue: 50000,
        status: 'ACTIVE',
        isStackableWithSchoolPacks: true,
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-30T23:59:59.000Z',
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        success: true,
        data: mockPromo,
      });

      const result = await promotionService.createPromotion({
        name: 'Flash Sale',
        promotionType: 'FIXED_AMOUNT',
        discountValue: 50000,
        status: 'ACTIVE',
        isStackableWithSchoolPacks: true,
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-30T23:59:59.000Z',
      });

      expect(apiClient.post).toHaveBeenCalledWith('admin/promotions', expect.objectContaining({
        isStackableWithSchoolPacks: true,
      }));
      expect(result.id).toBe('promo-new');
    });

    it('fetches redemptions audit for a promotion', async () => {
      const mockRedemptions = {
        redemptions: [
          {
            id: 'red-1',
            promotionId: 'promo-1',
            orderId: 'order-1',
            discountAmountCents: 25000,
            redeemedAt: '2026-11-06T12:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        success: true,
        data: mockRedemptions,
      });

      const result = await promotionService.getPromotionRedemptions('promo-1', 1, 20);
      expect(apiClient.get).toHaveBeenCalledWith('admin/promotions/promo-1/redemptions', {
        params: { page: 1, limit: 20 },
      });
      expect(result.total).toBe(1);
    });

    it('fetches reporting summary with revenue metrics', async () => {
      const mockSummary: PromotionReportingSummary = {
        totalPromotions: 5,
        activePromotions: 3,
        expiredPromotions: 1,
        scheduledPromotions: 1,
        disabledPromotions: 0,
        draftPromotions: 0,
        totalRedemptions: 42,
        totalDiscountValueCents: 1500000,
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        success: true,
        data: mockSummary,
      });

      const result = await promotionService.getReportingSummary();
      expect(apiClient.get).toHaveBeenCalledWith('admin/promotions/reporting/summary');
      expect(result.totalRedemptions).toBe(42);
      expect(result.totalDiscountValueCents).toBe(1500000);
    });
  });
});
