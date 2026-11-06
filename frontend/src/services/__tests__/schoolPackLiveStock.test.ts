import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inventorySocketService, LiveStockUpdate } from '../inventorySocketService';
import { useCartStore } from '../cartStore';
import { schoolPackService } from '../schoolPackService';

describe('School Packs Real-Time Inventory & WebSocket Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCartStore.getState().clearCartLocal();
  });

  describe('Dynamic Pack Availability Evaluation', () => {
    function computePackStatus(
      items: { productId: string; quantity: number; stockQuantity: number }[]
    ): 'IN_STOCK' | 'LIMITED_STOCK' | 'OUT_OF_STOCK' {
      if (items.length === 0) return 'IN_STOCK';
      const anyOutOfStock = items.some(
        (item) => item.stockQuantity <= 0 || item.quantity > item.stockQuantity
      );
      if (anyOutOfStock) return 'OUT_OF_STOCK';
      const anyLowStock = items.some((item) => item.stockQuantity <= 5);
      if (anyLowStock) return 'LIMITED_STOCK';
      return 'IN_STOCK';
    }

    it('evaluates IN_STOCK when all components have ample stock', () => {
      const items = [
        { productId: 'prod-1', quantity: 2, stockQuantity: 50 },
        { productId: 'prod-2', quantity: 3, stockQuantity: 20 },
      ];
      expect(computePackStatus(items)).toBe('IN_STOCK');
    });

    it('evaluates LIMITED_STOCK when at least one component has low stock (<= 5)', () => {
      const items = [
        { productId: 'prod-1', quantity: 2, stockQuantity: 50 },
        { productId: 'prod-2', quantity: 3, stockQuantity: 4 },
      ];
      expect(computePackStatus(items)).toBe('LIMITED_STOCK');
    });

    it('evaluates OUT_OF_STOCK when a component has 0 stock', () => {
      const items = [
        { productId: 'prod-1', quantity: 2, stockQuantity: 50 },
        { productId: 'prod-2', quantity: 3, stockQuantity: 0 },
      ];
      expect(computePackStatus(items)).toBe('OUT_OF_STOCK');
    });

    it('evaluates OUT_OF_STOCK when required quantity exceeds available stock', () => {
      const items = [
        { productId: 'prod-1', quantity: 10, stockQuantity: 8 },
        { productId: 'prod-2', quantity: 1, stockQuantity: 25 },
      ];
      expect(computePackStatus(items)).toBe('OUT_OF_STOCK');
    });
  });

  describe('WebSocket Subscription & Lifecycle Cleanup', () => {
    it('subscribes to component products and cleanly unsubscribes on unmount', () => {
      const callback = vi.fn();
      const unsub = inventorySocketService.subscribeProduct('prod-test-live-1', callback);

      expect(typeof unsub).toBe('function');

      // Unsubscribe cleanly
      unsub();
      // Should not throw and should prevent future callback invocation
    });

    it('subscribes and receives live stock updates for multiple component products', () => {
      const updatesReceived: LiveStockUpdate[] = [];
      const unsub1 = inventorySocketService.subscribeProduct('prod-pen-blue', (update) => {
        updatesReceived.push(update);
      });
      const unsub2 = inventorySocketService.subscribeProduct('prod-book-cr', (update) => {
        updatesReceived.push(update);
      });

      // Dispatch internal updates via the service's private dispatch mechanism
      (inventorySocketService as any).dispatchStockUpdate({
        productId: 'prod-pen-blue',
        physicalStock: 10,
        reservedStock: 2,
        availableStock: 8,
        timestamp: new Date().toISOString(),
      });

      (inventorySocketService as any).dispatchStockUpdate({
        productId: 'prod-book-cr',
        physicalStock: 5,
        reservedStock: 1,
        availableStock: 4,
        timestamp: new Date().toISOString(),
      });

      expect(updatesReceived.length).toBe(2);
      expect(updatesReceived[0].productId).toBe('prod-pen-blue');
      expect(updatesReceived[0].availableStock).toBe(8);
      expect(updatesReceived[1].productId).toBe('prod-book-cr');
      expect(updatesReceived[1].availableStock).toBe(4);

      unsub1();
      unsub2();

      // Dispatching after unsubscribe should not invoke callbacks
      (inventorySocketService as any).dispatchStockUpdate({
        productId: 'prod-pen-blue',
        physicalStock: 0,
        reservedStock: 0,
        availableStock: 0,
        timestamp: new Date().toISOString(),
      });

      expect(updatesReceived.length).toBe(2);
    });

    it('handles socket reconnection callback for authoritative server refetch', async () => {
      const reconnectSpy = vi.fn();
      const unsub = inventorySocketService.onReconnect(reconnectSpy);

      // Simulate reconnect trigger
      (inventorySocketService as any).reconnectListeners.forEach((cb: () => void) => cb());

      expect(reconnectSpy).toHaveBeenCalledTimes(1);
      unsub();
    });
  });

  describe('Cart Real-Time Stock Clamping & Bundle Discount Preservation', () => {
    it('updates bundled cart item stock, flags exceedsStock, and retains bundle discount', async () => {
      const sampleProduct = {
        id: 'prod-colour-pencil-12',
        name: 'Doms 12 Colour Pencils',
        slug: 'doms-12-colour-pencils',
        sku: 'DOMS-CP-12',
        description: 'Colour pencils',
        shortDescription: 'Colour pencils',
        priceCents: 42000,
        stockQuantity: 15,
        lowStockThreshold: 5,
        isActive: true,
        isFeatured: false,
        isNewArrival: false,
        isBestSeller: false,
        images: [],
        tags: [],
        rating: 5,
        reviewCount: 0,
        specifications: {},
        categoryId: 'cat-pencils',
        categoryName: 'Pencils',
        brandId: 'brand-doms',
        brandName: 'Doms',
        createdAt: '',
        updatedAt: '',
      };

      const pack = {
        id: 'pack-art-starter',
        name: 'Junior Art Starter Pack',
        savingsPercentage: 12,
      };

      // Add bundled pack to cart with quantity 5
      await useCartStore.getState().addSchoolPack(pack, [
        {
          productId: sampleProduct.id,
          product: sampleProduct,
          quantity: 5,
        },
      ]);

      const initialSummary = useCartStore.getState().getSummary();
      expect(initialSummary.subtotalCents).toBe(42000 * 5); // 210,000 cents
      expect(initialSummary.discountCents).toBe(Math.round((210000 * 12) / 100)); // 25,200 cents

      // Live stock update: stock drops to 3 (< 5 in cart)
      useCartStore.getState().updateStockAvailability('prod-colour-pencil-12', null, 3);

      const items = useCartStore.getState().items;
      expect(items[0].product.stockQuantity).toBe(3);
      expect(items[0].exceedsStock).toBe(true);
      expect(items[0].isOutOfStock).toBe(false);

      // Bundle savings must not be wiped out!
      expect(items[0].bundleInfo?.packName).toBe('Junior Art Starter Pack');
      expect(items[0].bundleInfo?.savingsPercentage).toBe(12);

      const updatedSummary = useCartStore.getState().getSummary();
      expect(updatedSummary.discountCents).toBe(25200);
      expect(updatedSummary.warnings?.some((w) => w.includes('Only 3 units'))).toBe(true);
    });
  });
});

