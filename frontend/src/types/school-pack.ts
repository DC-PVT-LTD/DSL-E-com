import { Product } from './product';

export type SchoolPackTier = 'essential' | 'standard' | 'premium';

export interface SchoolPackSubstitute {
  id?: string;
  productId?: string;
  name?: string;
  productName?: string;
  slug?: string;
  sku?: string;
  priceCents?: number;
  unitPriceCents?: number;
  stockQuantity?: number;
  isActive?: boolean;
  images?: string[];
}

export interface SchoolPackItem {
  id: string;
  productId: string;
  productName: string;
  defaultQuantity: number;
  unitPriceCents: number;
  lineTotalCents?: number;
  stockQuantity?: number;
  isAvailable?: boolean;
  product?: Product;
  substituteProductIds?: string[];
  substitutes?: SchoolPackSubstitute[];
}

export interface SchoolPack {
  id: string;
  name: string;
  slug: string;
  grade: string; // e.g. "Grade 1-2", "Grade 3-5", "Grade 6-9", "O/L (Grade 10-11)", "A/L Science", "A/L Commerce", "A/L Arts"
  tier: SchoolPackTier;
  description: string;
  bannerImage?: string;
  items: SchoolPackItem[];
  totalPriceCents: number;
  calculatedOriginalSubtotalCents?: number;
  calculatedSavingsCents?: number;
  calculatedTotalCents?: number;
  allInStock?: boolean;
  outOfStockItemsCount?: number;
  isActive: boolean;
  savingsPercentage: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SchoolPackConfig {
  gradeGroups: string[];
  tiers: string[];
}

export interface CalculateCustomizedResult {
  packId: string;
  packName: string;
  savingsPercentage: number;
  calculatedOriginalSubtotalCents: number;
  calculatedSavingsCents: number;
  calculatedTotalCents: number;
  allInStock: boolean;
  outOfStockCount: number;
  items: {
    productId: string;
    productName: string;
    variantId?: string | null;
    variantName?: string | null;
    quantity: number;
    unitPriceCents: number;
    lineSubtotalCents: number;
    stockQuantity: number;
    isAvailable: boolean;
    discountCents: number;
    discountedLineTotalCents: number;
    discountedUnitPriceCents: number;
  }[];
}
