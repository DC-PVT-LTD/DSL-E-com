import { Product, ProductVariant } from './product';

export interface CartBundleInfo {
  packId: string;
  packName: string;
  savingsPercentage: number;
}

export interface CartItem {
  id: string; // unique item id in cart (product.id or product.id + variant.id)
  productId: string;
  variantId?: string;
  variantName?: string;
  product: Product;
  variant?: ProductVariant;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  isAvailable?: boolean;
  isOutOfStock?: boolean;
  exceedsStock?: boolean;
  bundleInfo?: CartBundleInfo;
  selected?: boolean; // Phase A: Item selection for selective checkout (default: true)
}

export interface AppliedDiscount {
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed' | 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_DELIVERY';
  discountValue: number;
  discountAmountCents: number;
  promotionId?: string;
  promotionName?: string;
  isFreeDelivery?: boolean;
  isStackableWithSchoolPacks?: boolean;
}

export interface CartSummary {
  items: CartItem[]; // All items in bag
  selectedItems: CartItem[]; // Only selected items for checkout
  itemCount: number; // Total item quantity in bag
  selectedItemCount: number; // Selected item quantity for checkout
  subtotalCents: number; // Calculated across selected items
  discountCents: number; // Calculated across selected items
  bundleDiscountCents?: number; // Specific bundle / school pack savings
  voucherDiscountCents?: number; // Specific promo voucher savings
  deliveryCents: number; // Calculated across selected items
  totalCents: number; // Calculated across selected items
  appliedDiscount?: AppliedDiscount;
  isFreeDeliveryEligible: boolean;
  freeDeliveryThresholdCents: number;
  warnings?: string[];
}
