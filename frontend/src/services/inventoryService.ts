import {
  InventoryMovement,
  AdjustStockInput,
  StockAdjustmentResponseData,
  InventoryMovementQueryOptions,
  LowStockQueryOptions,
  InventoryChangeReason,
} from '@/types/admin';
import { Product } from '@/types/product';
import { PaginatedResult } from '@/types/common';
import {
  apiClient,
  BackendApiResponse,
  BackendPaginatedResponse,
} from '@/lib/api/apiClient';
import { productService } from './productService';

class InventoryService {
  private movements: InventoryMovement[] = [];
  private listeners: Set<() => void> = new Set();

  /**
   * Helper to normalize a backend movement entity to frontend presentation shape.
   */
  private mapBackendMovement(m: any): InventoryMovement {
    return {
      id: m.id,
      productId: m.productId,
      variantId: m.variantId || null,
      previousQuantity: m.previousQuantity,
      newQuantity: m.newQuantity,
      changeAmount: m.changeAmount,
      reason: m.reason as InventoryChangeReason,
      note: m.note || null,
      createdAt: m.createdAt || new Date().toISOString(),
      timestamp: m.createdAt || new Date().toISOString(),
      performedById: m.performedById || null,
      performedBy: m.performedById || 'Authorized Admin',
      product: m.product
        ? { id: m.product.id, name: m.product.name, sku: m.product.sku }
        : undefined,
      variant: m.variant
        ? { id: m.variant.id, name: m.variant.name, sku: m.variant.sku }
        : null,
      productName: m.product?.name || m.productName || 'Stationery Product',
      sku: m.variant?.sku || m.product?.sku || m.sku || 'N/A',
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in inventory subscriber listener:', err);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Returns locally cached movements synchronously.
   */
  public getMovements(): InventoryMovement[] {
    return [...this.movements];
  }

  /**
   * Fetch paginated inventory movements from NestJS backend API (/api/v1/inventory/movements).
   */
  public async fetchMovements(
    options: InventoryMovementQueryOptions = {}
  ): Promise<PaginatedResult<InventoryMovement>> {
    const params: Record<string, string | number | undefined> = {};

    if (options.page !== undefined) params.page = options.page;
    if (options.limit !== undefined) params.limit = options.limit;
    if (options.productId) params.productId = options.productId;
    if (options.variantId) params.variantId = options.variantId;
    if (options.reason) params.reason = options.reason.toUpperCase();
    if (options.startDate) params.startDate = options.startDate;
    if (options.endDate) params.endDate = options.endDate;
    if (options.sortBy) params.sortBy = options.sortBy;
    if (options.sortOrder) params.sortOrder = options.sortOrder;

    const res = await apiClient.get<BackendPaginatedResponse<any>>('inventory/movements', {
      params,
    });

    if (!res?.success || !Array.isArray(res.data)) {
      throw new Error(res?.message || 'Failed to retrieve inventory movements from server');
    }

    const items = res.data.map((m) => this.mapBackendMovement(m));

    // Cache latest items
    this.movements = items;
    this.notifyListeners();

    return {
      items,
      total: res.meta?.totalItems ?? items.length,
      page: res.meta?.page ?? options.page ?? 1,
      pageSize: res.meta?.limit ?? options.limit ?? 20,
      totalPages: res.meta?.totalPages ?? 1,
    };
  }

  /**
   * Adjust stock via NestJS backend API (POST /api/v1/inventory/adjust).
   * Overloaded to maintain backward compatibility while supporting full variant adjustment.
   */
  public async adjustStock(
    paramsOrProductId: AdjustStockInput | string,
    legacyNewQuantity?: number,
    legacyReason?: string,
    legacyNote?: string
  ): Promise<StockAdjustmentResponseData> {
    let payload: {
      productId: string;
      variantId?: string | null;
      delta?: number;
      targetQuantity?: number;
      reason: string;
      note?: string | null;
    };

    if (typeof paramsOrProductId === 'object') {
      const p = paramsOrProductId;
      payload = {
        productId: p.productId,
        variantId: p.variantId || undefined,
        delta: p.delta,
        targetQuantity: p.targetQuantity,
        reason: (p.reason || 'RESTOCK').toUpperCase(),
        note: p.note || undefined,
      };
    } else {
      payload = {
        productId: paramsOrProductId,
        targetQuantity: legacyNewQuantity,
        reason: (legacyReason || 'RESTOCK').toUpperCase(),
        note: legacyNote || undefined,
      };
    }

    const res = await apiClient.post<BackendApiResponse<StockAdjustmentResponseData>>(
      'inventory/adjust',
      payload
    );

    if (!res?.success || !res.data) {
      throw new Error(res?.message || 'Stock adjustment failed on server');
    }

    const adjustmentData = res.data;

    // 1. Synchronize product cache without double-counting
    const confirmedProduct = adjustmentData.product;
    const confirmedVariant = adjustmentData.variant;

    const cachedProduct = productService.getById(confirmedProduct.id);
    if (cachedProduct) {
      if (confirmedVariant) {
        // Update the variant stock and the parent aggregate stock in tandem
        const updatedVariants = cachedProduct.variants?.map((v) =>
          v.id === confirmedVariant.id
            ? { ...v, stockQuantity: confirmedVariant.stockQuantity }
            : v
        );
        productService.updateProduct(confirmedProduct.id, {
          stockQuantity: confirmedProduct.stockQuantity,
          variants: updatedVariants,
        });
      } else {
        // Standalone product stock update
        productService.updateProduct(confirmedProduct.id, {
          stockQuantity: confirmedProduct.stockQuantity,
        });
      }
    }

    // 2. Prepend created movement to local cache
    const mappedMovement = this.mapBackendMovement({
      ...adjustmentData.movement,
      product: {
        id: confirmedProduct.id,
        name: confirmedProduct.name,
        sku: confirmedProduct.sku,
      },
      variant: confirmedVariant
        ? {
            id: confirmedVariant.id,
            name: confirmedVariant.name,
            sku: confirmedVariant.sku,
          }
        : null,
    });

    this.movements = [
      mappedMovement,
      ...this.movements.filter((m) => m.id !== mappedMovement.id),
    ];

    this.notifyListeners();

    return adjustmentData;
  }

  /**
   * Fetch low stock items via NestJS backend API (GET /api/v1/inventory/low-stock).
   */
  public async fetchLowStock(
    options: LowStockQueryOptions = {}
  ): Promise<PaginatedResult<Product>> {
    const params: Record<string, string | number | undefined> = {};

    if (options.page !== undefined) params.page = options.page;
    if (options.limit !== undefined) params.limit = options.limit;
    if (options.threshold !== undefined) params.threshold = options.threshold;
    if (options.categoryId) params.categoryId = options.categoryId;
    if (options.sortBy) params.sortBy = options.sortBy;
    if (options.sortOrder) params.sortOrder = options.sortOrder;

    const res = await apiClient.get<BackendPaginatedResponse<Product>>('inventory/low-stock', {
      params,
    });

    if (!res?.success || !Array.isArray(res.data)) {
      throw new Error(res?.message || 'Failed to retrieve low-stock products from server');
    }

    return {
      items: res.data,
      total: res.meta?.totalItems ?? res.data.length,
      page: res.meta?.page ?? options.page ?? 1,
      pageSize: res.meta?.limit ?? options.limit ?? 20,
      totalPages: res.meta?.totalPages ?? 1,
    };
  }
}

export const inventoryService = new InventoryService();
