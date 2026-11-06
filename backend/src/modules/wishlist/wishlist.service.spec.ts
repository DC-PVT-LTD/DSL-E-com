import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('WishlistService', () => {
  let service: WishlistService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      wishlistItem: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
      },
    };

    service = new WishlistService(mockPrisma as unknown as PrismaService);
  });

  describe('getWishlist', () => {
    it('retrieves customer wishlist populated with current product catalogue details', async () => {
      const mockItems = [
        {
          id: 'w-item-1',
          userId: 'cust-1',
          productId: 'prod-pen-1',
          createdAt: new Date('2026-11-01T10:00:00Z'),
          product: {
            id: 'prod-pen-1',
            name: 'SPEED RIM Ball Pen 0.7mm',
            slug: 'speed-rim-ball-pen',
            sku: 'DSL-PEN-01',
            priceCents: 3500,
            compareAtPriceCents: 4500,
            stockQuantity: 120,
            isActive: true,
            images: ['/images/pen.png'],
            category: { name: 'Pens & Writing' },
            brand: { name: 'Speed' },
          },
        },
      ];

      mockPrisma.wishlistItem.findMany.mockResolvedValue(mockItems);

      const result = await service.getWishlist('cust-1');

      expect(mockPrisma.wishlistItem.findMany).toHaveBeenCalledWith({
        where: { userId: 'cust-1' },
        include: {
          product: {
            include: {
              category: true,
              brand: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result.itemCount).toBe(1);
      expect(result.items[0].productId).toBe('prod-pen-1');
      expect(result.items[0].product.name).toBe('SPEED RIM Ball Pen 0.7mm');
      expect(result.items[0].product.priceCents).toBe(3500); // Current catalogue price
      expect(result.items[0].product.categoryName).toBe('Pens & Writing');
    });

    it('returns empty list when customer has no saved wishlist items', async () => {
      mockPrisma.wishlistItem.findMany.mockResolvedValue([]);

      const result = await service.getWishlist('cust-empty');
      expect(result.itemCount).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('strictly isolates wishlist queries to the authenticated customer ID', async () => {
      mockPrisma.wishlistItem.findMany.mockResolvedValue([]);
      await service.getWishlist('customer-exclusive-99');

      expect(mockPrisma.wishlistItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'customer-exclusive-99' },
        })
      );
    });
  });

  describe('addItem', () => {
    it('adds product to wishlist when valid and active', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-atlas-cr',
        name: 'Atlas CR Book 120 Pages',
        slug: 'atlas-cr-120',
        sku: 'ATL-CR-120',
        priceCents: 28000,
        compareAtPriceCents: null,
        stockQuantity: 50,
        isActive: true,
        images: ['/images/cr.png'],
        category: { name: 'Exercise Books' },
        brand: { name: 'Atlas' },
      });

      mockPrisma.wishlistItem.findUnique.mockResolvedValue(null); // Not already added

      mockPrisma.wishlistItem.create.mockResolvedValue({
        id: 'w-new-1',
        userId: 'cust-1',
        productId: 'prod-atlas-cr',
        createdAt: new Date('2026-11-05T12:00:00Z'),
        product: {
          id: 'prod-atlas-cr',
          name: 'Atlas CR Book 120 Pages',
          slug: 'atlas-cr-120',
          sku: 'ATL-CR-120',
          priceCents: 28000,
          compareAtPriceCents: null,
          stockQuantity: 50,
          isActive: true,
          images: ['/images/cr.png'],
          category: { name: 'Exercise Books' },
          brand: { name: 'Atlas' },
        },
      });

      const result = await service.addItem('cust-1', 'prod-atlas-cr');

      expect(mockPrisma.wishlistItem.create).toHaveBeenCalledWith({
        data: {
          userId: 'cust-1',
          productId: 'prod-atlas-cr',
        },
        include: {
          product: {
            include: {
              category: true,
              brand: true,
            },
          },
        },
      });

      expect(result.id).toBe('w-new-1');
      expect(result.product.priceCents).toBe(28000);
    });

    it('safely and idempotently handles duplicate additions without creating duplicates', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-atlas-cr',
        name: 'Atlas CR Book',
        isActive: true,
      });

      // Item already in customer's wishlist
      const existingItem = {
        id: 'existing-w-item',
        userId: 'cust-1',
        productId: 'prod-atlas-cr',
        createdAt: new Date('2026-11-01T00:00:00Z'),
        product: {
          id: 'prod-atlas-cr',
          name: 'Atlas CR Book',
          slug: 'atlas-cr',
          sku: 'ATL-CR',
          priceCents: 28000,
          stockQuantity: 50,
          isActive: true,
          images: [],
          category: { name: 'Books' },
          brand: { name: 'Atlas' },
        },
      };

      mockPrisma.wishlistItem.findUnique.mockResolvedValue(existingItem);

      const result = await service.addItem('cust-1', 'prod-atlas-cr');

      // Must NOT invoke create if already exists
      expect(mockPrisma.wishlistItem.create).not.toHaveBeenCalled();
      expect(result.id).toBe('existing-w-item');
    });

    it('rejects invalid or non-existent product ID with NotFoundException', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.addItem('cust-1', 'invalid-prod-999')).rejects.toThrow(
        NotFoundException
      );
      expect(mockPrisma.wishlistItem.create).not.toHaveBeenCalled();
    });

    it('rejects inactive or unavailable products with NotFoundException', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'inactive-prod',
        name: 'Discontinued Item',
        isActive: false,
      });

      await expect(service.addItem('cust-1', 'inactive-prod')).rejects.toThrow(
        NotFoundException
      );
      expect(mockPrisma.wishlistItem.create).not.toHaveBeenCalled();
    });
  });

  describe('removeItem', () => {
    it('removes product from customer wishlist using customerId and productId', async () => {
      mockPrisma.wishlistItem.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removeItem('cust-1', 'prod-pen-1');

      expect(mockPrisma.wishlistItem.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'cust-1',
          productId: 'prod-pen-1',
        },
      });
      expect(result.success).toBe(true);
      expect(result.productId).toBe('prod-pen-1');
    });

    it('does not throw when removing an item that was not in the wishlist', async () => {
      mockPrisma.wishlistItem.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.removeItem('cust-1', 'prod-not-in-list');
      expect(result.success).toBe(true);
    });
  });

  describe('getCount and isSaved', () => {
    it('returns exact item count for the customer', async () => {
      mockPrisma.wishlistItem.count.mockResolvedValue(4);

      const result = await service.getCount('cust-1');
      expect(mockPrisma.wishlistItem.count).toHaveBeenCalledWith({
        where: { userId: 'cust-1' },
      });
      expect(result.count).toBe(4);
    });

    it('correctly checks whether a product is saved in wishlist', async () => {
      mockPrisma.wishlistItem.findUnique.mockResolvedValueOnce({ id: 'item-1' });
      const savedResult = await service.isSaved('cust-1', 'prod-1');
      expect(savedResult.isSaved).toBe(true);

      mockPrisma.wishlistItem.findUnique.mockResolvedValueOnce(null);
      const notSavedResult = await service.isSaved('cust-1', 'prod-2');
      expect(notSavedResult.isSaved).toBe(false);
    });
  });
});

