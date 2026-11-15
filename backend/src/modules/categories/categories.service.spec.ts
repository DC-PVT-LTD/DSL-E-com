import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      category: {
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
      $queryRaw: vi.fn(),
    };

    service = new CategoriesService(mockPrisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns paginated categories with mapped itemCount', async () => {
      mockPrisma.category.count.mockResolvedValue(2);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-pens',
          name: 'Pens',
          slug: 'pens',
          description: 'All pens',
          displayOrder: 1,
          _count: { products: 5 },
        },
        {
          id: 'cat-pencils',
          name: 'Pencils',
          slug: 'pencils',
          description: 'All pencils',
          displayOrder: 2,
          _count: { products: 3 },
        },
      ]);

      const result = await service.findAll({ page: 1, limit: 10, sortOrder: 'asc', sortBy: 'name' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].itemCount).toBe(5);
      expect(result.data[1].itemCount).toBe(3);
      expect(result.meta.totalItems).toBe(2);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('findById & findBySlug', () => {
    it('returns category when found by ID', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-pens',
        name: 'Pens',
        slug: 'pens',
        _count: { products: 5 },
      });

      const category = await service.findById('cat-pens');
      expect(category.id).toBe('cat-pens');
      expect(category.itemCount).toBe(5);
    });

    it('throws NotFoundException when category ID is not found', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('returns category when found by slug', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-pens',
        name: 'Pens',
        slug: 'pens',
        _count: { products: 5 },
      });

      const category = await service.findBySlug('pens');
      expect(category.slug).toBe('pens');
    });

    it('throws NotFoundException when slug does not exist', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      await expect(service.findBySlug('unknown-slug')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create & update', () => {
    it('creates category successfully when slug is unique', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      mockPrisma.category.create.mockResolvedValue({
        id: 'cat-new',
        name: 'Markers',
        slug: 'markers',
        description: 'New markers',
      });

      const result = await service.create({
        name: 'Markers',
        slug: 'markers',
        description: 'New markers',
        featured: false,
        displayOrder: 0,
      });

      expect(result.slug).toBe('markers');
    });

    it('throws ConflictException if category slug already exists', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'existing', slug: 'markers' });

      await expect(
        service.create({
          name: 'Markers',
          slug: 'markers',
          description: 'Duplicate',
          featured: false,
          displayOrder: 0,
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('prevents deletion if products are attached to the category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-pens',
        _count: { products: 3 },
      });
      mockPrisma.product.count.mockResolvedValue(3);

      await expect(service.delete('cat-pens')).rejects.toThrow(ConflictException);
    });

    it('deletes category successfully if 0 products are attached', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-empty',
        _count: { products: 0 },
      });
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.category.delete.mockResolvedValue({ id: 'cat-empty' });

      const result = await service.delete('cat-empty');
      expect(result.id).toBe('cat-empty');
    });
  });

  describe('getAdminAnalytics', () => {
    it('returns calculated category counts and usage from database', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ total: 21, parents: 19, subcategories: 2, featured: 7 }])
        .mockResolvedValueOnce([{ withProducts: 16, empty: 5 }])
        .mockResolvedValueOnce([{ id: 'c1', name: 'Pens', count: 16 }]);

      const res = await service.getAdminAnalytics();
      expect(res.totalCategories).toBe(21);
      expect(res.parentCategories).toBe(19);
      expect(res.subcategories).toBe(2);
      expect(res.featuredCategories).toBe(7);
      expect(res.categoriesWithProducts).toBe(16);
      expect(res.emptyCategories).toBe(5);
      expect(res.topCategories[0].name).toBe('Pens');
    });
  });

  describe('exportCategories', () => {
    it('generates formatted CSV and XLSX exports for categories', async () => {
      mockPrisma.category.findMany.mockResolvedValueOnce([
        {
          id: 'cat-pens',
          name: 'Pens',
          slug: 'pens',
          featured: true,
          displayOrder: 1,
          createdAt: new Date('2026-01-01'),
          parent: null,
          _count: { products: 16, subProducts: 0, children: 2 },
        },
      ]);

      const res = await service.exportCategories('csv');
      expect(res.filename).toContain('dsl-categories-');
      expect(res.filename).toContain('.csv');
      expect(res.buffer.toString()).toContain('cat-pens');
      expect(res.buffer.toString()).toContain('Pens');
    });
  });
});
