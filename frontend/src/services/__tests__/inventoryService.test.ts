import { describe, it, expect } from 'vitest';
import { inventoryService } from '../inventoryService';
import { productService } from '../productService';

describe('inventoryService', () => {
  it('adjusts stock and records movement history correctly', () => {
    const product = productService.getAll()[0];
    const originalQty = product.stockQuantity;

    const success = inventoryService.adjustStock(
      product.id,
      originalQty + 25,
      'restock',
      'Shipment intake',
      'Test Admin'
    );

    expect(success).toBe(true);
    expect(productService.getById(product.id)?.stockQuantity).toBe(originalQty + 25);

    const movements = inventoryService.getMovements();
    expect(movements[0].productId).toBe(product.id);
    expect(movements[0].changeAmount).toBe(25);
    expect(movements[0].reason).toBe('restock');
  });
});
