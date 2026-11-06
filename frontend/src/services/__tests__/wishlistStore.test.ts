import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWishlistStore } from '../wishlistStore';
import { wishlistService } from '../wishlistService';
import { useUserStore } from '../userStore';
import { useCartStore } from '../cartStore';
import { INITIAL_PRODUCTS } from '@/mocks/products';

describe('useWishlistStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useWishlistStore.getState().clearWishlistLocal();
    useUserStore.setState({
      currentUser: {
        id: 'cust-test-1',
        name: 'Test Customer',
        email: 'customer@dslstationery.lk',
        phone: '0771234567',
        role: 'CUSTOMER',
        addresses: [],
        wishlistProductIds: [],
        savedLists: [],
      },
    });
  });

  describe('fetchWishlist', () => {
    it('loads customer wishlist from authoritative backend service', async () => {
      const mockBackendResponse = {
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            createdAt: '2026-11-05T00:00:00Z',
            product: {
              id: 'prod-1',
              name: 'SPEED RIM Ball Pen 0.7mm',
              slug: 'speed-rim-ball-pen',
              sku: 'DSL-PEN-01',
              priceCents: 3500,
              stockQuantity: 100,
              isActive: true,
              images: ['/pen.png'],
              categoryName: 'Pens',
              brandName: 'Speed',
            },
          },
        ],
        itemCount: 1,
      };

      vi.spyOn(wishlistService, 'getWishlist').mockResolvedValue(mockBackendResponse);

      await useWishlistStore.getState().fetchWishlist();

      expect(useWishlistStore.getState().itemCount).toBe(1);
      expect(useWishlistStore.getState().items.length).toBe(1);
      expect(useWishlistStore.getState().isInWishlist('prod-1')).toBe(true);
      expect(useWishlistStore.getState().isInWishlist('prod-unrelated')).toBe(false);
    });

    it('resets local wishlist state if customer is not authenticated', async () => {
      useUserStore.setState({ currentUser: null });

      await useWishlistStore.getState().fetchWishlist();

      expect(useWishlistStore.getState().itemCount).toBe(0);
      expect(useWishlistStore.getState().items).toEqual([]);
      expect(useWishlistStore.getState().savedProductIds).toEqual([]);
    });
  });

  describe('toggleWishlist & heart state updates', () => {
    it('prompts sign-in and rejects saving if customer is unauthenticated', async () => {
      useUserStore.setState({ currentUser: null });
      const product = INITIAL_PRODUCTS[0];

      const result = await useWishlistStore.getState().toggleWishlist(product);

      expect(result.requiresAuth).toBe(true);
      expect(result.inWishlist).toBe(false);
      expect(useWishlistStore.getState().itemCount).toBe(0);
    });

    it('optimistically adds product and synchronizes with backend', async () => {
      const product = INITIAL_PRODUCTS[0];
      const spyAdd = vi.spyOn(wishlistService, 'addItem').mockResolvedValue({
        id: 'w-backend-1',
        productId: product.id,
        createdAt: new Date().toISOString(),
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          priceCents: product.priceCents,
          stockQuantity: product.stockQuantity,
          isActive: true,
          images: [],
        },
      });

      const result = await useWishlistStore.getState().toggleWishlist(product);

      expect(spyAdd).toHaveBeenCalledWith(product.id);
      expect(result.inWishlist).toBe(true);
      expect(useWishlistStore.getState().isInWishlist(product.id)).toBe(true);
      expect(useWishlistStore.getState().itemCount).toBe(1);
    });

    it('rolls back optimistic state if backend add fails', async () => {
      const product = INITIAL_PRODUCTS[0];
      vi.spyOn(wishlistService, 'addItem').mockRejectedValue(new Error('Network error'));

      const result = await useWishlistStore.getState().toggleWishlist(product);

      expect(result.inWishlist).toBe(false);
      expect(useWishlistStore.getState().isInWishlist(product.id)).toBe(false);
      expect(useWishlistStore.getState().itemCount).toBe(0);
      expect(useWishlistStore.getState().error).toBe('Network error');
    });

    it('optimistically removes product when already in wishlist', async () => {
      const product = INITIAL_PRODUCTS[0];
      useWishlistStore.setState({
        items: [
          {
            id: 'item-1',
            productId: product.id,
            createdAt: new Date().toISOString(),
            product: { ...product, images: [] },
          },
        ],
        savedProductIds: [product.id],
        itemCount: 1,
      });

      const spyRemove = vi.spyOn(wishlistService, 'removeItem').mockResolvedValue({
        success: true,
        productId: product.id,
      });

      const result = await useWishlistStore.getState().toggleWishlist(product);

      expect(spyRemove).toHaveBeenCalledWith(product.id);
      expect(result.inWishlist).toBe(false);
      expect(useWishlistStore.getState().isInWishlist(product.id)).toBe(false);
      expect(useWishlistStore.getState().itemCount).toBe(0);
    });
  });

  describe('cart integration', () => {
    it('adding a wishlist item to cart adds it without removing from wishlist', async () => {
      const product = INITIAL_PRODUCTS[0];
      useWishlistStore.setState({
        items: [
          {
            id: 'item-1',
            productId: product.id,
            createdAt: new Date().toISOString(),
            product: { ...product, images: [] },
          },
        ],
        savedProductIds: [product.id],
        itemCount: 1,
      });

      useCartStore.getState().clearCartLocal();

      // Simulate customer clicking "Add to Cart" on the wishlist page
      await useCartStore.getState().addItem(product, 1);

      // Verify item exists in cart
      expect(useCartStore.getState().items.length).toBe(1);
      expect(useCartStore.getState().items[0].productId).toBe(product.id);

      // Verify item remains strictly in the customer's wishlist
      expect(useWishlistStore.getState().isInWishlist(product.id)).toBe(true);
      expect(useWishlistStore.getState().itemCount).toBe(1);
    });
  });
});
