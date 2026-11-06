import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SavedListsService } from './saved-lists.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SavedListsService', () => {
  let service: SavedListsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      savedList: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      savedListItem: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
      },
    };

    service = new SavedListsService(mockPrisma as unknown as PrismaService);
  });

  describe('getLists', () => {
    it('returns lists with item counts, estimated totals, and preview images', async () => {
      const mockLists = [
        {
          id: 'list-1',
          name: 'Grade 5 Supplies',
          userId: 'user-1',
          createdAt: new Date('2026-11-01'),
          updatedAt: new Date('2026-11-02'),
          items: [
            {
              quantity: 3,
              product: {
                id: 'p1',
                priceCents: 15000,
                images: ['/img/p1.png'],
                isActive: true,
              },
            },
            {
              quantity: 2,
              product: {
                id: 'p2',
                priceCents: 20000,
                images: ['/img/p2.png'],
                isActive: true,
              },
            },
            {
              quantity: 1,
              product: {
                id: 'p3',
                priceCents: 50000,
                images: ['/img/p3.png'],
                isActive: false, // Inactive product shouldn't contribute to total
              },
            },
          ],
        },
      ];

      mockPrisma.savedList.findMany.mockResolvedValue(mockLists);

      const result = await service.getLists('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Grade 5 Supplies');
      expect(result[0].itemCount).toBe(3);
      // 3 * 15000 + 2 * 20000 = 45000 + 40000 = 85000
      expect(result[0].estimatedTotalCents).toBe(85000);
      expect(result[0].previewImages).toEqual(['/img/p1.png', '/img/p2.png', '/img/p3.png']);
    });
  });

  describe('createList', () => {
    it('creates a new saved list successfully', async () => {
      mockPrisma.savedList.create.mockResolvedValue({
        id: 'list-new',
        name: 'Office Stationery',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createList('user-1', 'Office Stationery');

      expect(mockPrisma.savedList.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          name: 'Office Stationery',
        },
      });
      expect(result.id).toBe('list-new');
      expect(result.name).toBe('Office Stationery');
      expect(result.itemCount).toBe(0);
    });

    it('rejects blank list name', async () => {
      await expect(service.createList('user-1', '   ')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getListById', () => {
    it('retrieves detailed list with active catalogue info', async () => {
      mockPrisma.savedList.findFirst.mockResolvedValue({
        id: 'list-1',
        name: 'Grade 5',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'item-1',
            savedListId: 'list-1',
            productId: 'p1',
            quantity: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
            product: {
              id: 'p1',
              name: 'Exercise Book 80pgs',
              slug: 'exercise-book-80',
              sku: 'DSL-EB-80',
              priceCents: 12000,
              compareAtPriceCents: 14000,
              stockQuantity: 50,
              isActive: true,
              images: ['/img/book.png'],
              category: { name: 'Books' },
              brand: { name: 'DSL' },
            },
          },
        ],
      });

      const result = await service.getListById('user-1', 'list-1');

      expect(result.id).toBe('list-1');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].product.name).toBe('Exercise Book 80pgs');
      expect(result.estimatedTotalCents).toBe(24000);
    });

    it('throws NotFoundException if list does not exist or belongs to another user', async () => {
      mockPrisma.savedList.findFirst.mockResolvedValue(null);

      await expect(service.getListById('user-1', 'invalid-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('renameList', () => {
    it('renames list successfully', async () => {
      mockPrisma.savedList.findFirst.mockResolvedValue({ id: 'list-1', userId: 'user-1' });
      mockPrisma.savedList.update.mockResolvedValue({ id: 'list-1', name: 'Renamed List' });

      const result = await service.renameList('user-1', 'list-1', 'Renamed List');

      expect(result).toEqual({ id: 'list-1', name: 'Renamed List' });
    });

    it('throws BadRequestException on empty name', async () => {
      mockPrisma.savedList.findFirst.mockResolvedValue({ id: 'list-1', userId: 'user-1' });

      await expect(service.renameList('user-1', 'list-1', '  ')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('deleteList', () => {
    it('deletes list successfully', async () => {
      mockPrisma.savedList.findFirst.mockResolvedValue({ id: 'list-1', userId: 'user-1' });
      mockPrisma.savedList.delete.mockResolvedValue({ id: 'list-1' });

      const result = await service.deleteList('user-1', 'list-1');

      expect(result).toEqual({ success: true, listId: 'list-1' });
      expect(mockPrisma.savedList.delete).toHaveBeenCalledWith({ where: { id: 'list-1' } });
    });
  });

  describe('addItem', () => {
    it('adds a new product to list if not already present', async () => {
      mockPrisma.savedList.findFirst.mockResolvedValue({ id: 'list-1', userId: 'user-1' });
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'DSL Ball Pen',
        slug: 'dsl-pen',
        sku: 'PEN-01',
        priceCents: 3500,
        stockQuantity: 100,
        isActive: true,
        images: [],
        category: null,
        brand: null,
      });
      mockPrisma.savedListItem.findUnique.mockResolvedValue(null);
      mockPrisma.savedListItem.create.mockResolvedValue({
        id: 'item-new',
        savedListId: 'list-1',
        productId: 'p1',
        quantity: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: {
          id: 'p1',
          name: 'DSL Ball Pen',
          slug: 'dsl-pen',
          sku: 'PEN-01',
          priceCents: 3500,
          compareAtPriceCents: null,
          stockQuantity: 100,
          isActive: true,
          images: [],
          category: null,
          brand: null,
        },
      });
      mockPrisma.savedList.update.mockResolvedValue({});

      const result = await service.addItem('user-1', 'list-1', 'p1', 2);

      expect(mockPrisma.savedListItem.create).toHaveBeenCalledWith({
        data: {
          savedListId: 'list-1',
          productId: 'p1',
          quantity: 2,
        },
        include: expect.any(Object),
      });
      expect(result.quantity).toBe(2);
    });

    it('safely increments quantity if product already exists in list', async () => {
      mockPrisma.savedList.findFirst.mockResolvedValue({ id: 'list-1', userId: 'user-1' });
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1', isActive: true });
      mockPrisma.savedListItem.findUnique.mockResolvedValue({
        id: 'item-existing',
        savedListId: 'list-1',
        productId: 'p1',
        quantity: 3,
      });
      mockPrisma.savedListItem.update.mockResolvedValue({
        id: 'item-existing',
        savedListId: 'list-1',
        productId: 'p1',
        quantity: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: {
          id: 'p1',
          name: 'DSL Ball Pen',
          slug: 'dsl-pen',
          sku: 'PEN-01',
          priceCents: 3500,
          compareAtPriceCents: null,
          stockQuantity: 100,
          isActive: true,
          images: [],
          category: null,
          brand: null,
        },
      });
      mockPrisma.savedList.update.mockResolvedValue({});

      const result = await service.addItem('user-1', 'list-1', 'p1', 2);

      expect(mockPrisma.savedListItem.update).toHaveBeenCalledWith({
        where: { id: 'item-existing' },
        data: { quantity: 5 },
        include: expect.any(Object),
      });
      expect(result.quantity).toBe(5);
    });

    it('throws NotFoundException if product does not exist', async () => {
      mockPrisma.savedList.findFirst.mockResolvedValue({ id: 'list-1', userId: 'user-1' });
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.addItem('user-1', 'list-1', 'nonexistent-prod')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('updateItemQuantity', () => {
    it('updates quantity of an item', async () => {
      mockPrisma.savedList.findFirst.mockResolvedValue({ id: 'list-1', userId: 'user-1' });
      mockPrisma.savedListItem.findFirst.mockResolvedValue({ id: 'item-1', savedListId: 'list-1' });
      mockPrisma.savedListItem.update.mockResolvedValue({
        id: 'item-1',
        savedListId: 'list-1',
        productId: 'p1',
        quantity: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: {
          id: 'p1',
          name: 'Pen',
          slug: 'pen',
          sku: 'PEN-1',
          priceCents: 100,
          stockQuantity: 50,
          isActive: true,
          images: [],
        },
      });
      mockPrisma.savedList.update.mockResolvedValue({});

      const result = await service.updateItemQuantity('user-1', 'list-1', 'item-1', 10);

      expect(result.quantity).toBe(10);
    });
  });

  describe('removeItem', () => {
    it('removes an item from list', async () => {
      mockPrisma.savedList.findFirst.mockResolvedValue({ id: 'list-1', userId: 'user-1' });
      mockPrisma.savedListItem.findFirst.mockResolvedValue({ id: 'item-1', savedListId: 'list-1' });
      mockPrisma.savedListItem.delete.mockResolvedValue({});
      mockPrisma.savedList.update.mockResolvedValue({});

      const result = await service.removeItem('user-1', 'list-1', 'item-1');

      expect(result).toEqual({ success: true, itemId: 'item-1' });
      expect(mockPrisma.savedListItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    });
  });

  describe('checkAvailability', () => {
    it('calculates available, partial, and out-of-stock items accurately', async () => {
      mockPrisma.savedList.findFirst.mockResolvedValue({
        id: 'list-1',
        name: 'School Pack List',
        userId: 'user-1',
        items: [
          {
            id: 'item-1',
            productId: 'p1',
            quantity: 5,
            product: {
              id: 'p1',
              name: 'Fully in stock item',
              stockQuantity: 10,
              isActive: true,
              priceCents: 5000,
            },
          },
          {
            id: 'item-2',
            productId: 'p2',
            quantity: 5,
            product: {
              id: 'p2',
              name: 'Partially in stock item',
              stockQuantity: 2,
              isActive: true,
              priceCents: 4000,
            },
          },
          {
            id: 'item-3',
            productId: 'p3',
            quantity: 2,
            product: {
              id: 'p3',
              name: 'Out of stock item',
              stockQuantity: 0,
              isActive: true,
              priceCents: 3000,
            },
          },
        ],
      });

      const result = await service.checkAvailability('user-1', 'list-1');

      expect(result.totalItems).toBe(3);
      expect(result.availableCount).toBe(1);
      expect(result.partialCount).toBe(1);
      expect(result.outOfStockCount).toBe(1);
      expect(result.canAddAny).toBe(true);
      expect(result.items[0].isAvailable).toBe(true);
      expect(result.items[1].isPartial).toBe(true);
      expect(result.items[2].availableStock).toBe(0);
    });
  });
});

