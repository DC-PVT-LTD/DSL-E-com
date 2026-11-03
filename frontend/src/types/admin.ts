export type InventoryChangeReason =
  | 'RESTOCK'
  | 'CORRECTION'
  | 'DAMAGED'
  | 'ORDER_FULFILLMENT'
  | 'DEMO_RESET'
  | 'restock'
  | 'correction'
  | 'damaged'
  | 'order_fulfillment'
  | 'demo_reset';

export interface InventoryMovementRelation {
  id: string;
  name: string;
  sku: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  variantId?: string | null;
  productName?: string;
  sku?: string;
  previousQuantity: number;
  newQuantity: number;
  changeAmount: number;
  reason: InventoryChangeReason;
  note?: string | null;
  createdAt: string;
  timestamp?: string;
  performedById?: string | null;
  performedBy?: string;
  product?: InventoryMovementRelation;
  variant?: InventoryMovementRelation | null;
}

export interface AdjustStockInput {
  productId: string;
  variantId?: string | null;
  delta?: number;
  targetQuantity?: number;
  reason: 'RESTOCK' | 'CORRECTION' | 'DAMAGED' | 'ORDER_FULFILLMENT' | 'DEMO_RESET';
  note?: string | null;
}

export interface StockAdjustmentResponseData {
  movement: {
    id: string;
    productId: string;
    variantId: string | null;
    previousQuantity: number;
    newQuantity: number;
    changeAmount: number;
    reason: string;
    note: string | null;
    performedById: string | null;
    createdAt: string;
  };
  product: {
    id: string;
    name: string;
    sku: string;
    stockQuantity: number;
    lowStockThreshold: number;
  };
  variant: {
    id: string;
    name: string;
    sku: string;
    stockQuantity: number;
  } | null;
}

export interface InventoryMovementQueryOptions {
  page?: number;
  limit?: number;
  productId?: string;
  variantId?: string;
  reason?: 'RESTOCK' | 'CORRECTION' | 'DAMAGED' | 'ORDER_FULFILLMENT' | 'DEMO_RESET';
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'changeAmount' | 'newQuantity';
  sortOrder?: 'asc' | 'desc';
}

export interface LowStockQueryOptions {
  page?: number;
  limit?: number;
  threshold?: number;
  categoryId?: string;
  sortBy?: 'stockQuantity' | 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: 'product' | 'inventory' | 'order' | 'promotion' | 'pack' | 'category' | 'settings';
  entityId: string;
  description: string;
  user: string;
  timestamp: string;
}

export interface Promotion {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmountCents?: number;
  maxDiscountCents?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  usageCount: number;
}

export interface StoreBanner {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  badgeText?: string;
  backgroundColor: string;
  textColor: string;
  imageUrl?: string;
  isActive: boolean;
  displayOrder: number;
}

export interface AdminDashboardMetrics {
  totalRevenueCents: number;
  totalOrdersCount: number;
  pendingOrdersCount: number;
  lowStockItemsCount: number;
  totalCustomersCount: number;
  averageOrderValueCents: number;
}
