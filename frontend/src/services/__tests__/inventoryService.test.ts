import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { inventoryService } from '../inventoryService';
import { productService } from '../productService';
import { apiClient, ApiError } from '@/lib/api/apiClient';

describe('inventoryService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    productService.resetToDefault();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchMovements', () => {
    it('successfully fetches paginated movements from backend and maps relations', async () => {
      const mockBackendResponse = {
        success: true,
        data: [
          {
            id: 'mov-101',
            productId: 'prod-cr-120-single',
            variantId: null,
            previousQuantity: 100,
            newQuantity: 125,
            changeAmount: 25,
            reason: 'RESTOCK',
            note: 'Container delivery',
            performedById: 'admin-usr-1',
            createdAt: '2026-11-03T10:00:00.000Z',
            product: {
              id: 'prod-cr-120-single',
              name: 'Atlas CR Book 120 Pages - Single Line',
              sku: 'ATL-CR-120-SL',
            },
            variant: null,
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockBackendResponse as any);

      const result = await inventoryService.fetchMovements({ page: 1, limit: 10 });

      expect(getSpy).toHaveBeenCalledWith('inventory/movements', {
        params: { page: 1, limit: 10 },
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].productName).toBe('Atlas CR Book 120 Pages - Single Line');
      expect(result.items[0].sku).toBe('ATL-CR-120-SL');
      expect(result.items[0].performedBy).toBe('admin-usr-1');
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('passes movement query filters to the backend API', async () => {
      const mockEmptyResponse = {
        success: true,
        data: [],
        meta: { page: 1, limit: 10, totalItems: 0, totalPages: 1 },
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockEmptyResponse as any);

      await inventoryService.fetchMovements({
        page: 2,
        limit: 10,
        productId: 'prod-1',
        reason: 'RESTOCK',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });

      expect(getSpy).toHaveBeenCalledWith('inventory/movements', {
        params: {
          page: 2,
          limit: 10,
          productId: 'prod-1',
          reason: 'RESTOCK',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
      });
    });

    it('propagates API network errors without falling back to fabricated data', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(
        new ApiError('Backend unavailable', 503, undefined, true)
      );

      await expect(inventoryService.fetchMovements({ page: 1 })).rejects.toThrow('Backend unavailable');
    });
  });

  describe('adjustStock', () => {
    it('successfully adjusts standalone product stock and synchronizes cache', async () => {
      const product = productService.getAll()[0];
      const initialStock = product.stockQuantity;

      const mockAdjustmentResponse = {
        success: true,
        message: 'Stock adjusted successfully',
        data: {
          movement: {
            id: 'mov-adj-1',
            productId: product.id,
            variantId: null,
            previousQuantity: initialStock,
            newQuantity: initialStock + 20,
            changeAmount: 20,
            reason: 'RESTOCK',
            note: 'Restock test',
            performedById: 'admin-1',
            createdAt: '2026-11-03T11:00:00.000Z',
          },
          product: {
            id: product.id,
            name: product.name,
            sku: product.sku,
            stockQuantity: initialStock + 20,
            lowStockThreshold: product.lowStockThreshold,
          },
          variant: null,
        },
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockAdjustmentResponse as any);

      const listener = vi.fn();
      const unsub = inventoryService.subscribe(listener);

      const result = await inventoryService.adjustStock({
        productId: product.id,
        targetQuantity: initialStock + 20,
        reason: 'RESTOCK',
        note: 'Restock test',
      });

      expect(postSpy).toHaveBeenCalledWith('inventory/adjust', {
        productId: product.id,
        targetQuantity: initialStock + 20,
        reason: 'RESTOCK',
        note: 'Restock test',
      });

      expect(result.product.stockQuantity).toBe(initialStock + 20);
      expect(productService.getById(product.id)?.stockQuantity).toBe(initialStock + 20);
      expect(listener).toHaveBeenCalled();

      const movements = inventoryService.getMovements();
      expect(movements[0].id).toBe('mov-adj-1');
      expect(movements[0].changeAmount).toBe(20);

      unsub();
    });

    it('correctly updates variant stock and parent aggregate without double-counting', async () => {
      // Find or prepare a product with variants
      const allProducts = productService.getAll();
      const productWithVariants = allProducts.find((p) => p.variants && p.variants.length > 0) || {
        ...allProducts[0],
        variants: [
          {
            id: 'var-red-1',
            name: 'Red Ink',
            sku: 'PEN-RED',
            priceCents: 5000,
            stockQuantity: 20,
            attributes: { color: 'Red' },
          },
        ],
      };

      // Set product in cache with initial variant stock 20 and aggregate 50
      productService.updateProduct(productWithVariants.id, {
        stockQuantity: 50,
        variants: [
          {
            id: 'var-red-1',
            name: 'Red Ink',
            sku: 'PEN-RED',
            priceCents: 5000,
            stockQuantity: 20,
            attributes: { color: 'Red' },
          },
        ],
      });

      // Server returns updated variant (20 -> 15) and aggregate (50 -> 45)
      const mockVariantAdjustment = {
        success: true,
        message: 'Stock adjusted successfully',
        data: {
          movement: {
            id: 'mov-var-1',
            productId: productWithVariants.id,
            variantId: 'var-red-1',
            previousQuantity: 20,
            newQuantity: 15,
            changeAmount: -5,
            reason: 'DAMAGED',
            note: 'Broken clips',
            performedById: 'admin-1',
            createdAt: '2026-11-03T11:30:00.000Z',
          },
          product: {
            id: productWithVariants.id,
            name: productWithVariants.name,
            sku: productWithVariants.sku,
            stockQuantity: 45,
            lowStockThreshold: productWithVariants.lowStockThreshold,
          },
          variant: {
            id: 'var-red-1',
            name: 'Red Ink',
            sku: 'PEN-RED',
            stockQuantity: 15,
          },
        },
      };

      vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockVariantAdjustment as any);

      await inventoryService.adjustStock({
        productId: productWithVariants.id,
        variantId: 'var-red-1',
        delta: -5,
        reason: 'DAMAGED',
        note: 'Broken clips',
      });

      const updated = productService.getById(productWithVariants.id);
      expect(updated?.stockQuantity).toBe(45); // Aggregate updated exactly once
      expect(updated?.variants?.[0].stockQuantity).toBe(15); // Variant updated
    });

    it('does not alter confirmed stock when server adjustment fails', async () => {
      const product = productService.getAll()[0];
      const initialStock = product.stockQuantity;

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(
        new ApiError('Stock quantity cannot be negative', 400)
      );

      await expect(
        inventoryService.adjustStock({
          productId: product.id,
          delta: -99999,
          reason: 'DAMAGED',
        })
      ).rejects.toThrow('Stock quantity cannot be negative');

      // Confirmed stock remains unchanged
      expect(productService.getById(product.id)?.stockQuantity).toBe(initialStock);
    });
  });

  describe('fetchLowStock', () => {
    it('queries low-stock items from backend API', async () => {
      const mockLowStockResponse = {
        success: true,
        data: [
          {
            id: 'prod-low-1',
            name: 'Atlas Geometry Box',
            sku: 'ATL-GEO-01',
            stockQuantity: 3,
            lowStockThreshold: 10,
            priceCents: 45000,
          },
        ],
        meta: {
          page: 1,
          limit: 20,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockLowStockResponse as any);

      const result = await inventoryService.fetchLowStock({ page: 1, limit: 20, threshold: 5 });

      expect(getSpy).toHaveBeenCalledWith('inventory/low-stock', {
        params: { page: 1, limit: 20, threshold: 5 },
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].sku).toBe('ATL-GEO-01');
      expect(result.total).toBe(1);
    });
  });
});
