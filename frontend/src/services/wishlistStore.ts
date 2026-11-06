import { create } from 'zustand';
import { WishlistItem, WishlistProductSummary } from '@/types/wishlist';
import { Product } from '@/types/product';
import { wishlistService } from './wishlistService';
import { useUserStore } from './userStore';

interface WishlistState {
  items: WishlistItem[];
  savedProductIds: string[];
  itemCount: number;
  isLoading: boolean;
  error: string | null;

  fetchWishlist: () => Promise<void>;
  toggleWishlist: (product: Product | WishlistProductSummary) => Promise<{ inWishlist: boolean; requiresAuth?: boolean }>;
  removeItem: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  clearWishlistLocal: () => void;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],
  savedProductIds: [],
  itemCount: 0,
  isLoading: false,
  error: null,

  fetchWishlist: async () => {
    const currentUser = useUserStore.getState().currentUser;
    if (!currentUser) {
      set({ items: [], savedProductIds: [], itemCount: 0, isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const data = await wishlistService.getWishlist();
      const items = data.items || [];
      const savedProductIds = items.map((i) => i.productId);
      set({
        items,
        savedProductIds,
        itemCount: items.length,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      // 401 is normal if session expired
      set({
        isLoading: false,
        error: err?.status === 401 ? null : err?.message || 'Could not load wishlist',
      });
    }
  },

  toggleWishlist: async (product) => {
    const currentUser = useUserStore.getState().currentUser;
    if (!currentUser) {
      return { inWishlist: false, requiresAuth: true };
    }

    const { items, savedProductIds, itemCount } = get();
    const isCurrentlySaved = savedProductIds.includes(product.id);

    // Rollback snapshot
    const prevItems = [...items];
    const prevIds = [...savedProductIds];
    const prevCount = itemCount;

    if (isCurrentlySaved) {
      // Optimistic remove
      const updatedItems = items.filter((i) => i.productId !== product.id);
      const updatedIds = savedProductIds.filter((id) => id !== product.id);
      set({
        items: updatedItems,
        savedProductIds: updatedIds,
        itemCount: Math.max(0, itemCount - 1),
        error: null,
      });

      try {
        await wishlistService.removeItem(product.id);
        return { inWishlist: false };
      } catch (err: any) {
        // Rollback
        set({
          items: prevItems,
          savedProductIds: prevIds,
          itemCount: prevCount,
          error: err?.message || 'Failed to remove from wishlist',
        });
        return { inWishlist: true };
      }
    } else {
      // Optimistic add
      const optimisticItem: WishlistItem = {
        id: `optimistic-${product.id}`,
        productId: product.id,
        createdAt: new Date().toISOString(),
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          priceCents: product.priceCents,
          compareAtPriceCents: product.compareAtPriceCents,
          stockQuantity: product.stockQuantity,
          isActive: product.isActive,
          images: product.images || [],
          categoryName: (product as any).categoryName || (product as any).category?.name,
          brandName: (product as any).brandName || (product as any).brand?.name,
        },
      };

      set({
        items: [optimisticItem, ...items],
        savedProductIds: [...savedProductIds, product.id],
        itemCount: itemCount + 1,
        error: null,
      });

      try {
        const savedItem = await wishlistService.addItem(product.id);
        // Replace optimistic with authoritative backend item
        set((state) => ({
          items: state.items.map((i) => (i.productId === product.id ? savedItem : i)),
        }));
        return { inWishlist: true };
      } catch (err: any) {
        // Rollback
        set({
          items: prevItems,
          savedProductIds: prevIds,
          itemCount: prevCount,
          error: err?.message || 'Failed to add to wishlist',
        });
        return { inWishlist: false };
      }
    }
  },

  removeItem: async (productId: string) => {
    const { items, savedProductIds, itemCount } = get();
    const prevItems = [...items];
    const prevIds = [...savedProductIds];
    const prevCount = itemCount;

    set({
      items: items.filter((i) => i.productId !== productId),
      savedProductIds: savedProductIds.filter((id) => id !== productId),
      itemCount: Math.max(0, itemCount - 1),
    });

    try {
      await wishlistService.removeItem(productId);
    } catch (err: any) {
      set({
        items: prevItems,
        savedProductIds: prevIds,
        itemCount: prevCount,
        error: err?.message || 'Failed to remove item',
      });
    }
  },

  isInWishlist: (productId: string) => {
    return get().savedProductIds.includes(productId);
  },

  clearWishlistLocal: () => {
    set({ items: [], savedProductIds: [], itemCount: 0, isLoading: false, error: null });
  },
}));

