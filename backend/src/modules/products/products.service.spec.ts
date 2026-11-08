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
        findFirst: vi.fn(),
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
      productVariant: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      inventoryMovement: {
        create: vi.fn(),
      },
      globalSku: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };

    const mockSkuGenerator = {
      generateProductSku: vi.fn().mockResolvedValue('DSL-PEN-SPD-00001'),
      previewProductSku: vi.fn().mockResolvedValue('DSL-PEN-SPD-00001'),
      generateVariantSku: vi.fn().mockResolvedValue('DSL-PEN-SPD-00001-V01'),
      syncSequenceIfHigher: vi.fn().mockResolvedValue(undefined),
    };

    service = new ProductsService(
      mockPrisma as unknown as PrismaService,
      mockSkuGenerator as any
    );
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
      mockPrisma.product.findFirst.mockResolvedValue(null);
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

  describe('variant management', () => {
    it('creates a variant and increments parent aggregate stock', async () => {
      mockPrisma.product.findUnique
        .mockResolvedValueOnce({ id: 'prod-1', name: 'Atlas Book', sku: 'ATL-1', isActive: true }) // findById
        .mockResolvedValueOnce(null); // sku check
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce(null); // sku check

      mockPrisma.productVariant.create.mockResolvedValueOnce({
        id: 'var-1',
        productId: 'prod-1',
        name: 'Single Line',
        sku: 'ATL-1-SL',
        priceCents: 4500,
        stockQuantity: 20,
        isActive: true,
      });

      const result = await service.createVariant('prod-1', {
        name: 'Single Line',
        sku: 'ATL-1-SL',
        priceCents: 4500,
        stockQuantity: 20,
        attributes: { ruling: 'Single Line' },
        isActive: true,
      });

      expect(result.id).toBe('var-1');
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stockQuantity: { increment: 20 } },
      });
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          variantId: 'var-1',
          changeAmount: 20,
        }),
      });
    });

    it('rejects variant creation with duplicate SKU', async () => {
      mockPrisma.product.findUnique
        .mockResolvedValueOnce({ id: 'prod-1', name: 'Atlas Book', sku: 'ATL-1', isActive: true })
        .mockResolvedValueOnce(null);
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ id: 'existing-var', sku: 'ATL-1-SL' });

      await expect(
        service.createVariant('prod-1', {
          name: 'Single Line',
          sku: 'ATL-1-SL',
          priceCents: 4500,
          stockQuantity: 0,
          attributes: {},
        })
      ).rejects.toThrow(ConflictException);
    });

    it('finds variants belonging to product', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({ id: 'prod-1', isActive: true });
      mockPrisma.productVariant.findMany.mockResolvedValueOnce([
        { id: 'var-1', productId: 'prod-1', name: 'Variant 1' },
      ]);

      const result = await service.findVariants('prod-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('var-1');
    });

    it('updates variant details', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({ id: 'prod-1', isActive: true });
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({
        id: 'var-1',
        productId: 'prod-1',
        name: 'Single Line',
        sku: 'ATL-1-SL',
        isActive: true,
      });
      mockPrisma.productVariant.update.mockResolvedValueOnce({
        id: 'var-1',
        name: 'Single Line Premium',
      });

      const updated = await service.updateVariant('prod-1', 'var-1', {
        name: 'Single Line Premium',
      });

      expect(updated.name).toBe('Single Line Premium');
    });

    it('soft-deletes variant by setting isActive to false', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({ id: 'prod-1', isActive: true });
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({
        id: 'var-1',
        productId: 'prod-1',
        isActive: true,
      });
      mockPrisma.productVariant.update.mockResolvedValueOnce({
        id: 'var-1',
        isActive: false,
      });

      const deleted = await service.deleteVariant('prod-1', 'var-1');
      expect(deleted.isActive).toBe(false);
      expect(mockPrisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        data: { isActive: false },
      });
    });
  });
});
