import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BrandsService', () => {
  let service: BrandsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      brand: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      product: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    };

    service = new BrandsService(mockPrisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns paginated brands with mapped itemCount', async () => {
      mockPrisma.brand.count.mockResolvedValue(1);
      mockPrisma.brand.findMany.mockResolvedValue([
        {
          id: 'brand-linc',
          name: 'Linc',
          slug: 'linc',
          originCountry: 'India',
          description: 'Linc Pens',
          _count: { products: 4 },
        },
      ]);

      const result = await service.findAll({ page: 1, limit: 10, sortOrder: 'asc', sortBy: 'name' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].itemCount).toBe(4);
      expect(result.meta.totalItems).toBe(1);
    });
  });

  describe('findById & findBySlug', () => {
    it('returns brand when found by ID', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({
        id: 'brand-linc',
        name: 'Linc',
        slug: 'linc',
        _count: { products: 4 },
      });

      const brand = await service.findById('brand-linc');
      expect(brand.id).toBe('brand-linc');
      expect(brand.itemCount).toBe(4);
    });

    it('throws NotFoundException when brand is not found', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(null);
      await expect(service.findById('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('prevents deletion if brand has referenced products', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({
        id: 'brand-linc',
        _count: { products: 4 },
      });
      mockPrisma.product.count.mockResolvedValue(4);

      await expect(service.delete('brand-linc')).rejects.toThrow(ConflictException);
    });

    it('deletes brand successfully if 0 products are attached', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({
        id: 'brand-empty',
        _count: { products: 0 },
      });
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.brand.delete.mockResolvedValue({ id: 'brand-empty' });

      const result = await service.delete('brand-empty');
      expect(result.id).toBe('brand-empty');
    });
  });
});
