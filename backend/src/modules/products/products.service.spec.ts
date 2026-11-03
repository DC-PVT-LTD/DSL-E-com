import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      product: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      category: {
        findUnique: vi.fn(),
      },
      brand: {
        findUnique: vi.fn(),
      },
    };

    service = new ProductsService(mockPrisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns published products and sanitizes costPriceCents', async () => {
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'SPEED RIM Ball Pen Blue',
          slug: 'speed-rim-blue',
          sku: 'DSL-SPEED-BLUE',
          priceCents: 6000,
          costPriceCents: 3500, // confidential internal cost
          stockQuantity: 150,
          isActive: true,
          category: { id: 'cat-pens', name: 'Pens', slug: 'pens' },
          brand: { id: 'brand-speed', name: 'Speed', slug: 'speed' },
          variants: [],
        },
      ]);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        sortOrder: 'desc',
        sortBy: 'createdAt',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('SPEED RIM Ball Pen Blue');
      expect(result.data[0].categoryName).toBe('Pens');
      expect(result.data[0].brandName).toBe('Speed');
      // Confidential internal cost price must NEVER be returned in storefront results
      expect(result.data[0].costPriceCents).toBeUndefined();
    });

    it('enforces isActive=true filter in Prisma query', async () => {
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.product.findMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10, sortOrder: 'desc', sortBy: 'createdAt' });

      const findManyCall = mockPrisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.where.isActive).toBe(true);
    });

    it('applies text search filter across multiple fields', async () => {
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.product.findMany.mockResolvedValue([]);

      await service.findAll({
        search: 'pen',
        page: 1,
        limit: 10,
        sortOrder: 'desc',
        sortBy: 'createdAt',
      });

      const findManyCall = mockPrisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.OR).toHaveLength(5);
    });
  });

  describe('findById & findBySlug', () => {
    it('returns product by ID without sensitive fields', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'SPEED RIM Ball Pen Blue',
        priceCents: 6000,
        costPriceCents: 3500,
        isActive: true,
        category: { id: 'cat-1', name: 'Pens', slug: 'pens' },
        brand: { id: 'b-1', name: 'Speed', slug: 'speed' },
        variants: [],
      });

      const product = await service.findById('prod-1');
      expect(product.id).toBe('prod-1');
      expect(product.categoryName).toBe('Pens');
      expect((product as any).costPriceCents).toBeUndefined();
    });

    it('throws NotFoundException for inactive products when requested publicly', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-inactive',
        isActive: false,
      });

      await expect(service.findById('prod-inactive')).rejects.toThrow(
        NotFoundException
      );
    });

    it('throws NotFoundException when slug does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findBySlug('missing-slug')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('create', () => {
    it('throws ConflictException on duplicate SKU', async () => {
      mockPrisma.product.findUnique
        .mockResolvedValueOnce(null) // slug check
        .mockResolvedValueOnce({ id: 'existing', sku: 'DSL-SKU-1' }); // sku check

      await expect(
        service.create({
          name: 'Pen',
          slug: 'new-pen',
          sku: 'DSL-SKU-1',
          description: 'Desc',
          shortDescription: 'Short',
          categoryId: 'cat-1',
          brandId: 'brand-1',
          priceCents: 5000,
          stockQuantity: 10,
          lowStockThreshold: 5,
          isActive: true,
          isFeatured: false,
          isNewArrival: false,
          isBestSeller: false,
          images: [],
          tags: [],
          specifications: {},
        })
      ).rejects.toThrow(ConflictException);
    });
  });
});
