export type StationeryPurpose = 'school' | 'university' | 'office' | 'art_craft' | 'gift';

export interface RecommendationSubstitute {
  id: string;
  name: string;
  slug: string;
  sku: string;
  priceCents: number;
  stockQuantity: number;
}

export interface RecommendedProductItem {
  productId: string;
  productName: string;
  productSlug: string;
  sku: string;
  categoryId: string;
  categoryName: string;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
  stockQuantity: number;
  lowStock: boolean;
  reason: string;
  priority: number;
  selected?: boolean;
  substitutes: RecommendationSubstitute[];
}

export interface RecommendationResponse {
  purpose: StationeryPurpose;
  criteriaSummary: Record<string, any>;
  totalEstimatedCents: number;
  itemCount: number;
  budgetLkr?: number;
  budgetCents?: number;
  isWithinBudget: boolean;
  items: RecommendedProductItem[];
}

export interface RecommendationCriteria {
  purpose: StationeryPurpose;
  grade?: string;
  subjects?: string[];
  studyArea?: string;
  officeScale?: string;
  categories?: string[];
  activityType?: string;
  skillLevel?: string;
  occasion?: string;
  budgetLkr?: number;
}

export interface BasketValidationItem {
  productId: string;
  quantity: number;
  submittedPriceCents?: number;
}

export interface BasketValidationResult {
  isValid: boolean;
  totalCents: number;
  itemCount: number;
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    priceCents: number;
    quantity: number;
    subtotalCents: number;
    stockQuantity: number;
    isAvailable: boolean;
    priceChanged: boolean;
    submittedPriceCents?: number;
    warning?: string;
  }>;
  warnings: string[];
}

export interface RecommendationRule {
  id: string;
  purpose: StationeryPurpose;
  name: string;
  description?: string;
  gradeLevels?: string[];
  subjects?: string[];
  studyAreas?: string[];
  officeScale?: string;
  activityTypes?: string[];
  skillLevels?: string[];
  occasions?: string[];
  productId: string;
  categoryId?: string;
  defaultQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  priority: number;
  reason: string;
  isActive: boolean;
  substituteProductIds?: string[];
}

export interface RecommendationConfig {
  purposes: Array<{ id: StationeryPurpose; name: string; description: string }>;
  schoolGrades: string[];
  subjects: string[];
  studyAreas: string[];
  officeScales: Array<{ id: string; label: string }>;
  artActivities: string[];
  giftOccasions: string[];
}

