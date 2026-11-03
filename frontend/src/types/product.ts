export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconName?: string;
  image?: string;
  itemCount?: number;
  featured?: boolean;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  description: string;
  originCountry: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  compareAtPriceCents?: number;
  stockQuantity: number;
  attributes: Record<string, string>; // e.g. { color: "Blue", ruling: "Single Line" }
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  barcode?: string;
  description: string;
  shortDescription: string;
  categoryId: string;
  categoryName: string;
  brandId: string;
  brandName: string;
  priceCents: number;
  compareAtPriceCents?: number;
  costPriceCents?: number;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  images: string[];
  tags: string[];
  rating: number;
  reviewCount: number;
  variants?: ProductVariant[];
  specifications: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}
