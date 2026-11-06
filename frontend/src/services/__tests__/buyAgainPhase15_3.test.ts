import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCartStore } from '../cartStore';
import { orderService } from '../orderService';
import { cartService } from '../cartService';
import { apiClient } from '@/lib/api/apiClient';
import { BuyAgainResponse } from '@/types/order';

describe('Phase 15.3 — Buy Again from Previous Orders', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
    vi.restoreAllMocks();

    // Default mock for cartService.addItem to return synchronized backend items
    vi.spyOn(cartService, 'addItem').mockImplementation(async () => {
      const currentItems = useCartStore.getState().items;
      return {
        id: 'cart-mock-1',
        items: currentItems.map((ci) => ({
          id: ci.id,
          productId: ci.productId,
          variantId: ci.variantId || null,
          product: ci.product,
          variant: ci.variant || null,
          quantity: ci.quantity,
          unitPriceCents: ci.unitPriceCents,
          totalPriceCents: ci.totalPriceCents,
          isAvailable: true,
          isOutOfStock: false,
          exceedsStock: false,
        })),
        itemCount: currentItems.reduce((s, i) => s + i.quantity, 0),
        subtotalCents: currentItems.reduce((s, i) => s + i.totalPriceCents, 0),
        discountCents: 0,
        deliveryCents: 35000,
        totalCents: currentItems.reduce((s, i) => s + i.totalPriceCents, 0) + 35000,
        isFreeDeliveryEligible: false,
        freeDeliveryThresholdCents: 500000,
        updatedAt: new Date().toISOString(),
      } as any;
    });
  });

  describe('1. API Communication & Ownership Handling', () => {
    it('calls POST /orders/:orderId/buy-again and returns structured result', async () => {
      const mockResponse: BuyAgainResponse = {
        success: true,
        orderId: 'ord-test-1',
        orderNumber: 'DSL-2026-0001',
        items: [
          {
            orderItemId: 'oi-1',
            productId: 'prod-atlas-cr',
            variantId: null,
            productName: 'Atlas CR Book 120 Pages',
            variantName: null,
            sku: 'SKU-ATL-120',
            images: ['/cr.png'],
            requestedQuantity: 2,
            availableQuantity: 2,
            currentPriceCents: 25000,
            historicalPriceCents: 22000,
            priceChanged: true,
            status: 'AVAILABLE',
            reason: 'PRICE_CHANGED',
            bundleInfo: null,
            product: {
              id: 'prod-atlas-cr',
              name: 'Atlas CR Book 120 Pages',
              slug: 'atlas-cr-120',
              sku: 'SKU-ATL-120',
              priceCents: 25000,
              stockQuantity: 40,
              isActive: true,
              images: ['/cr.png'],
              categoryId: 'cat-books',
              brandId: 'brand-atlas',
            },
            variant: null,
          },
        ],
        summary: {
          totalRequestedItems: 1,
          availableCount: 1,
          partialCount: 0,
          unavailableCount: 0,
          totalAddedQuantity: 2,
          estimatedTotalCents: 50000,
        },
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        success: true,
        data: mockResponse,
      });

      const result = await orderService.buyAgain('ord-test-1');

      expect(postSpy).toHaveBeenCalledWith('/orders/ord-test-1/buy-again');
      expect(result.success).toBe(true);
      expect(result.items[0].productName).toBe('Atlas CR Book 120 Pages');
      expect(result.items[0].priceChanged).toBe(true);
      expect(result.summary.totalAddedQuantity).toBe(2);
    });

    it('propagates error when order does not belong to customer (403 Forbidden)', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(
        new Error('You do not have permission to reorder products from this order')
      );

      await expect(orderService.buyAgain('ord-other-customer')).rejects.toThrow(
        'You do not have permission to reorder products from this order'
      );
    });
  });

  describe('2. Cart Transfer & Existing Cart Preservation', () => {
    it('preserves existing cart items when transferring Buy Again products', async () => {
      const { addItem, addBuyAgainBatch } = useCartStore.getState();

      // 1. Add pre-existing product to cart
      await addItem(
        {
          id: 'prod-pencil-2b',
          name: 'Atlas 2B Pencil',
          priceCents: 3500,
          stockQuantity: 100,
          isActive: true,
        } as any,
        3
      );

      let cart = useCartStore.getState().items;
      expect(cart).toHaveLength(1);
      expect(cart[0].productId).toBe('prod-pencil-2b');
      expect(cart[0].quantity).toBe(3);

      // 2. Buy Again items to transfer
      const buyAgainItems = [
        {
          product: {
            id: 'prod-atlas-cr',
            name: 'Atlas CR Book 120 Pages',
            priceCents: 25000,
            stockQuantity: 50,
            isActive: true,
          } as any,
          quantity: 2,
        },
      ];

      const addedCount = await addBuyAgainBatch(buyAgainItems);
      expect(addedCount).toBe(1);

      // 3. Verify existing cart item remains intact along with newly transferred item
      cart = useCartStore.getState().items;
      expect(cart).toHaveLength(2);

      const pencilItem = cart.find((i) => i.productId === 'prod-pencil-2b');
      const bookItem = cart.find((i) => i.productId === 'prod-atlas-cr');

      expect(pencilItem).toBeDefined();
      expect(pencilItem?.quantity).toBe(3);
      expect(bookItem).toBeDefined();
      expect(bookItem?.quantity).toBe(2);
      expect(bookItem?.unitPriceCents).toBe(25000);
    });

    it('uses current catalogue prices rather than historical prices', async () => {
      const { addBuyAgainBatch } = useCartStore.getState();

      // Historical price was 20000, current price is 25000
      await addBuyAgainBatch([
        {
          product: {
            id: 'prod-atlas-cr',
            name: 'Atlas CR Book 120 Pages',
            priceCents: 25000, // Current price
            stockQuantity: 50,
            isActive: true,
          } as any,
          quantity: 2,
        },
      ]);

      const cart = useCartStore.getState().items;
      expect(cart[0].unitPriceCents).toBe(25000);
      expect(cart[0].totalPriceCents).toBe(50000);
    });
  });

  describe('3. Partial & Unavailable Product Handling', () => {
    it('adds only available stock quantity for partially available items', async () => {
      const { addBuyAgainBatch } = useCartStore.getState();

      // Requested was 5, but live stock is only 2
      await addBuyAgainBatch([
        {
          product: {
            id: 'prod-limited-pen',
            name: 'Special Edition Pen',
            priceCents: 15000,
            stockQuantity: 2, // Live stock
            isActive: true,
          } as any,
          quantity: 2, // Adjusted quantity from Buy Again evaluation
        },
      ]);

      const cart = useCartStore.getState().items;
      expect(cart).toHaveLength(1);
      expect(cart[0].quantity).toBe(2);
    });

    it('does not add unavailable or out of stock items to cart', async () => {
      const { addBuyAgainBatch } = useCartStore.getState();

      // Item has quantity 0 (unavailable / out of stock)
      const addedCount = await addBuyAgainBatch([
        {
          product: {
            id: 'prod-out-of-stock',
            name: 'Sold Out Marker',
            priceCents: 12000,
            stockQuantity: 0,
            isActive: true,
          } as any,
          quantity: 0,
        },
      ]);

      expect(addedCount).toBe(0);
      const cart = useCartStore.getState().items;
      expect(cart).toHaveLength(0);
    });
  });

  describe('4. School Pack Bundle Representation', () => {
    it('preserves School Pack bundle identity when transferred to cart', async () => {
      const { addBuyAgainBatch } = useCartStore.getState();

      await addBuyAgainBatch([
        {
          product: {
            id: 'prod-cr-book',
            name: 'CR Book 120 Pages',
            priceCents: 20000,
            stockQuantity: 30,
            isActive: true,
          } as any,
          quantity: 4,
          bundleInfo: {
            packId: 'pack-grade-1',
            packName: 'Grade 1 Starter Pack',
            savingsPercentage: 15,
          },
        },
      ]);

      const cart = useCartStore.getState().items;
      expect(cart).toHaveLength(1);
      expect(cart[0].bundleInfo).toBeDefined();
      expect(cart[0].bundleInfo?.packName).toBe('Grade 1 Starter Pack');
      expect(cart[0].bundleInfo?.savingsPercentage).toBe(15);
    });
  });
});
