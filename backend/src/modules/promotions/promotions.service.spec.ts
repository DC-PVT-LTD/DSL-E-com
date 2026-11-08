import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromotionsService } from './promotions.service';
import { PromotionStatus, PromotionType, DiscountType } from '../../generated/prisma';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('PromotionsService', () => {
  let service: PromotionsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      promotion: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      promotionCode: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      promotionProduct: {
        deleteMany: vi.fn(),
      },
      promotionCategory: {
        deleteMany: vi.fn(),
      },
      promotionRedemption: {
        findUnique: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
        aggregate: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      schoolPack: {
        findMany: vi.fn(),
      },
      $queryRaw: vi.fn(),
    };

    service = new PromotionsService(mockPrisma);
  });

  describe('Effective Status Calculation', () => {
    it('returns DISABLED if isActive is false', () => {
      const status = service.computeEffectiveStatus({
        status: PromotionStatus.ACTIVE,
        isActive: false,
        startDate: new Date(Date.now() - 100000),
        endDate: new Date(Date.now() + 100000),
      });
      expect(status).toBe(PromotionStatus.DISABLED);
    });

    it('returns SCHEDULED if current date is before startDate', () => {
      const status = service.computeEffectiveStatus({
        status: PromotionStatus.ACTIVE,
        isActive: true,
        startDate: new Date(Date.now() + 100000),
        endDate: new Date(Date.now() + 200000),
      });
      expect(status).toBe(PromotionStatus.SCHEDULED);
    });

    it('returns EXPIRED if current date is after endDate', () => {
      const status = service.computeEffectiveStatus({
        status: PromotionStatus.ACTIVE,
        isActive: true,
        startDate: new Date(Date.now() - 200000),
        endDate: new Date(Date.now() - 100000),
      });
      expect(status).toBe(PromotionStatus.EXPIRED);
    });

    it('returns DRAFT if status is DRAFT and within dates', () => {
      const status = service.computeEffectiveStatus({
        status: PromotionStatus.DRAFT,
        isActive: true,
        startDate: new Date(Date.now() - 100000),
        endDate: new Date(Date.now() + 100000),
      });
      expect(status).toBe(PromotionStatus.DRAFT);
    });

    it('returns ACTIVE when active and within date window', () => {
      const status = service.computeEffectiveStatus({
        status: PromotionStatus.ACTIVE,
        isActive: true,
        startDate: new Date(Date.now() - 100000),
        endDate: new Date(Date.now() + 100000),
      });
      expect(status).toBe(PromotionStatus.ACTIVE);
    });
  });

  describe('Discount Calculation', () => {
    const validPromo = {
      id: 'promo-1',
      name: 'Super 20% Off',
      code: 'SUPER20',
      description: '20% discount',
      promotionType: PromotionType.PERCENTAGE,
      discountType: DiscountType.PERCENTAGE,
      discountValue: 20,
      maximumDiscountAmount: null,
      maxDiscountCents: null,
      minimumOrderAmount: null,
      minOrderAmountCents: null,
      status: PromotionStatus.ACTIVE,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      isStackableWithSchoolPacks: false,
      isActive: true,
      usageLimit: null,
      usageCount: 0,
      eligibleProducts: [],
      eligibleCategories: [],
    };

    const validCodeRecord = {
      id: 'code-1',
      promotionId: 'promo-1',
      code: 'SUPER20',
      isActive: true,
      maximumTotalUsage: null,
      maximumUsagePerCustomer: null,
      totalUsage: 0,
      promotion: validPromo,
    };

    it('throws BadRequestException for invalid promo code', async () => {
      mockPrisma.promotionCode.findUnique.mockResolvedValueOnce(null);
      mockPrisma.promotion.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.calculateAuthoritativeDiscount('INVALID', [{ productId: 'p1', quantity: 1 }])
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for expired promotion', async () => {
      const expiredPromo = {
        ...validPromo,
        startDate: new Date(Date.now() - 200000),
        endDate: new Date(Date.now() - 100000),
      };
      mockPrisma.promotionCode.findUnique.mockResolvedValueOnce({
        ...validCodeRecord,
        promotion: expiredPromo,
      });

      await expect(
        service.calculateAuthoritativeDiscount('SUPER20', [{ productId: 'p1', quantity: 1 }])
      ).rejects.toThrow(/expired/);
    });

    it('throws BadRequestException when usage limit reached', async () => {
      mockPrisma.promotionCode.findUnique.mockResolvedValueOnce({
        ...validCodeRecord,
        maximumTotalUsage: 5,
        totalUsage: 5,
      });

      await expect(
        service.calculateAuthoritativeDiscount('SUPER20', [{ productId: 'p1', quantity: 1 }])
      ).rejects.toThrow(/Usage limit reached/);
    });

    it('throws BadRequestException when customer per-user usage limit reached', async () => {
      mockPrisma.promotionCode.findUnique.mockResolvedValueOnce({
        ...validCodeRecord,
        maximumUsagePerCustomer: 1,
      });
      mockPrisma.promotionRedemption.count.mockResolvedValueOnce(1);

      await expect(
        service.calculateAuthoritativeDiscount('SUPER20', [{ productId: 'p1', quantity: 1 }], null, 'user-123')
      ).rejects.toThrow(/maximum usage limit/);
    });

    it('calculates percentage discount accurately and respects cap', async () => {
      mockPrisma.promotionCode.findUnique.mockResolvedValueOnce({
        ...validCodeRecord,
        promotion: {
          ...validPromo,
          discountValue: 20,
          maximumDiscountAmount: 3000, // Rs. 30 cap (3000 cents)
        },
      });
      mockPrisma.product.findMany.mockResolvedValueOnce([
        { id: 'p1', name: 'Pen', priceCents: 20000, categoryId: 'cat-1' }, // Rs. 200
      ]);

      const result = await service.calculateAuthoritativeDiscount('SUPER20', [
        { productId: 'p1', quantity: 1 },
      ]);

      // 20% of 20000 = 4000 cents, but capped at 3000 cents
      expect(result.discountAmountCents).toBe(3000);
      expect(result.valid).toBe(true);
    });

    it('calculates fixed amount discount without exceeding eligible base', async () => {
      mockPrisma.promotionCode.findUnique.mockResolvedValueOnce({
        ...validCodeRecord,
        promotion: {
          ...validPromo,
          promotionType: PromotionType.FIXED_AMOUNT,
          discountType: DiscountType.FIXED_AMOUNT,
          discountValue: 500, // Rs. 500 = 50,000 cents
        },
      });
      mockPrisma.product.findMany.mockResolvedValueOnce([
        { id: 'p1', name: 'Notebook', priceCents: 30000, categoryId: 'cat-1' }, // Rs. 300
      ]);

      const result = await service.calculateAuthoritativeDiscount('SUPER20', [
        { productId: 'p1', quantity: 1 },
      ]);

      // Discount of Rs 500 on Rs 300 item is capped at purchase value Rs 300 (30,000 cents)
      expect(result.discountAmountCents).toBe(30000);
    });

    it('calculates free delivery promotion', async () => {
      mockPrisma.promotionCode.findUnique.mockResolvedValueOnce({
        ...validCodeRecord,
        promotion: {
          ...validPromo,
          promotionType: PromotionType.FREE_DELIVERY,
          discountType: DiscountType.FREE_DELIVERY,
          discountValue: 0,
        },
      });
      mockPrisma.product.findMany.mockResolvedValueOnce([
        { id: 'p1', name: 'Pencil Box', priceCents: 15000, categoryId: 'cat-1' },
      ]);

      const result = await service.calculateAuthoritativeDiscount('SUPER20', [
        { productId: 'p1', quantity: 1 },
      ]);

      expect(result.isFreeDelivery).toBe(true);
      expect(result.discountAmountCents).toBe(0);
    });

    it('rejects promotion when cart does not meet minimum order value', async () => {
      mockPrisma.promotionCode.findUnique.mockResolvedValueOnce({
        ...validCodeRecord,
        promotion: {
          ...validPromo,
          minimumOrderAmount: 500000, // Rs. 5,000
        },
      });
      mockPrisma.product.findMany.mockResolvedValueOnce([
        { id: 'p1', name: 'Eraser', priceCents: 5000, categoryId: 'cat-1' }, // Rs. 50
      ]);

      await expect(
        service.calculateAuthoritativeDiscount('SUPER20', [{ productId: 'p1', quantity: 1 }])
      ).rejects.toThrow(/Minimum order value/);
    });

    it('rejects product-specific promotion when eligible products not in cart', async () => {
      mockPrisma.promotionCode.findUnique.mockResolvedValueOnce({
        ...validCodeRecord,
        promotion: {
          ...validPromo,
          promotionType: PromotionType.PRODUCT_SPECIFIC,
          eligibleProducts: [{ productId: 'p-special' }],
          eligibleCategories: [],
        },
      });
      mockPrisma.product.findMany.mockResolvedValueOnce([
        { id: 'p-regular', name: 'Regular Pen', priceCents: 10000, categoryId: 'cat-1' },
      ]);

      await expect(
        service.calculateAuthoritativeDiscount('SUPER20', [{ productId: 'p-regular', quantity: 1 }])
      ).rejects.toThrow(/does not contain eligible products/);
    });

    it('rejects category-specific promotion when eligible category not in cart', async () => {
      mockPrisma.promotionCode.findUnique.mockResolvedValueOnce({
        ...validCodeRecord,
        promotion: {
          ...validPromo,
          promotionType: PromotionType.CATEGORY_SPECIFIC,
          eligibleProducts: [],
          eligibleCategories: [{ categoryId: 'cat-art' }],
        },
      });
      mockPrisma.product.findMany.mockResolvedValueOnce([
        { id: 'p1', name: 'Office File', priceCents: 10000, categoryId: 'cat-office' },
      ]);

      await expect(
        service.calculateAuthoritativeDiscount('SUPER20', [{ productId: 'p1', quantity: 1 }])
      ).rejects.toThrow(/products from eligible categories/);
    });

    describe('School Pack Stacking Business Rule', () => {
      it('rejects promo code when cart has School Pack and stacking is disabled', async () => {
        mockPrisma.promotionCode.findUnique.mockResolvedValueOnce({
          ...validCodeRecord,
          promotion: {
            ...validPromo,
            isStackableWithSchoolPacks: false,
          },
        });
        mockPrisma.product.findMany.mockResolvedValueOnce([
          { id: 'p1', name: 'Grade 5 Workbook', priceCents: 100000, categoryId: 'cat-1' },
        ]);
        mockPrisma.schoolPack.findMany.mockResolvedValueOnce([
          {
            id: 'pack-5',
            name: 'Grade 5 Pack',
            savingsPercentage: 15,
            items: [{ productId: 'p1' }],
          },
        ]);

        await expect(
          service.calculateAuthoritativeDiscount(
            'SUPER20',
            [{ productId: 'p1', quantity: 1 }],
            [{ productId: 'p1', packId: 'pack-5' }]
          )
        ).rejects.toThrow(/cannot be combined with School Pack discounts/);
      });

      it('permits promo code when cart has School Pack and stacking is enabled', async () => {
        mockPrisma.promotionCode.findUnique.mockResolvedValueOnce({
          ...validCodeRecord,
          promotion: {
            ...validPromo,
            isStackableWithSchoolPacks: true,
            discountValue: 10, // 10%
          },
        });
        mockPrisma.product.findMany.mockResolvedValueOnce([
          { id: 'p1', name: 'Grade 5 Workbook', priceCents: 100000, categoryId: 'cat-1' }, // Rs. 1,000
        ]);
        mockPrisma.schoolPack.findMany.mockResolvedValueOnce([
          {
            id: 'pack-5',
            name: 'Grade 5 Pack',
            savingsPercentage: 15, // 15% bundle savings = 15,000 cents
            items: [{ productId: 'p1' }],
          },
        ]);

        const result = await service.calculateAuthoritativeDiscount(
          'SUPER20',
          [{ productId: 'p1', quantity: 1 }],
          [{ productId: 'p1', packId: 'pack-5' }]
        );

        expect(result.valid).toBe(true);
        expect(result.bundleDiscountCents).toBe(15000);
        // Eligible base is remaining Rs. 850 (85,000 cents). 10% of 85,000 = 8,500 cents
        expect(result.discountAmountCents).toBe(8500);
      });
    });
  });

  describe('Redemption and Concurrency Safety', () => {
    it('is idempotent on duplicate redemption calls for the same order', async () => {
      const mockTx: any = {
        promotionRedemption: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: 'existing-redemption' }),
          create: vi.fn(),
        },
        promotionCode: { update: vi.fn() },
        promotion: { update: vi.fn() },
        $queryRaw: vi.fn(),
      };

      await service.recordRedemptionInsideTx(mockTx, {
        promotionId: 'promo-1',
        promotionCodeId: 'code-1',
        orderId: 'order-123',
        customerEmail: 'test@example.com',
        discountAmountCents: 5000,
      });

      expect(mockTx.promotionRedemption.create).not.toHaveBeenCalled();
      expect(mockTx.promotionCode.update).not.toHaveBeenCalled();
      expect(mockTx.promotion.update).not.toHaveBeenCalled();
    });

    it('atomically increments usage and creates redemption record inside transaction', async () => {
      const mockTx: any = {
        promotionRedemption: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
          create: vi.fn().mockResolvedValueOnce({ id: 'new-redemption' }),
        },
        promotionCode: {
          update: vi.fn().mockResolvedValueOnce({}),
        },
        promotion: {
          update: vi.fn().mockResolvedValueOnce({}),
        },
        $queryRaw: vi.fn().mockResolvedValueOnce([{ id: 'code-1', totalUsage: 3, maximumTotalUsage: 10 }]),
      };

      await service.recordRedemptionInsideTx(mockTx, {
        promotionId: 'promo-1',
        promotionCodeId: 'code-1',
        orderId: 'order-456',
        customerId: 'user-1',
        customerEmail: 'user@example.com',
        discountAmountCents: 2500,
      });

      expect(mockTx.promotionRedemption.create).toHaveBeenCalledWith({
        data: {
          promotionId: 'promo-1',
          promotionCodeId: 'code-1',
          orderId: 'order-456',
          customerId: 'user-1',
          customerEmail: 'user@example.com',
          discountAmount: 2500,
        },
      });
      expect(mockTx.promotionCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: { totalUsage: { increment: 1 } },
      });
      expect(mockTx.promotion.update).toHaveBeenCalledWith({
        where: { id: 'promo-1' },
        data: { usageCount: { increment: 1 } },
      });
    });
  });

  describe('Admin CRUD', () => {
    it('creates promotion with initial code', async () => {
      mockPrisma.promotionCode.findUnique.mockResolvedValueOnce(null);
      mockPrisma.promotion.create.mockResolvedValueOnce({
        id: 'new-p',
        name: 'Back to School',
        status: PromotionStatus.ACTIVE,
        isActive: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 100000),
      });

      const res = await service.createPromotion({
        name: 'Back to School',
        promotionType: PromotionType.PERCENTAGE,
        discountValue: 15,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 100000).toISOString(),
        code: 'BTS2026',
      });

      expect(res.id).toBe('new-p');
      expect(mockPrisma.promotion.create).toHaveBeenCalled();
    });

    it('safely disables promotion instead of deleting if redemptions exist', async () => {
      mockPrisma.promotion.findUnique.mockResolvedValueOnce({
        id: 'p-with-history',
        _count: { redemptions: 5, orders: 5 },
      });
      mockPrisma.promotion.update.mockResolvedValueOnce({
        id: 'p-with-history',
        status: PromotionStatus.DISABLED,
        isActive: false,
      });

      const res = await service.deletePromotion('p-with-history', 'admin-1');
      expect(res.deleted).toBe(false);
      expect(res.disabled).toBe(true);
      expect(mockPrisma.promotion.delete).not.toHaveBeenCalled();
      expect(mockPrisma.promotion.update).toHaveBeenCalledWith({
        where: { id: 'p-with-history' },
        data: {
          status: PromotionStatus.DISABLED,
          isActive: false,
          updatedBy: 'admin-1',
        },
      });
    });
  });
});

