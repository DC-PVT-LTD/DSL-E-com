import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let prisma: any;

  const mockProduct1 = {
    id: 'prod-doms-colour-12',
    name: 'Doms 12 Colour Pencils Set',
    slug: 'doms-12-colour-pencils-set',
    sku: 'DOMS-COL-12',
    priceCents: 42000, // Rs. 420.00
    stockQuantity: 50,
    lowStockThreshold: 5,
    isActive: true,
    categoryId: 'cat-pencils',
    category: { id: 'cat-pencils', name: 'Pencils' },
  };

  const mockProduct2 = {
    id: 'prod-dsl-96',
    name: 'WHITE ERASES 20PCS',
    slug: 'white-erases-20pcs',
    sku: 'WHT-ERS-20',
    priceCents: 30000, // Rs. 300.00
    stockQuantity: 100,
    lowStockThreshold: 5,
    isActive: true,
    categoryId: 'cat-erasers',
    category: { id: 'cat-erasers', name: 'Erasers' },
  };

  const mockProduct3 = {
    id: 'prod-speed-rim-blue',
    name: 'SPEED RIM Ball Pen Blue',
    slug: 'speed-rim-ball-pen-blue',
    sku: 'SPD-RIM-BLU',
    priceCents: 2500, // Rs. 25.00
    stockQuantity: 320,
    lowStockThreshold: 10,
    isActive: true,
    categoryId: 'cat-pens',
    category: { id: 'cat-pens', name: 'Pens' },
  };

  const mockProduct4 = {
    id: 'prod-amigo-fx82ms',
    name: 'MI FX82MS - CALCULATOR',
    slug: 'mi-fx82ms-calculator',
    sku: 'MI-FX82MS',
    priceCents: 290000, // Rs. 2900.00
    stockQuantity: 20,
    lowStockThreshold: 2,
    isActive: true,
    categoryId: 'cat-calculators',
    category: { id: 'cat-calculators', name: 'Calculators' },
  };

  const mockProductArt = {
    id: 'prod-camlin-water-colour-12',
    name: 'Kokuyo Camlin Artist Water Colour 12 Cakes',
    slug: 'camlin-water-colour-12',
    sku: 'CAM-WC-12',
    priceCents: 65000, // Rs. 650.00
    stockQuantity: 85,
    lowStockThreshold: 5,
    isActive: true,
    categoryId: 'cat-water-colour',
    category: { id: 'cat-water-colour', name: 'Water Colour' },
  };

  const mockSubstitute = {
    id: 'prod-sub-pen',
    name: 'Alternative Gel Pen',
    slug: 'alternative-gel-pen',
    sku: 'ALT-GEL-PEN',
    priceCents: 3000,
    stockQuantity: 15,
    lowStockThreshold: 5,
    isActive: true,
    categoryId: 'cat-pens',
    category: { id: 'cat-pens', name: 'Pens' },
  };

  beforeEach(() => {
    prisma = {
      product: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    service = new RecommendationsService(prisma as PrismaService);
    service.resetToDefaults();
  });

  describe('1. Purpose categories & grade-based recommendations', () => {
    it('recommends primary school items for Grade 1-2', async () => {
      prisma.product.findMany.mockResolvedValueOnce([mockProduct1, mockProduct2]);

      const res = await service.getRecommendations({
        purpose: 'school',
        grade: 'Grade 1-2',
      });

      expect(res.purpose).toBe('school');
      expect(res.items.length).toBeGreaterThanOrEqual(1);
      // Primary items should include colours or erasers
      const names = res.items.map((i) => i.productId);
      expect(names).toContain('prod-doms-colour-12');
    });

    it('recommends secondary school items for Grade 6-9 including pens and geometry tools', async () => {
      prisma.product.findMany.mockResolvedValueOnce([mockProduct3, mockProduct4]);

      const res = await service.getRecommendations({
        purpose: 'school',
        grade: 'Grade 6-9',
      });

      expect(res.purpose).toBe('school');
      const productIds = res.items.map((i) => i.productId);
      expect(productIds).toContain('prod-speed-rim-blue');
    });

    it('recommends university campus essentials', async () => {
      prisma.product.findMany.mockResolvedValueOnce([mockProduct3, mockProduct4]);

      const res = await service.getRecommendations({
        purpose: 'university',
        studyArea: 'Engineering & STEM',
      });

      expect(res.purpose).toBe('university');
      expect(res.items.length).toBeGreaterThanOrEqual(1);
    });

    it('recommends office operational supplies', async () => {
      const officePen = {
        ...mockProduct3,
        id: 'prod-dsl-1',
        name: 'Speed Beauty Black Pen',
      };
      prisma.product.findMany.mockResolvedValueOnce([officePen]);

      const res = await service.getRecommendations({
        purpose: 'office',
        officeScale: 'individual',
      });

      expect(res.purpose).toBe('office');
      expect(res.items.length).toBeGreaterThanOrEqual(1);
    });

    it('recommends art and craft supplies for painting activities', async () => {
      prisma.product.findMany.mockResolvedValueOnce([mockProductArt]);

      const res = await service.getRecommendations({
        purpose: 'art_craft',
        activityType: 'Water Colour Painting',
      });

      expect(res.purpose).toBe('art_craft');
      const ids = res.items.map((i) => i.productId);
      expect(ids).toContain('prod-camlin-water-colour-12');
    });

    it('recommends gift items for birthdays or achievements', async () => {
      prisma.product.findMany.mockResolvedValueOnce([mockProduct1, mockProductArt]);

      const res = await service.getRecommendations({
        purpose: 'gift',
        occasion: 'Birthday Gift',
      });

      expect(res.purpose).toBe('gift');
      expect(res.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. Product filtering and stock safety', () => {
    it('excludes out-of-stock and inactive products from recommendations', async () => {
      const outOfStockProduct = {
        ...mockProduct1,
        id: 'prod-out-of-stock',
        stockQuantity: 0,
      };
      const inactiveProduct = {
        ...mockProduct2,
        id: 'prod-inactive',
        isActive: false,
      };

      prisma.product.findMany.mockResolvedValueOnce([outOfStockProduct, inactiveProduct]);

      const res = await service.getRecommendations({
        purpose: 'school',
        grade: 'Grade 1-2',
      });

      expect(res.items.length).toBe(0);
    });

    it('never recommends protected test product cmw0j4cro00089kusmwsbv48t', async () => {
      const protectedProduct = {
        id: 'cmw0j4cro00089kusmwsbv48t',
        name: 'Double Submission Test Product',
        stockQuantity: 10,
        isActive: true,
        priceCents: 10000,
        categoryId: 'cat-pens',
      };

      prisma.product.findMany.mockResolvedValueOnce([protectedProduct, mockProduct3]);

      const res = await service.getRecommendations({
        purpose: 'school',
        grade: 'Grade 6-9',
      });

      const ids = res.items.map((i) => i.productId);
      expect(ids).not.toContain('cmw0j4cro00089kusmwsbv48t');
    });

    it('avoids duplicate recommended items', async () => {
      prisma.product.findMany.mockResolvedValueOnce([mockProduct3]);

      const res = await service.getRecommendations({
        purpose: 'school',
        grade: 'Grade 6-9',
      });

      const ids = res.items.map((i) => i.productId);
      const uniqueIds = Array.from(new Set(ids));
      expect(ids.length).toBe(uniqueIds.length);
    });
  });

  describe('3. Budget calculation and prioritization', () => {
    it('correctly calculates total and marks within budget', async () => {
      prisma.product.findMany.mockResolvedValueOnce([mockProduct1]);

      const res = await service.getRecommendations({
        purpose: 'school',
        grade: 'Grade 1-2',
        budgetLkr: 5000, // Rs. 5000 = 500,000 cents
      });

      expect(res.budgetLkr).toBe(5000);
      expect(res.budgetCents).toBe(500000);
      expect(res.isWithinBudget).toBe(true);
      expect(res.totalEstimatedCents).toBeLessThanOrEqual(500000);
    });

    it('flags when recommendations exceed requested budget limit', async () => {
      prisma.product.findMany.mockResolvedValueOnce([mockProduct4]); // 290000 cents = Rs. 2900

      const res = await service.getRecommendations({
        purpose: 'university',
        studyArea: 'Engineering & STEM',
        budgetLkr: 500, // Rs. 500 = 50000 cents < 290000 cents
      });

      expect(res.isWithinBudget).toBe(false);
    });
  });

  describe('4. Server-authoritative basket validation', () => {
    it('validates prices, quantities and active stock from PostgreSQL', async () => {
      prisma.product.findMany.mockResolvedValueOnce([mockProduct1, mockProduct3]);

      const result = await service.validateBasket({
        items: [
          { productId: mockProduct1.id, quantity: 2, submittedPriceCents: 42000 },
          { productId: mockProduct3.id, quantity: 4, submittedPriceCents: 2500 },
        ],
      });

      expect(result.isValid).toBe(true);
      expect(result.itemCount).toBe(2);
      expect(result.totalCents).toBe(42000 * 2 + 2500 * 4);
      expect(result.warnings.length).toBe(0);
    });

    it('detects and flags client-submitted price tampering', async () => {
      prisma.product.findMany.mockResolvedValueOnce([mockProduct1]);

      const result = await service.validateBasket({
        items: [
          { productId: mockProduct1.id, quantity: 1, submittedPriceCents: 1000 }, // client tampered to Rs 10
        ],
      });

      expect(result.items[0].priceChanged).toBe(true);
      expect(result.items[0].priceCents).toBe(42000); // restored to authoritative 42000 cents
      expect(result.totalCents).toBe(42000);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('rejects out of stock or excessive quantity requests', async () => {
      const limitedProduct = {
        ...mockProduct1,
        stockQuantity: 3,
      };
      prisma.product.findMany.mockResolvedValueOnce([limitedProduct]);

      const result = await service.validateBasket({
        items: [
          { productId: mockProduct1.id, quantity: 10 }, // requested 10 but only 3 available
        ],
      });

      expect(result.isValid).toBe(false);
      expect(result.items[0].quantity).toBe(3);
      expect(result.warnings.some((w) => w.includes('Adjusted quantity'))).toBe(true);
    });
  });

  describe('5. Admin rule management (CRUD)', () => {
    it('allows admin to create a new recommendation rule with real catalogue product', async () => {
      prisma.product.findUnique.mockResolvedValueOnce(mockProduct3);

      const created = await service.createRule({
        purpose: 'office',
        name: 'New Custom Office Gel Pen',
        productId: mockProduct3.id,
        defaultQuantity: 3,
        minQuantity: 1,
        maxQuantity: 10,
        priority: 1,
        reason: 'Office desk writing test rule',
        isActive: true,
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe('New Custom Office Gel Pen');
      expect(service.getRuleById(created.id)).toBeDefined();
    });

    it('prevents creating rules with protected test product', async () => {
      await expect(
        service.createRule({
          purpose: 'office',
          name: 'Forbidden Test Product Rule',
          productId: 'cmw0j4cro00089kusmwsbv48t',
          defaultQuantity: 1,
          minQuantity: 1,
          maxQuantity: 10,
          priority: 1,
          reason: 'Should fail',
          isActive: true,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('allows admin to toggle and update existing rules', async () => {
      const rules = service.getAllRules();
      const firstRule = rules[0];

      const toggled = service.toggleRuleStatus(firstRule.id);
      expect(toggled.isActive).toBe(!firstRule.isActive);

      const updated = await service.updateRule(firstRule.id, {
        name: 'Updated Rule Title',
        defaultQuantity: 7,
      });
      expect(updated.name).toBe('Updated Rule Title');
      expect(updated.defaultQuantity).toBe(7);
    });

    it('allows admin to delete a rule', () => {
      const rules = service.getAllRules();
      const ruleToDelete = rules[0];

      const res = service.deleteRule(ruleToDelete.id);
      expect(res.success).toBe(true);
      expect(() => service.getRuleById(ruleToDelete.id)).toThrow(NotFoundException);
    });
  });

  describe('6. Substitutes discovery', () => {
    it('finds compatible active in-stock substitutes in catalogue', async () => {
      prisma.product.findUnique.mockResolvedValueOnce(mockProduct3);
      prisma.product.findMany.mockResolvedValueOnce([mockSubstitute]);

      const subs = await service.getSubstitutes(mockProduct3.id);
      expect(subs.length).toBe(1);
      expect(subs[0].id).toBe('prod-sub-pen');
    });
  });
});
