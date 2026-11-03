export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  previousQuantity: number;
  newQuantity: number;
  changeAmount: number;
  reason: 'restock' | 'correction' | 'damaged' | 'order_fulfillment' | 'demo_reset';
  note?: string;
  timestamp: string;
  performedBy: string;
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
