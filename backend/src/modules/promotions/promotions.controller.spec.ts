import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromotionsController } from './promotions.controller';
import { AdminPromotionsController } from './admin-promotions.controller';
import { PromotionsService } from './promotions.service';
import { PromotionType, DiscountType, PromotionStatus } from '../../generated/prisma';

describe('Promotions Controllers', () => {
  let customerController: PromotionsController;
  let adminController: AdminPromotionsController;
  let mockPromotionsService: any;

  beforeEach(() => {
    mockPromotionsService = {
      calculateAuthoritativeDiscount: vi.fn(),
      listPromotions: vi.fn(),
      getPromotionById: vi.fn(),
      createPromotion: vi.fn(),
      updatePromotion: vi.fn(),
      deletePromotion: vi.fn(),
      activatePromotion: vi.fn(),
      deactivatePromotion: vi.fn(),
      addPromoCode: vi.fn(),
      generateUniquePromoCode: vi.fn(),
      getPromotionRedemptions: vi.fn(),
      getReportingSummary: vi.fn(),
    };

    customerController = new PromotionsController(mockPromotionsService as PromotionsService);
    adminController = new AdminPromotionsController(mockPromotionsService as PromotionsService);
  });

  describe('Customer Controller', () => {
    it('validates promo code for customer request', async () => {
      mockPromotionsService.calculateAuthoritativeDiscount.mockResolvedValueOnce({
        valid: true,
        code: 'PROMO10',
        promotionId: 'p-1',
        promotionName: 'Promo 10',
        promotionType: PromotionType.PERCENTAGE,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
        discountAmountCents: 5000,
        isFreeDelivery: false,
        isStackableWithSchoolPacks: false,
        eligibleBaseCents: 50000,
        bundleDiscountCents: 0,
        message: 'Promo code PROMO10 applied successfully!',
      });

      const req: any = { user: { id: 'user-1', email: 'cust@example.com' } };
      const res = await customerController.validatePromoCode(
        {
          code: 'PROMO10',
          items: [{ productId: 'prod-1', quantity: 2 }],
        },
        req
      );

      expect(res.data.valid).toBe(true);
      expect(res.data.discountAmountCents).toBe(5000);
      expect(mockPromotionsService.calculateAuthoritativeDiscount).toHaveBeenCalledWith(
        'PROMO10',
        [{ productId: 'prod-1', quantity: 2 }],
        undefined,
        'user-1',
        'cust@example.com'
      );
    });

    it('removes applied promo code successfully', async () => {
      const res = await customerController.removePromoCode();
      expect(res.data.removed).toBe(true);
    });
  });

  describe('Admin Controller', () => {
    it('lists promotions with pagination', async () => {
      mockPromotionsService.listPromotions.mockResolvedValueOnce({
        items: [{ id: 'p-1', name: 'Promo 1' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const res = await adminController.listPromotions({ page: 1, limit: 20 });
      expect(res.data.items).toHaveLength(1);
    });

    it('creates promotion from admin dashboard', async () => {
      mockPromotionsService.createPromotion.mockResolvedValueOnce({
        id: 'new-p',
        name: 'New Promo',
      });

      const req: any = { user: { id: 'admin-1' } };
      const res = await adminController.createPromotion(
        {
          name: 'New Promo',
          promotionType: 'PERCENTAGE',
          discountValue: 10,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 100000).toISOString(),
        },
        req
      );

      expect(res.data.id).toBe('new-p');
      expect(mockPromotionsService.createPromotion).toHaveBeenCalledWith(expect.anything(), 'admin-1');
    });

    it('generates a random unique promo code for admin', async () => {
      mockPromotionsService.generateUniquePromoCode.mockResolvedValueOnce('DSL-ABCD99');

      const res = await adminController.generateCode('DSL');
      expect(res.data.code).toBe('DSL-ABCD99');
    });

    it('activates and deactivates promotion', async () => {
      mockPromotionsService.activatePromotion.mockResolvedValueOnce({ id: 'p-1', status: PromotionStatus.ACTIVE });
      mockPromotionsService.deactivatePromotion.mockResolvedValueOnce({ id: 'p-1', status: PromotionStatus.DISABLED });

      const actRes = await adminController.activatePromotion('p-1');
      expect(actRes.data.status).toBe(PromotionStatus.ACTIVE);

      const deactRes = await adminController.deactivatePromotion('p-1');
      expect(deactRes.data.status).toBe(PromotionStatus.DISABLED);
    });

    it('retrieves reporting summary', async () => {
      mockPromotionsService.getReportingSummary.mockResolvedValueOnce({
        totalPromotions: 5,
        activePromotions: 3,
        totalRedemptions: 12,
        totalDiscountValueCents: 450000,
      });

      const res = await adminController.getReportingSummary();
      expect(res.data.totalPromotions).toBe(5);
      expect(res.data.totalDiscountValueCents).toBe(450000);
    });
  });
});

