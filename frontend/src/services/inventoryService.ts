import { InventoryMovement } from '@/types/admin';
import { productService } from './productService';

const MOVEMENTS_STORAGE_KEY = 'dsl_inventory_movements_v1';

const INITIAL_MOVEMENTS: InventoryMovement[] = [
  {
    id: 'mov-1',
    productId: 'prod-cr-120-single',
    productName: 'Atlas CR Book 120 Pages - Single Line',
    sku: 'ATL-CR-120-SL',
    previousQuantity: 100,
    newQuantity: 180,
    changeAmount: 80,
    reason: 'restock',
    note: 'Container delivery from Atlas warehouse',
    timestamp: '2026-01-20T10:15:00Z',
    performedBy: 'Inventory Admin',
  },
  {
    id: 'mov-2',
    productId: 'prod-atlas-chooty-pen',
    productName: 'Atlas Chooty Ballpoint Pen Pack of 10',
    sku: 'ATL-BP-CHOOTY-10',
    previousQuantity: 350,
    newQuantity: 340,
    changeAmount: -10,
    reason: 'order_fulfillment',
    note: 'Fulfilled bulk school order',
    timestamp: '2026-01-24T14:20:00Z',
    performedBy: 'System Auto-Fulfill',
  },
];

class InventoryService {
  private movements: InventoryMovement[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initData();
  }

  private initData() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(MOVEMENTS_STORAGE_KEY);
        if (stored) {
          this.movements = JSON.parse(stored);
          return;
        }
      } catch (err) {
        console.error('Error loading inventory movements:', err);
      }
    }
    this.movements = [...INITIAL_MOVEMENTS];
  }

  private persistAndNotify() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(this.movements));
      } catch (err) {
        console.error('Error saving inventory movements:', err);
      }
    }
    this.listeners.forEach((listener) => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getMovements(): InventoryMovement[] {
    return [...this.movements];
  }

  public adjustStock(
    productId: string,
    newQuantity: number,
    reason: InventoryMovement['reason'],
    note?: string,
    performedBy = 'Store Admin'
  ): boolean {
    if (newQuantity < 0) return false;

    const product = productService.getById(productId);
    if (!product) return false;

    const previousQuantity = product.stockQuantity;
    const changeAmount = newQuantity - previousQuantity;

    // Update product stock through the central product service
    productService.updateProduct(productId, { stockQuantity: newQuantity });

    const movement: InventoryMovement = {
      id: `mov-${Date.now()}`,
      productId,
      productName: product.name,
      sku: product.sku,
      previousQuantity,
      newQuantity,
      changeAmount,
      reason,
      note,
      timestamp: new Date().toISOString(),
      performedBy,
    };

    this.movements.unshift(movement);
    this.persistAndNotify();
    return true;
  }
}

export const inventoryService = new InventoryService();
