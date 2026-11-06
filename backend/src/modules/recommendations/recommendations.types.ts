export type StationeryPurpose = 'school' | 'university' | 'office' | 'art_craft' | 'gift';

export interface RecommendationRule {
  id: string;
  purpose: StationeryPurpose;
  name: string;
  description?: string;
  gradeLevels?: string[];     // for 'school'
  subjects?: string[];        // e.g. 'Mathematics', 'Science', 'Art'
  studyAreas?: string[];      // for 'university'
  officeScale?: string;       // for 'office' (e.g. 'individual', 'team', 'department')
  activityTypes?: string[];   // for 'art_craft' (e.g. 'fabric_painting', 'sketching', 'modelling')
  skillLevels?: string[];     // e.g. 'beginner', 'intermediate', 'advanced'
  occasions?: string[];       // for 'gift'
  productId: string;          // Real PostgreSQL product ID
  categoryId?: string;        // Product category
  defaultQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  priority: number;           // 1 = highest priority
  reason: string;             // Customer-facing explanation
  isActive: boolean;
  substituteProductIds?: string[]; // Allowed substitute product IDs from catalogue
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
  substitutes: Array<{
    id: string;
    name: string;
    slug: string;
    sku: string;
    priceCents: number;
    stockQuantity: number;
  }>;
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

export interface BasketValidationItem {
  productId: string;
  quantity: number;
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

