export type BackInStockAlertStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'CANCELLED';

export interface BackInStockProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  priceCents: number;
  compareAtPriceCents?: number | null;
  stockQuantity: number;
  isActive: boolean;
  images: string[];
  categoryName?: string;
}

export interface BackInStockAlert {
  id: string;
  userId: string;
  productId: string;
  status: BackInStockAlertStatus;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  isAlreadySubscribed?: boolean;
  message?: string;
  product?: BackInStockProduct;
}

export interface BackInStockStatusResponse {
  isSubscribed: boolean;
  alertId?: string;
}

