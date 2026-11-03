import { Product } from './product';

export type SchoolPackTier = 'essential' | 'standard' | 'premium';

export interface SchoolPackItem {
  id: string;
  productId: string;
  productName: string;
  defaultQuantity: number;
  unitPriceCents: number;
  substitutes?: {
    productId: string;
    productName: string;
    unitPriceCents: number;
  }[];
}

export interface SchoolPack {
  id: string;
  name: string;
  slug: string;
  grade: string; // e.g. "Grade 1-2", "Grade 3-5", "Grade 6-9", "O/L (Grade 10-11)", "A/L Science", "A/L Commerce"
  tier: SchoolPackTier;
  description: string;
  bannerImage?: string;
  items: SchoolPackItem[];
  totalPriceCents: number;
  isActive: boolean;
  savingsPercentage: number;
}
