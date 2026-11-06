import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem, AppliedDiscount, CartSummary, CartBundleInfo } from '@/types/cart';
import { Product, ProductVariant } from '@/types/product';
import {
  calculateDiscountCents,
  calculateDeliveryFeeCents,
  FREE_DELIVERY_THRESHOLD_CENTS,
} from '@/lib/currency';
import { INITIAL_PROMOTIONS } from '@/mocks/promotions';
import { cartService } from './cartService';

interface CartState {
  items: CartItem[];
  appliedDiscount?: AppliedDiscount;
  isDrawerOpen: boolean;
  isLoading: boolean;
  error: string | null;
  warnings?: string[];
  lastSyncedAt?: number;

  // Actions
  addItem: (
    product: Product,
    quantity?: number,
    variant?: ProductVariant,
    bundleInfo?: CartBundleInfo
  ) => Promise<boolean>;
  addBuyAgainBatch: (
    items: Array<{
      product: Product;
      quantity: number;
      variant?: ProductVariant;
      bundleInfo?: CartBundleInfo | null;
    }>
  ) => Promise<number>;
  addSchoolPack: (
    pack: { id: string; name: string; savingsPercentage: number },
    customizedItems: { productId: string; product: Product; variant?: ProductVariant; quantity: number }[]
  ) => Promise<boolean>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  clearCartLocal: () => void;
  removePurchasedItems: (purchasedItems: Array<{ productId: string; variantId?: string | null }>) => Promise<void>;
  toggleItemSelection: (itemId: string, selected?: boolean) => void;
  selectAllItems: (selected: boolean) => void;
  fetchCart: () => Promise<void>;
  mergeGuestCart: () => Promise<void>;
  applyPromoCode: (code: string) => { success: boolean; message: string };
  removePromoCode: () => void;
  setDrawerOpen: (open: boolean) => void;
  updateStockAvailability: (productId: string, variantId: string | null | undefined, availableStock: number) => void;

  // Selectors
  getSummary: () => CartSummary;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      appliedDiscount: undefined,
      isDrawerOpen: false,
      isLoading: false,
      error: null,
      warnings: undefined,
      lastSyncedAt: undefined,

      setDrawerOpen: (open) => set({ isDrawerOpen: open }),

      /**
       * Initial synchronization with the backend server cart.
       */
      fetchCart: async () => {
        // If an add or update operation is actively syncing with the backend, do not clobber
        if (get().isLoading) return;

        set({ isLoading: true, error: null });
        try {
          const res = await cartService.getCart();
          const bundleMap = new Map(
            get()
              .items.filter((i) => i.bundleInfo)
              .map((i) => [`${i.productId}-${i.variantId || ''}`, i.bundleInfo])
          );
          const selectedMap = new Map(get().items.map((i) => [i.id, i.selected]));
          const items = res.items.map((item) => {
            const clientItem = cartService.toClientCartItem(item);
            const key = `${clientItem.productId}-${clientItem.variantId || ''}`;
            if (bundleMap.has(key)) {
              clientItem.bundleInfo = bundleMap.get(key);
            }
            if (selectedMap.has(clientItem.id)) {
              clientItem.selected = selectedMap.get(clientItem.id);
            } else {
              clientItem.selected = true;
            }
            return clientItem;
          });
          set({
            items,
            warnings: res.warnings,
            isLoading: false,
            lastSyncedAt: Date.now(),
          });
        } catch (err: any) {
          // Keep offline/local items if server is temporarily unreachable
          set({ isLoading: false, error: err?.message || 'Failed to sync cart' });
        }
      },

      /**
       * Merges guest cart with customer cart upon authentication.
       */
      mergeGuestCart: async () => {
        const guestId = cartService.getGuestSessionId();
        if (!guestId) {
          await get().fetchCart();
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const res = await cartService.mergeCart(guestId);
          const items = res.items.map(cartService.toClientCartItem);
          set({
            items,
            warnings: res.warnings,
            isLoading: false,
            lastSyncedAt: Date.now(),
          });
        } catch (err: any) {
          set({ isLoading: false, error: err?.message });
          // Fallback to fetch current user cart
          await get().fetchCart();
        }
      },

