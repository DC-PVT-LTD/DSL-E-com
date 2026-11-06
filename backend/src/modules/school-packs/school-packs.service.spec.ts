import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SchoolPacksService } from './school-packs.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SchoolPacksService', () => {
  let service: SchoolPacksService;
  let prisma: any;

  const mockProduct1 = {
    id: 'prod-doms-colour-12',
    name: 'Doms 12 Colour Pencils Set',
    slug: 'doms-12-colour-pencils-set',
    priceCents: 42000, // Rs. 420.00
    stockQuantity: 50,
    isActive: true,
    variants: [],
  };

  const mockProduct2 = {
    id: 'prod-camlin-water-colour-12',
    name: 'Kokuyo Camlin Artist Water Colour 12 Cakes',
    slug: 'kokuyo-camlin-water-colour',
    priceCents: 65000, // Rs. 650.00
    stockQuantity: 20,
    isActive: true,
    variants: [],
  };

  const mockSubstitute = {
    id: 'prod-sub-1',
    name: 'Substitute Colour Set',
    slug: 'substitute-colour-set',
    priceCents: 45000,
    stockQuantity: 15,
    isActive: true,
    variants: [],
  };

  beforeEach(() => {
    prisma = {
      schoolPack: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      schoolPackItem: {
        findMany: vi.fn(),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(prisma)),
    };

    service = new SchoolPacksService(prisma as any);
  });

  describe('Configuration', () => {
    it('should return default configurable grade groups and tiers', () => {
      const config = service.getConfig();
      expect(config.gradeGroups).toContain('Grade 1-2');
      expect(config.gradeGroups).toContain('Grade 3-5');
      expect(config.gradeGroups).toContain('O/L (Grade 10-11)');
      expect(config.tiers).toEqual(['essential', 'standard', 'premium']);
    });

    it('should allow updating grade groups and tiers', () => {
      const updated = service.updateConfig({
        gradeGroups: ['Grade 1-2', 'Custom Grade Group'],
        tiers: ['essential', 'standard', 'luxury'],
      });
      expect(updated.gradeGroups).toEqual(['Grade 1-2', 'Custom Grade Group']);
      expect(updated.tiers).toEqual(['essential', 'standard', 'luxury']);
    });
  });

  describe('Validation & Pricing on Create', () => {
    it('should throw BadRequestException if grade group is not supported', async () => {
      await expect(
        service.create({
          name: 'Invalid Pack',
          grade: 'Unsupported Grade',
          tier: 'essential',
          description: 'Test pack description',
          items: [{ productId: 'prod-doms-colour-12', defaultQuantity: 1 }],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if tier is not supported', async () => {
      await expect(
        service.create({
          name: 'Invalid Pack',
          grade: 'Grade 1-2',
          tier: 'ultra-premium-nonexistent',
          description: 'Test pack description',
          items: [{ productId: 'prod-doms-colour-12', defaultQuantity: 1 }],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate products in items array', async () => {
      await expect(
        service.create({
          name: 'Duplicate Pack',
          grade: 'Grade 1-2',
          tier: 'essential',
          description: 'Test pack description',
          items: [
            { productId: 'prod-doms-colour-12', defaultQuantity: 1 },
            { productId: 'prod-doms-colour-12', defaultQuantity: 2 },
          ],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if a referenced product does not exist in DB', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      await expect(
        service.create({
          name: 'Missing Prod Pack',
          grade: 'Grade 1-2',
          tier: 'essential',
          description: 'Test pack description',
          items: [{ productId: 'non-existent-prod', defaultQuantity: 1 }],
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should calculate server-authoritative pricing in integer cents with discount', async () => {
      prisma.product.findMany.mockImplementation(({ where }: any) => {
        if (where?.id?.in) {
          return [mockProduct1, mockProduct2];
        }
        return [];
      });
      prisma.schoolPack.findUnique.mockResolvedValue(null);

      const createdPack = {
        id: 'pack-test-1',
        name: 'Grade 1-2 Essential Pack',
        slug: 'grade-1-2-essential-pack',
        grade: 'Grade 1-2',
        tier: 'essential',
        description: 'Starter stationery',
        savingsPercentage: 10,
        totalPriceCents: 96300, // (42000*1 + 65000*1) = 107000 - 10700 = 96300
        isActive: true,
        items: [
          {
            id: 'item-1',
            productId: mockProduct1.id,
            defaultQuantity: 1,
            unitPriceCents: mockProduct1.priceCents,
            substituteProductIds: [],
            product: mockProduct1,
          },
          {
            id: 'item-2',
            productId: mockProduct2.id,
            defaultQuantity: 1,
            unitPriceCents: mockProduct2.priceCents,
            substituteProductIds: [],
            product: mockProduct2,
          },
        ],
      };

      prisma.schoolPack.create.mockResolvedValue(createdPack);

      const result = await service.create({
        name: 'Grade 1-2 Essential Pack',
        grade: 'Grade 1-2',
        tier: 'essential',
        description: 'Starter stationery',
        savingsPercentage: 10,
        items: [
          { productId: mockProduct1.id, defaultQuantity: 1 },
          { productId: mockProduct2.id, defaultQuantity: 1 },
        ],
      });

      expect(prisma.schoolPack.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalPriceCents: 96300,
            savingsPercentage: 10,
          }),
        })
      );
      expect(result.calculatedOriginalSubtotalCents).toBe(107000);
      expect(result.calculatedSavingsCents).toBe(10700);
      expect(result.calculatedTotalCents).toBe(96300);
    });
  });

  describe('calculateCustomized', () => {
    it('should calculate customized pricing and prorate integer discounts across items', async () => {
      const existingPack = {
        id: 'pack-test-1',
        name: 'Grade 1-2 Essential Pack',
        slug: 'grade-1-2-essential-pack',
        savingsPercentage: 15,
        isActive: true,
        items: [
          {
            id: 'item-1',
            productId: mockProduct1.id,
            defaultQuantity: 1,
            substituteProductIds: [mockSubstitute.id],
            product: mockProduct1,
          },
        ],
      };

      prisma.schoolPack.findFirst.mockResolvedValue(existingPack);
      prisma.product.findMany.mockResolvedValue([mockSubstitute]);

      const result = await service.calculateCustomized('pack-test-1', {
        items: [{ productId: mockSubstitute.id, quantity: 2 }],
      });

      // 2 * 45000 = 90000 subtotal
      // 15% discount = 13500
      // total = 76500
      expect(result.calculatedOriginalSubtotalCents).toBe(90000);
      expect(result.calculatedSavingsCents).toBe(13500);
      expect(result.calculatedTotalCents).toBe(76500);
      expect(result.items[0].discountCents).toBe(13500);
      expect(result.items[0].discountedLineTotalCents).toBe(76500);
    });
  });
});
