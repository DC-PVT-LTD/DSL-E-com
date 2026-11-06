import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CartService', () => {
  let service: CartService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      cart: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      cartItem: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      productVariant: {
        findUnique: vi.fn(),
      },
      storeSettings: {
        findFirst: vi.fn().mockResolvedValue({
          flatDeliveryFeeCents: 35000,
          freeDeliveryThresholdCents: 500000,
        }),
      },
      inventoryMovement: {
        create: vi.fn(),
      },
    };

    service = new CartService(mockPrisma as unknown as PrismaService);
  });

  describe('getCart', () => {
    it('creates and returns an empty guest cart if non-existent', async () => {
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce(null) // for session lookup
        .mockResolvedValueOnce({
          id: 'cart-guest-1',
          userId: null,
          sessionId: 'session-abc',
          items: [],
          updatedAt: new Date(),
        }); // for buildCartResponse
      mockPrisma.cart.create.mockResolvedValue({
        id: 'cart-guest-1',
        userId: null,
        sessionId: 'session-abc',
        updatedAt: new Date(),
      });

      const res = await service.getCart(null, 'session-abc');
      expect(res.id).toBe('cart-guest-1');
      expect(res.itemCount).toBe(0);
      expect(res.subtotalCents).toBe(0);
      expect(res.totalCents).toBe(0);
      expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('returns an authenticated user cart with server calculated prices and delivery', async () => {
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({
          id: 'cart-user-1',
          userId: 'user-1',
          items: [],
        })
        .mockResolvedValueOnce({
          id: 'cart-user-1',
          userId: 'user-1',
          sessionId: null,
          items: [
            {
              id: 'item-1',
              cartId: 'cart-user-1',
              productId: 'prod-1',
              variantId: null,
              quantity: 2,
              product: {
                id: 'prod-1',
                name: 'CR Exercise Book 80pg',
                slug: 'cr-book-80',
                sku: 'DSL-CR-80',
                images: [],
                priceCents: 20000, // Rs. 200.00
                stockQuantity: 50,
                isActive: true,
                category: { name: 'Exercise Books' },
              },
              variant: null,
            },
          ],
          updatedAt: new Date(),
        });

      const res = await service.getCart('user-1', null);
      expect(res.id).toBe('cart-user-1');
      expect(res.itemCount).toBe(2);
      expect(res.subtotalCents).toBe(40000); // 2 * 20000 = 40000
      expect(res.deliveryCents).toBe(35000); // Below threshold
      expect(res.totalCents).toBe(75000);
      expect(res.isFreeDeliveryEligible).toBe(false);
      expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('throws NotFoundException when product does not exist', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({ id: 'cart-1' });
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.addItem(
          { productId: 'non-existent', quantity: 1 },
          'user-1',
          null
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when product is inactive', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({ id: 'cart-1' });
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-inactive',
        name: 'Old Ruler',
        isActive: false,
        variants: [],
      });

      await expect(
        service.addItem(
          { productId: 'prod-inactive', quantity: 1 },
          'user-1',
          null
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when variant does not belong to product', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({ id: 'cart-1' });
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Ballpoint Pen',
        isActive: true,
        variants: [{ id: 'var-blue', name: 'Blue', isActive: true, stockQuantity: 10 }],
      });

      await expect(
        service.addItem(
          { productId: 'prod-1', variantId: 'var-red', quantity: 1 },
          'user-1',
          null
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when quantity exceeds available stock', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({ id: 'cart-1' });
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Stapler',
        isActive: true,
        stockQuantity: 3,
        variants: [],
      });
      mockPrisma.cartItem.findFirst.mockResolvedValue(null);

      await expect(
        service.addItem(
          { productId: 'prod-1', quantity: 5 },
          'user-1',
          null
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('aggregates quantity for existing line item instead of creating duplicate', async () => {
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({ id: 'cart-1', userId: 'user-1' })
        .mockResolvedValueOnce({
          id: 'cart-1',
          userId: 'user-1',
          items: [
            {
              id: 'item-1',
              productId: 'prod-1',
              quantity: 4,
              product: {
                id: 'prod-1',
                name: 'Eraser',
                priceCents: 5000,
                stockQuantity: 20,
                isActive: true,
              },
            },
          ],
          updatedAt: new Date(),
        });

      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Eraser',
        isActive: true,
        stockQuantity: 20,
        variants: [],
      });

      mockPrisma.cartItem.findFirst.mockResolvedValue({
        id: 'item-1',
        cartId: 'cart-1',
        productId: 'prod-1',
        quantity: 2,
      });

      await service.addItem(
        { productId: 'prod-1', quantity: 2 },
        'user-1',
        null
      );

      expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { quantity: 4 },
      });
      expect(mockPrisma.cartItem.create).not.toHaveBeenCalled();
      expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('updateItemQuantity', () => {
    it('prevents cross-user cart modification', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({ id: 'cart-user-1', userId: 'user-1' });
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        id: 'item-other',
        cartId: 'cart-user-2', // Different cart!
        product: { stockQuantity: 10 },
      });

      await expect(
        service.updateItemQuantity(
          'item-other',
          { quantity: 3 },
          'user-1',
          null
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects quantity exceeding stock on update', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({ id: 'cart-user-1', userId: 'user-1' });
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        id: 'item-1',
        cartId: 'cart-user-1',
        product: { stockQuantity: 5 },
      });

      await expect(
        service.updateItemQuantity(
          'item-1',
          { quantity: 10 },
          'user-1',
          null
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('mergeGuestCart', () => {
    it('safely merges guest items into customer cart and cleans up guest cart', async () => {
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({ id: 'cart-user-1', userId: 'user-1' }) // user cart lookup
        .mockResolvedValueOnce({
          id: 'cart-user-1',
          userId: 'user-1',
          items: [],
          updatedAt: new Date(),
        }); // final build

      mockPrisma.cart.findFirst.mockResolvedValue({
        id: 'guest-cart-1',
        sessionId: 'guest-session-123',
        userId: null,
        items: [
          {
            id: 'g-item-1',
            productId: 'prod-1',
            variantId: null,
            quantity: 3,
            product: { id: 'prod-1', isActive: true, stockQuantity: 10 },
          },
        ],
      });

      mockPrisma.cartItem.findFirst.mockResolvedValue(null); // No existing line in user cart

      await service.mergeGuestCart({ guestSessionId: 'guest-session-123' }, 'user-1');

      expect(mockPrisma.cartItem.create).toHaveBeenCalledWith({
        data: {
          cartId: 'cart-user-1',
          productId: 'prod-1',
          variantId: null,
          quantity: 3,
        },
      });

      // Verify guest cart was safely deleted
      expect(mockPrisma.cart.delete).toHaveBeenCalledWith({
        where: { id: 'guest-cart-1' },
      });
      // Verify inventory was never decremented
      expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('addSchoolPack', () => {
    it('throws NotFoundException if pack does not exist', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({ id: 'cart-1', userId: 'user-1' });
      mockPrisma.schoolPack = { findUnique: vi.fn().mockResolvedValue(null) };

      await expect(
        service.addSchoolPack(
          { packId: 'non-existent-pack', items: [{ productId: 'prod-1', quantity: 1 }] },
          'user-1',
          null
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if product is not a component of the pack', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({ id: 'cart-1', userId: 'user-1' });
      mockPrisma.schoolPack = {
        findUnique: vi.fn().mockResolvedValue({
          id: 'pack-1',
          name: 'Grade 1 Pack',
          isActive: true,
          items: [{ productId: 'prod-1', substituteProductIds: [] }],
        }),
      };

      await expect(
        service.addSchoolPack(
          { packId: 'pack-1', items: [{ productId: 'unrelated-prod', quantity: 1 }] },
          'user-1',
          null
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('adds school pack items to cart when products and substitutes are valid', async () => {
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({ id: 'cart-1', userId: 'user-1' })
        .mockResolvedValueOnce({
          id: 'cart-1',
          userId: 'user-1',
          items: [
            {
              id: 'cart-item-1',
              productId: 'prod-1',
              quantity: 2,
              product: {
                id: 'prod-1',
                name: 'Notebook',
                priceCents: 15000,
                stockQuantity: 50,
                isActive: true,
              },
            },
          ],
          updatedAt: new Date(),
        });

      mockPrisma.schoolPack = {
        findUnique: vi.fn().mockResolvedValue({
          id: 'pack-1',
          name: 'Grade 1 Pack',
          isActive: true,
          items: [{ productId: 'prod-1', substituteProductIds: ['sub-prod-1'] }],
        }),
      };

      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Notebook', priceCents: 15000, stockQuantity: 50, isActive: true, variants: [] },
      ]);
      mockPrisma.cartItem.findFirst.mockResolvedValue(null);

      const result = await service.addSchoolPack(
        { packId: 'pack-1', items: [{ productId: 'prod-1', quantity: 2 }] },
        'user-1',
        null
      );

      expect(mockPrisma.cartItem.create).toHaveBeenCalledWith({
        data: {
          cartId: 'cart-1',
          productId: 'prod-1',
          variantId: null,
          quantity: 2,
        },
      });
      expect(result.items.length).toBe(1);
    });
  });

  describe('Phase A: removePurchasedItems', () => {
    it('removes only purchased items from the cart and preserves unselected items', async () => {
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({
          id: 'cart-1',
          userId: 'user-1',
          items: [],
        }) // findOrCreateCart
        .mockResolvedValueOnce({
          id: 'cart-1',
          userId: 'user-1',
          sessionId: null,
          items: [
            {
              id: 'cart-item-2',
              cartId: 'cart-1',
              productId: 'prod-2',
              variantId: null,
              quantity: 1,
              product: {
                id: 'prod-2',
                name: 'Unselected Pen',
                priceCents: 8000,
                stockQuantity: 10,
                isActive: true,
              },
            },
          ],
          updatedAt: new Date(),
        }); // buildCartResponse

      mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removePurchasedItems(
        [{ productId: 'prod-1', variantId: null }],
        'user-1',
        null
      );

      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: {
          cartId: 'cart-1',
          productId: 'prod-1',
          variantId: null,
        },
      });

      // The remaining cart response only contains the unselected product
      expect(result.items.length).toBe(1);
      expect(result.items[0].productId).toBe('prod-2');
    });

    it('returns cart without changes if purchasedItems is empty', async () => {
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({
          id: 'cart-1',
          userId: 'user-1',
          items: [],
        })
        .mockResolvedValueOnce({
          id: 'cart-1',
          userId: 'user-1',
          sessionId: null,
          items: [],
          updatedAt: new Date(),
        });

      await service.removePurchasedItems([], 'user-1', null);
      expect(mockPrisma.cartItem.deleteMany).not.toHaveBeenCalled();
    });
  });
});

