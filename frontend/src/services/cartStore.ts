import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem, AppliedDiscount, CartSummary } from '@/types/cart';
import { Product, ProductVariant } from '@/types/product';
import {
  calculateDiscountCents,
  calculateDeliveryFeeCents,
  FREE_DELIVERY_THRESHOLD_CENTS,
} from '@/lib/currency';
import { INITIAL_PROMOTIONS } from '@/mocks/promotions';

interface CartState {
  items: CartItem[];
  appliedDiscount?: AppliedDiscount;
  isDrawerOpen: boolean;
  
  // Actions
  addItem: (product: Product, quantity?: number, variant?: ProductVariant) => boolean;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  applyPromoCode: (code: string) => { success: boolean; message: string };
  removePromoCode: () => void;
  setDrawerOpen: (open: boolean) => void;

  // Selectors
  getSummary: () => CartSummary;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      appliedDiscount: undefined,
      isDrawerOpen: false,

      setDrawerOpen: (open) => set({ isDrawerOpen: open }),

      addItem: (product, quantity = 1, variant) => {
        if (!product.isActive || product.stockQuantity <= 0) {
          return false;
        }

        const items = get().items;
        const itemId = variant ? `${product.id}-${variant.id}` : product.id;
        const existingIndex = items.findIndex((i) => i.id === itemId);

        const unitPriceCents = variant ? variant.priceCents : product.priceCents;
        const maxStock = variant ? variant.stockQuantity : product.stockQuantity;

        if (existingIndex > -1) {
          const currentQty = items[existingIndex].quantity;
          const newQty = Math.min(currentQty + quantity, maxStock);
          
          if (newQty === currentQty && quantity > 0) {
            // Already at max stock
            return false;
          }

          const updatedItems = [...items];
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            quantity: newQty,
            totalPriceCents: unitPriceCents * newQty,
          };
          set({ items: updatedItems });
        } else {
          const newQty = Math.min(quantity, maxStock);
          const newItem: CartItem = {
            id: itemId,
            productId: product.id,
            variantId: variant?.id,
            product,
            variant,
            quantity: newQty,
            unitPriceCents,
            totalPriceCents: unitPriceCents * newQty,
          };
          set({ items: [...items, newItem] });
        }

        return true;
      },

      updateQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(itemId);
          return;
        }

        const items = get().items;
        const item = items.find((i) => i.id === itemId);
        if (!item) return;

        const maxStock = item.variant ? item.variant.stockQuantity : item.product.stockQuantity;
        const finalQty = Math.min(quantity, maxStock);

        const updated = items.map((i) => {
          if (i.id === itemId) {
            return {
              ...i,
              quantity: finalQty,
              totalPriceCents: i.unitPriceCents * finalQty,
            };
          }
          return i;
        });

        set({ items: updated });
      },

      removeItem: (itemId) => {
        set({ items: get().items.filter((i) => i.id !== itemId) });
      },

      clearCart: () => {
        set({ items: [], appliedDiscount: undefined });
      },

      applyPromoCode: (code) => {
        const cleanCode = code.trim().toUpperCase();
        const promo = INITIAL_PROMOTIONS.find(
          (p) => p.code === cleanCode && p.isActive
        );

        if (!promo) {
          return { success: false, message: 'Invalid or expired promotional code.' };
        }

        const subtotal = get().items.reduce((acc, i) => acc + i.totalPriceCents, 0);

        if (promo.minOrderAmountCents && subtotal < promo.minOrderAmountCents) {
          return {
            success: false,
            message: `Minimum order of Rs. ${(promo.minOrderAmountCents / 100).toLocaleString()} required for this coupon.`,
          };
        }

        const discountAmountCents = calculateDiscountCents(
          subtotal,
          promo.discountType,
          promo.discountValue,
          promo.maxDiscountCents
        );

        const applied: AppliedDiscount = {
          code: promo.code,
          description: promo.description,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
          discountAmountCents,
        };

        set({ appliedDiscount: applied });
        return { success: true, message: `Promo code ${promo.code} applied successfully!` };
      },

      removePromoCode: () => {
        set({ appliedDiscount: undefined });
      },

      getSummary: () => {
        const { items, appliedDiscount } = get();
        const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);
        const subtotalCents = items.reduce((acc, i) => acc + i.totalPriceCents, 0);

        let discountCents = 0;
        if (appliedDiscount && subtotalCents > 0) {
          discountCents = calculateDiscountCents(
            subtotalCents,
            appliedDiscount.discountType,
            appliedDiscount.discountValue
          );
        }

        const deliveryCents = calculateDeliveryFeeCents(subtotalCents - discountCents);
        const totalCents = Math.max(0, subtotalCents - discountCents + deliveryCents);

        return {
          items,
          itemCount,
          subtotalCents,
          discountCents,
          deliveryCents,
          totalCents,
          appliedDiscount,
          isFreeDeliveryEligible: subtotalCents >= FREE_DELIVERY_THRESHOLD_CENTS,
          freeDeliveryThresholdCents: FREE_DELIVERY_THRESHOLD_CENTS,
        };
      },
    }),
    {
      name: 'dsl_cart_v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items, appliedDiscount: state.appliedDiscount }),
    }
  )
);
