import { Product, ProductVariant } from './product';

export interface CartItem {
  id: string; // unique item id in cart (product.id or product.id + variant.id)
  productId: string;
  variantId?: string;
  product: Product;
  variant?: ProductVariant;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface AppliedDiscount {
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmountCents: number;
}

export interface CartSummary {
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  discountCents: number;
  deliveryCents: number;
  totalCents: number;
  appliedDiscount?: AppliedDiscount;
  isFreeDeliveryEligible: boolean;
  freeDeliveryThresholdCents: number;
}
