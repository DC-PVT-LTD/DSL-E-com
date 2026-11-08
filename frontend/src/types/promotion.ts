export type PromotionType =
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'FREE_DELIVERY'
  | 'PRODUCT_SPECIFIC'
  | 'CATEGORY_SPECIFIC'
  | 'ORDER_LEVEL';

export type PromotionStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'DISABLED';

export type DiscountType =
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'FREE_DELIVERY';

export interface PromotionCode {
  id: string;
  promotionId: string;
  code: string;
  isActive: boolean;
  maximumTotalUsage: number | null;
  maximumUsagePerCustomer: number | null;
  totalUsage: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    redemptions: number;
  };
}

export interface PromotionProduct {
  productId: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    priceCents?: number;
  };
}

export interface PromotionCategory {
  categoryId: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface Promotion {
  id: string;
  name: string;
  title?: string | null;
  code?: string | null;
  description?: string | null;
  promotionType: PromotionType;
  discountType: DiscountType;
  discountValue: number;
  maximumDiscountAmount: number | null;
  maxDiscountCents?: number | null;
  minimumOrderAmount: number | null;
  minOrderAmountCents?: number | null;
  status: PromotionStatus;
  effectiveStatus: PromotionStatus;
  startDate: string;
  endDate: string;
  priority: number;
  isStackableWithSchoolPacks: boolean;
  isActive: boolean;
  usageLimit: number | null;
  usageCount: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  codes: PromotionCode[];
  eligibleProducts?: PromotionProduct[];
  eligibleCategories?: PromotionCategory[];
  _count?: {
    redemptions: number;
    orders: number;
  };
}

export interface PromotionRedemption {
  id: string;
  promotionId: string;
  promotionCodeId?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  orderId?: string | null;
  discountAmount: number;
  redeemedAt: string;
  customer?: {
    id: string;
    name: string;
    email: string;
  } | null;
  promotionCode?: {
    id: string;
    code: string;
  } | null;
  order?: {
    id: string;
    orderNumber: string;
    totalCents: number;
    discountCents: number;
    orderStatus: string;
    createdAt: string;
  } | null;
}

export interface PromotionReportingSummary {
  totalPromotions: number;
  activePromotions: number;
  expiredPromotions: number;
  scheduledPromotions: number;
  disabledPromotions: number;
  draftPromotions: number;
  totalRedemptions: number;
  totalDiscountValueCents: number;
}

export interface PromotionValidationResult {
  valid: boolean;
  code: string;
  promotionId: string;
  promotionCodeId?: string | null;
  promotionName: string;
  promotionType: PromotionType;
  discountType: DiscountType;
  discountValue: number;
  discountAmountCents: number;
  isFreeDelivery: boolean;
  isStackableWithSchoolPacks: boolean;
  eligibleBaseCents: number;
  bundleDiscountCents: number;
  message: string;
}

export interface CreatePromotionPayload {
  name: string;
  description?: string | null;
  promotionType: PromotionType;
  discountType?: DiscountType;
  discountValue: number;
  maximumDiscountAmount?: number | null;
  minimumOrderAmount?: number | null;
  status?: PromotionStatus;
  startDate: string;
  endDate: string;
  priority?: number;
  isStackableWithSchoolPacks?: boolean;
  isActive?: boolean;
  code?: string | null;
  promoCodes?: Array<{
    code: string;
    maximumTotalUsage?: number | null;
    maximumUsagePerCustomer?: number | null;
    isActive?: boolean;
  }>;
  eligibleProductIds?: string[];
  eligibleCategoryIds?: string[];
}

export interface UpdatePromotionPayload extends Partial<CreatePromotionPayload> {}

