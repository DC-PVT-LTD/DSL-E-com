import { Product } from './product';

export interface WishlistProductSummary {
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
  brandName?: string;
}

export interface WishlistItem {
  id: string;
  productId: string;
  createdAt: string;
  product: WishlistProductSummary;
}

export interface WishlistResponse {
  items: WishlistItem[];
  itemCount: number;
}

