export interface BuyAgainItemResult {
  orderItemId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string;
  images: string[];
  requestedQuantity: number;
  availableQuantity: number;
  currentPriceCents: number;
  historicalPriceCents: number;
  priceChanged: boolean;
  status: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
  reason:
  | 'AVAILABLE'
  | 'PRICE_CHANGED'
  | 'INSUFFICIENT_STOCK'
  | 'OUT_OF_STOCK'
  | 'DISCONTINUED'
  | 'PRODUCT_NOT_FOUND'
  | 'VARIANT_DISCONTINUED';
  bundleInfo?: {
    packId: string;
    packName: string;
    savingsPercentage: number;
  } | null;
  product?: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    priceCents: number;
    stockQuantity: number;
    isActive: boolean;
    images: string[];
    categoryId: string;
    brandId: string;
  } | null;
  variant?: {
    id: string;
    name: string;
    sku: string;
    priceCents: number;
    stockQuantity: number;
    isActive: boolean;
  } | null;
}

export interface BuyAgainResponse {
  success: boolean;
  orderId: string;
  orderNumber: string;
  items: BuyAgainItemResult[];
  summary: {
    totalRequestedItems: number;
    availableCount: number;
    partialCount: number;
    unavailableCount: number;
    totalAddedQuantity: number;
    estimatedTotalCents: number;
  };
}