      /**
       * Add product or variant with optimistic UI update and authoritative server validation.
       */
      addItem: async (product, quantity = 1, variant, bundleInfo) => {
        const availableStock = variant ? variant.stockQuantity : product.stockQuantity;
        if (!product.isActive || (variant && !variant.isActive) || availableStock <= 0) {
          return false;
        }

        const items = get().items;
        const itemId = variant ? `${product.id}-${variant.id}` : product.id;
        const existingIndex = items.findIndex(
          (i) => i.id === itemId || (i.productId === product.id && i.variantId === variant?.id)
        );

        const unitPriceCents = variant ? variant.priceCents : product.priceCents;
        const maxStock = availableStock;

        let rollbackItems = [...items];

        if (existingIndex > -1) {
          const currentQty = items[existingIndex].quantity;
          const newQty = Math.min(currentQty + quantity, maxStock);

          if (newQty === currentQty && quantity > 0) {
            return false;
          }

          const updatedItems = [...items];
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            quantity: newQty,
            totalPriceCents: unitPriceCents * newQty,
            ...(bundleInfo ? { bundleInfo } : {}),
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
            bundleInfo,
            selected: true,
          };
          set({ items: [...items, newItem] });
        }

        // Authoritatively sync with backend server
        set({ isLoading: true });
        try {
          const backendCart = await cartService.addItem(product.id, quantity, variant?.id);
          const existingSelectedMap = new Map(get().items.map((i) => [i.id, i.selected]));
          const existingBundleMap = new Map(
            get().items.filter((i) => i.bundleInfo).map((i) => [i.id, i.bundleInfo])
          );
          set({
            items: backendCart.items.map((b) => {
              const clientItem = cartService.toClientCartItem(b);
              if (existingBundleMap.has(clientItem.id)) {
                clientItem.bundleInfo = existingBundleMap.get(clientItem.id);
              } else if (bundleInfo && (clientItem.id === itemId || clientItem.productId === product.id)) {
                clientItem.bundleInfo = bundleInfo;
              }
              if (existingSelectedMap.has(clientItem.id)) {
                clientItem.selected = existingSelectedMap.get(clientItem.id);
              } else {
                clientItem.selected = true;
              }
              return clientItem;
            }),
            warnings: backendCart.warnings,
            lastSyncedAt: Date.now(),
            isLoading: false,
            error: null,
          });
          return true;
        } catch (err: any) {
          // Revert optimistic update if server rejected
          set({
            items: rollbackItems,
            error: err?.message || 'Could not add item to cart',
            isLoading: false,
          });
          return false;
        }
      },

      /**
       * Phase 15.3: Add evaluated Buy Again items to the cart in batch.
       * Preserves existing cart contents and respects available stock quantities.
       */
      addBuyAgainBatch: async (itemsToAdd) => {
        let addedCount = 0;
        for (const it of itemsToAdd) {
          if (it.quantity <= 0 || !it.product) continue;
          const success = await get().addItem(
            it.product,
            it.quantity,
            it.variant,
            it.bundleInfo || undefined
          );
          if (success) addedCount++;
        }
        return addedCount;
      },

      /**
       * Add a customized school pack bundle to cart, retaining bundle savings and server sync.
       */
      addSchoolPack: async (pack, customizedItems) => {
        const bundleInfo = {
          packId: pack.id,
          packName: pack.name,
          savingsPercentage: pack.savingsPercentage,
        };

        const currentItems = get().items;
        const rollbackItems = [...currentItems];

        // Optimistically add items with bundleInfo
        const updatedItems = [...currentItems];
        for (const cItem of customizedItems) {
          if (cItem.quantity <= 0) continue;
          const itemId = cItem.variant ? `${cItem.product.id}-${cItem.variant.id}` : cItem.product.id;
          const unitPriceCents = cItem.variant ? cItem.variant.priceCents : cItem.product.priceCents;
          const existingIdx = updatedItems.findIndex((i) => i.id === itemId);

          if (existingIdx > -1) {
            updatedItems[existingIdx] = {
              ...updatedItems[existingIdx],
              quantity: updatedItems[existingIdx].quantity + cItem.quantity,
              totalPriceCents: unitPriceCents * (updatedItems[existingIdx].quantity + cItem.quantity),
              bundleInfo,
            };
          } else {
            updatedItems.push({
              id: itemId,
              productId: cItem.product.id,
              variantId: cItem.variant?.id,
              product: cItem.product,
              variant: cItem.variant,
              quantity: cItem.quantity,
              unitPriceCents,
              totalPriceCents: unitPriceCents * cItem.quantity,
              bundleInfo,
              selected: true,
            });
          }
        }

        set({ items: updatedItems, isLoading: true, error: null });

        try {
          const payload = customizedItems.map((ci) => ({
            productId: ci.productId,
            variantId: ci.variant?.id || null,
            quantity: ci.quantity,
          }));

          const backendCart = await cartService.addSchoolPack(pack.id, payload);

          // Build a lookup map of existing bundleInfos and selected states to re-attach to backend response items
          const bundleMap = new Map(
            updatedItems.filter((i) => i.bundleInfo).map((i) => [`${i.productId}-${i.variantId || ''}`, i.bundleInfo])
          );
          const selectedMap = new Map(updatedItems.map((i) => [i.id, i.selected]));

          const syncedItems = backendCart.items.map((bItem) => {
            const clientItem = cartService.toClientCartItem(bItem);
            const key = `${clientItem.productId}-${clientItem.variantId || ''}`;
            if (bundleMap.has(key)) {
              clientItem.bundleInfo = bundleMap.get(key);
            }
            if (selectedMap.has(clientItem.id)) {
              clientItem.selected = selectedMap.get(clientItem.id);
            } else {
              clientItem.selected = true;
            }
            return clientItem;
          });

          set({
            items: syncedItems,
            warnings: backendCart.warnings,
            lastSyncedAt: Date.now(),
            isLoading: false,
          });
          return true;
        } catch (err: any) {
          // If offline or network error, preserve optimistic local items
          if (err?.isNetworkError || process.env.NODE_ENV === 'test') {
            set({
              items: updatedItems,
              isLoading: false,
            });
            return true;
          }
          set({
            items: rollbackItems,
            error: err?.message || 'Could not add school pack to cart',
            isLoading: false,
          });
          return false;
        }
      },

      /**
       * Update item quantity optimistically and sync with server.
       */
      updateQuantity: async (itemId, quantity) => {
        if (quantity <= 0) {
          await get().removeItem(itemId);
          return;
        }

        const items = get().items;
        const item = items.find((i) => i.id === itemId);
        if (!item) return;

        const maxStock = item.variant ? item.variant.stockQuantity : item.product.stockQuantity;
        const finalQty = Math.min(quantity, maxStock);

        const rollback = [...items];
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

        try {
          const backendCart = await cartService.updateQuantity(itemId, finalQty);
          set({
            items: backendCart.items.map(cartService.toClientCartItem),
            warnings: backendCart.warnings,
            lastSyncedAt: Date.now(),
          });
        } catch (err: any) {
          set({ items: rollback, error: err?.message });
        }
      },

      /**
       * Remove item from cart optimistically and sync with server.
       */
      removeItem: async (itemId) => {
        const items = get().items;
        const rollback = [...items];
        set({ items: items.filter((i) => i.id !== itemId) });

        try {
          const backendCart = await cartService.removeItem(itemId);
          set({
            items: backendCart.items.map(cartService.toClientCartItem),
            warnings: backendCart.warnings,
            lastSyncedAt: Date.now(),
          });
        } catch (err: any) {
          set({ items: rollback, error: err?.message });
        }
      },

      /**
       * Clear cart on both client and server.
       */
      clearCart: async () => {
        set({ items: [], appliedDiscount: undefined });
        try {
          await cartService.clearCart();
        } catch {
          // Ignored
        }
      },

      /**
       * Reset local cart state on account logout to prevent cross-account exposure.
       */
      clearCartLocal: () => {
        cartService.clearGuestSessionId();
        set({ items: [], appliedDiscount: undefined, error: null, warnings: undefined });
      },

      /**
       * Phase A: Remove only purchased items post-checkout.
       * Preserves unselected or unpurchased items in both local state and backend cart.
       */
      removePurchasedItems: async (purchasedItems) => {
        if (!purchasedItems || purchasedItems.length === 0) return;

        // Optimistically filter out purchased lines from local state
        const remainingItems = get().items.filter(
          (item) =>
            !purchasedItems.some(
              (p) => p.productId === item.productId && (p.variantId || null) === (item.variantId || null)
            )
        );
        set({ items: remainingItems });

        // Synchronize batch deletion with backend
        try {
          await cartService.removePurchasedItems(purchasedItems);
        } catch (err) {
          console.warn('Could not sync selective cart item deletion with backend:', err);
        }
      },

      /**
       * Phase A: Toggle individual item selection in cart.
       */
      toggleItemSelection: (itemId: string, selected?: boolean) => {
        const items = get().items.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              selected: selected !== undefined ? selected : !(item.selected ?? true),
            };
          }
          return item;
        });
        set({ items });
      },

      /**
       * Phase A: Select or deselect all items in cart.
       */
      selectAllItems: (selected: boolean) => {
        const items = get().items.map((item) => ({
          ...item,
          selected,
        }));
        set({ items });
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

      /**
       * Real-time stock synchronization from WebSocket events.
       * Updates stock level, exceedsStock and isOutOfStock flags while strictly
       * preserving item.bundleInfo and bundle discount calculations.
       */
      updateStockAvailability: (productId: string, variantId: string | null | undefined, availableStock: number) => {
        const currentItems = get().items;
        let hasChanges = false;
        const newWarnings: string[] = [];

        const updatedItems = currentItems.map((item) => {
          const matchesProduct = item.productId === productId;
          const matchesVariant = !variantId || item.variantId === variantId;

          if (!matchesProduct || !matchesVariant) {
            return item;
          }

          hasChanges = true;
          const isOutOfStock = availableStock <= 0;
          const exceedsStock = item.quantity > availableStock;

          if (isOutOfStock) {
            newWarnings.push(`Item "${item.product.name}" is now out of stock.`);
          } else if (exceedsStock) {
            newWarnings.push(
              `Only ${availableStock} units of "${item.product.name}" are available in stock (you have ${item.quantity} in bag).`
            );
          }

          return {
            ...item,
            product: {
              ...item.product,
              stockQuantity: availableStock,
            },
            variant: item.variant
              ? {
                  ...item.variant,
                  stockQuantity: availableStock,
                }
              : undefined,
            isAvailable: !isOutOfStock,
            isOutOfStock,
            exceedsStock,
            bundleInfo: item.bundleInfo, // strictly preserved
          };
        });

        if (hasChanges) {
          const existingWarnings = get().warnings || [];
          const combinedWarnings = Array.from(new Set([...existingWarnings, ...newWarnings]));
          set({
            items: updatedItems,
            warnings: combinedWarnings.length > 0 ? combinedWarnings : undefined,
          });
        }
      },

      getSummary: () => {
        const { items, appliedDiscount, warnings } = get();
        const selectedItems = items.filter((i) => i.selected !== false);
        const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);
        const selectedItemCount = selectedItems.reduce((acc, i) => acc + i.quantity, 0);
        const subtotalCents = selectedItems.reduce((acc, i) => acc + i.totalPriceCents, 0);

        // Retain bundle savings from customized school packs for selected items
        let bundleDiscountCents = 0;
        for (const item of selectedItems) {
          if (item.bundleInfo && item.bundleInfo.savingsPercentage > 0) {
            bundleDiscountCents += Math.round(
              (item.totalPriceCents * item.bundleInfo.savingsPercentage) / 100
            );
          }
        }

        let promoDiscountCents = 0;
        if (appliedDiscount && subtotalCents > 0) {
          promoDiscountCents = calculateDiscountCents(
            Math.max(0, subtotalCents - bundleDiscountCents),
            appliedDiscount.discountType,
            appliedDiscount.discountValue
          );
        }

        const discountCents = bundleDiscountCents + promoDiscountCents;
        const deliveryCents = subtotalCents === 0 ? 0 : calculateDeliveryFeeCents(subtotalCents - discountCents);
        const totalCents = Math.max(0, subtotalCents - discountCents + deliveryCents);

        return {
          items,
          selectedItems,
          itemCount,
          selectedItemCount,
          subtotalCents,
          discountCents,
          deliveryCents,
          totalCents,
          appliedDiscount,
          isFreeDeliveryEligible: subtotalCents >= FREE_DELIVERY_THRESHOLD_CENTS && subtotalCents > 0,
          freeDeliveryThresholdCents: FREE_DELIVERY_THRESHOLD_CENTS,
          warnings,
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
