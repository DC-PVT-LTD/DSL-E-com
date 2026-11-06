/**
 * WebSocket and Event contracts for School Packs and Live Stock Updates.
 */
export const SCHOOL_PACK_EVENTS = {
  PACK_STOCK_UPDATED: 'school-pack:stock-updated',
  PRODUCT_STOCK_CHANGED: 'product:stock-changed',
  PACK_STATUS_CHANGED: 'school-pack:status-changed',
} as const;

export interface PackStockUpdatedEvent {
  packId: string;
  packSlug: string;
  allInStock: boolean;
  outOfStockItemsCount: number;
  items: {
    productId: string;
    productName: string;
    stockQuantity: number;
    isAvailable: boolean;
  }[];
  timestamp: string;
}

export interface ProductStockChangedEvent {
  productId: string;
  previousQuantity: number;
  newQuantity: number;
  timestamp: string;
}

