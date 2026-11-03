import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryChangeReason } from '../../generated/prisma';

describe('InventoryService', () => {
  let service: InventoryService;
  let mockPrisma: any;
  let mockTx: any;

  const mockActor = {
    id: 'user-admin-1',
    email: 'admin@dslstationery.lk',
    name: 'Admin User',
  };

  beforeEach(() => {
    mockTx = {
      $queryRaw: vi.fn(),
      product: {
        update: vi.fn(),
      },
      productVariant: {
        update: vi.fn(),
      },
      inventoryMovement: {
        create: vi.fn(),
      },
    };

    mockPrisma = {
      $transaction: vi.fn(async (cb) => cb(mockTx)),
      $queryRaw: vi.fn(),
      inventoryMovement: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
    };

    service = new InventoryService(mockPrisma as unknown as PrismaService);
  });

  describe('adjustStock', () => {
    it('successfully processes a positive stock adjustment (restock)', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([
        {
          id: 'prod-1',
          name: 'Atlas CR Book 120 Pages',
          sku: 'ATL-CR-120',
          stockQuantity: 100,
          lowStockThreshold: 10,
          isActive: true,
        },
      ]);

      mockTx.product.update.mockResolvedValueOnce({
        id: 'prod-1',
        name: 'Atlas CR Book 120 Pages',
        sku: 'ATL-CR-120',
        stockQuantity: 150,
        lowStockThreshold: 10,
      });

      mockTx.inventoryMovement.create.mockResolvedValueOnce({
        id: 'mov-1',
        productId: 'prod-1',
        variantId: null,
        previousQuantity: 100,
        newQuantity: 150,
        changeAmount: 50,
        reason: InventoryChangeReason.RESTOCK,
        note: 'Restock shipment',
        performedById: mockActor.id,
        createdAt: new Date(),
      });

      const result = await service.adjustStock(
        {
          productId: 'prod-1',
          delta: 50,
          reason: InventoryChangeReason.RESTOCK,
          note: 'Restock shipment',
        },
        mockActor
      );

      expect(result.product.stockQuantity).toBe(150);
      expect(result.movement.changeAmount).toBe(50);
      expect(result.movement.performedById).toBe('user-admin-1');
      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stockQuantity: { increment: 50 } },
        select: expect.any(Object),
      });
    });

    it('successfully processes a negative stock adjustment (damage / write-off)', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([
        {
          id: 'prod-1',
          name: 'Atlas CR Book 120 Pages',
          sku: 'ATL-CR-120',
          stockQuantity: 100,
          lowStockThreshold: 10,
          isActive: true,
        },
      ]);

      mockTx.product.update.mockResolvedValueOnce({
        id: 'prod-1',
        name: 'Atlas CR Book 120 Pages',
        sku: 'ATL-CR-120',
        stockQuantity: 85,
        lowStockThreshold: 10,
      });

      mockTx.inventoryMovement.create.mockResolvedValueOnce({
        id: 'mov-2',
        productId: 'prod-1',
        variantId: null,
        previousQuantity: 100,
        newQuantity: 85,
        changeAmount: -15,
        reason: InventoryChangeReason.DAMAGED,
        note: 'Water damage in warehouse section B',
        performedById: mockActor.id,
        createdAt: new Date(),
      });

      const result = await service.adjustStock(
        {
          productId: 'prod-1',
          delta: -15,
          reason: InventoryChangeReason.DAMAGED,
          note: 'Water damage in warehouse section B',
        },
        mockActor
      );

      expect(result.product.stockQuantity).toBe(85);
      expect(result.movement.changeAmount).toBe(-15);
      expect(result.movement.reason).toBe(InventoryChangeReason.DAMAGED);
    });

    it('supports targetQuantity and correctly derives changeAmount', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([
        {
          id: 'prod-1',
          name: 'Atlas CR Book 120 Pages',
          sku: 'ATL-CR-120',
          stockQuantity: 100,
          lowStockThreshold: 10,
          isActive: true,
        },
      ]);

      mockTx.product.update.mockResolvedValueOnce({
        id: 'prod-1',
        name: 'Atlas CR Book 120 Pages',
        sku: 'ATL-CR-120',
        stockQuantity: 125,
        lowStockThreshold: 10,
      });

      mockTx.inventoryMovement.create.mockResolvedValueOnce({
        id: 'mov-3',
        productId: 'prod-1',
        variantId: null,
        previousQuantity: 100,
        newQuantity: 125,
        changeAmount: 25,
        reason: InventoryChangeReason.CORRECTION,
        note: 'Physical cycle count',
        performedById: mockActor.id,
        createdAt: new Date(),
      });

      const result = await service.adjustStock(
        {
          productId: 'prod-1',
          targetQuantity: 125,
          reason: InventoryChangeReason.CORRECTION,
          note: 'Physical cycle count',
        },
        mockActor
      );

      expect(result.movement.changeAmount).toBe(25);
      expect(result.movement.newQuantity).toBe(125);
    });

    it('rejects targetQuantity if it equals current stock (delta would be 0)', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([
        {
          id: 'prod-1',
          name: 'Atlas CR Book 120 Pages',
          sku: 'ATL-CR-120',
          stockQuantity: 100,
          lowStockThreshold: 10,
          isActive: true,
        },
      ]);

      await expect(
        service.adjustStock(
          {
            productId: 'prod-1',
            targetQuantity: 100,
            reason: InventoryChangeReason.CORRECTION,
          },
          mockActor
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects adjustments resulting in negative stock', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([
        {
          id: 'prod-1',
          name: 'Atlas CR Book 120 Pages',
          sku: 'ATL-CR-120',
          stockQuantity: 10,
          lowStockThreshold: 5,
          isActive: true,
        },
      ]);

      await expect(
        service.adjustStock(
          {
            productId: 'prod-1',
            delta: -15,
            reason: InventoryChangeReason.ORDER_FULFILLMENT,
          },
          mockActor
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when target product does not exist', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([]);

      await expect(
        service.adjustStock(
          {
            productId: 'non-existent-product',
            delta: 10,
            reason: InventoryChangeReason.RESTOCK,
          },
          mockActor
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('successfully adjusts variant stock and aggregates to parent product', async () => {
      mockTx.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'prod-1',
            name: 'Atlas CR Book',
            sku: 'ATL-CR',
            stockQuantity: 50,
            lowStockThreshold: 10,
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'var-blue',
            productId: 'prod-1',
            name: 'Single Line - Blue',
            sku: 'ATL-CR-SL-BL',
            stockQuantity: 20,
            isActive: true,
          },
        ]);

      mockTx.productVariant.update.mockResolvedValueOnce({
        id: 'var-blue',
        name: 'Single Line - Blue',
        sku: 'ATL-CR-SL-BL',
        stockQuantity: 35,
      });

      mockTx.product.update.mockResolvedValueOnce({
        id: 'prod-1',
        name: 'Atlas CR Book',
        sku: 'ATL-CR',
        stockQuantity: 65,
        lowStockThreshold: 10,
      });

      mockTx.inventoryMovement.create.mockResolvedValueOnce({
        id: 'mov-var-1',
        productId: 'prod-1',
        variantId: 'var-blue',
        previousQuantity: 20,
        newQuantity: 35,
        changeAmount: 15,
        reason: InventoryChangeReason.RESTOCK,
        note: 'Restocked variant',
        performedById: mockActor.id,
        createdAt: new Date(),
      });

      const result = await service.adjustStock(
        {
          productId: 'prod-1',
          variantId: 'var-blue',
          delta: 15,
          reason: InventoryChangeReason.RESTOCK,
          note: 'Restocked variant',
        },
        mockActor
      );

      expect(result.variant).not.toBeNull();
      expect(result.variant?.stockQuantity).toBe(35);
      expect(result.product.stockQuantity).toBe(65);
      expect(result.movement.variantId).toBe('var-blue');
      expect(mockTx.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-blue' },
        data: { stockQuantity: { increment: 15 } },
        select: expect.any(Object),
      });
      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stockQuantity: { increment: 15 } },
        select: expect.any(Object),
      });
    });

    it('rejects variant adjustment when variant does not belong to specified product', async () => {
      mockTx.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'prod-1',
            name: 'Atlas CR Book',
            sku: 'ATL-CR',
            stockQuantity: 50,
            lowStockThreshold: 10,
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'var-wrong',
            productId: 'other-product-id',
            name: 'Other Variant',
            sku: 'OTHER-VAR',
            stockQuantity: 20,
            isActive: true,
          },
        ]);

      await expect(
        service.adjustStock(
          {
            productId: 'prod-1',
            variantId: 'var-wrong',
            delta: 5,
            reason: InventoryChangeReason.RESTOCK,
          },
          mockActor
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('rolls back the transaction if inventory movement creation fails', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([
        {
          id: 'prod-1',
          name: 'Atlas CR Book 120 Pages',
          sku: 'ATL-CR-120',
          stockQuantity: 100,
          lowStockThreshold: 10,
          isActive: true,
        },
      ]);

      mockTx.product.update.mockResolvedValueOnce({
        id: 'prod-1',
        stockQuantity: 110,
      });

      mockTx.inventoryMovement.create.mockRejectedValueOnce(
        new Error('Database write failure: movement insert conflict')
      );

      await expect(
        service.adjustStock(
          {
            productId: 'prod-1',
            delta: 10,
            reason: InventoryChangeReason.RESTOCK,
          },
          mockActor
        )
      ).rejects.toThrow('Database write failure: movement insert conflict');
    });
  });

  describe('getMovements', () => {
    it('retrieves paginated movements with product and variant details', async () => {
      mockPrisma.inventoryMovement.count.mockResolvedValue(1);
      mockPrisma.inventoryMovement.findMany.mockResolvedValue([
        {
          id: 'mov-1',
          productId: 'prod-1',
          variantId: null,
          previousQuantity: 100,
          newQuantity: 120,
          changeAmount: 20,
          reason: InventoryChangeReason.RESTOCK,
          note: 'Initial batch',
          performedById: 'user-admin-1',
          createdAt: new Date('2026-02-01T10:00:00.000Z'),
          product: { id: 'prod-1', name: 'Atlas Book', sku: 'ATL-01' },
          variant: null,
        },
      ]);

      const result = await service.getMovements({
        page: 1,
        limit: 20,
        productId: 'prod-1',
        reason: InventoryChangeReason.RESTOCK,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].changeAmount).toBe(20);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('getLowStock', () => {
    it('retrieves products matching lowStockThreshold via database SQL', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: 1n }]) // total count
        .mockResolvedValueOnce([{ id: 'prod-low-1' }]); // product IDs

      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-low-1',
          name: 'Atlas Geometry Box',
          sku: 'ATL-GEO-01',
          stockQuantity: 2,
          lowStockThreshold: 5,
          priceCents: 85000,
          costPriceCents: 45000,
          category: { id: 'cat-geo', name: 'Geometry', slug: 'geometry' },
          brand: { id: 'brand-atlas', name: 'Atlas', slug: 'atlas' },
          variants: [],
        },
      ]);

      const result = await service.getLowStock({
        page: 1,
        limit: 10,
        sortOrder: 'asc',
        sortBy: 'stockQuantity',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].sku).toBe('ATL-GEO-01');
      expect(result.data[0].costPriceCents).toBeUndefined(); // costPriceCents sanitized
      expect(result.meta.totalItems).toBe(1);
    });

    it('returns empty paginated list if no products are low in stock', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: 0n }])
        .mockResolvedValueOnce([]);

      const result = await service.getLowStock({
        page: 1,
        limit: 10,
        sortOrder: 'asc',
        sortBy: 'stockQuantity',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
      expect(result.meta.totalItems).toBe(0);
      expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
    });
  });
});

