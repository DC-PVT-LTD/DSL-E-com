import { apiClient } from '@/lib/api/apiClient';
import { WishlistResponse, WishlistItem } from '@/types/wishlist';

export const wishlistService = {
  /**
   * Retrieve the authenticated customer's full wishlist with current catalogue info.
   */
  async getWishlist(): Promise<WishlistResponse> {
    return apiClient.get<WishlistResponse>('/wishlist');
  },

  /**
   * Add a product to the authenticated customer's wishlist.
   */
  async addItem(productId: string): Promise<WishlistItem> {
    return apiClient.post<WishlistItem>('/wishlist/items', { productId });
  },

  /**
   * Remove a product from the authenticated customer's wishlist.
   */
  async removeItem(productId: string): Promise<{ success: boolean; productId: string }> {
    return apiClient.delete<{ success: boolean; productId: string }>(`/wishlist/items/${productId}`);
  },

  /**
   * Retrieve total count of saved wishlist items.
   */
  async getCount(): Promise<number> {
    const res = await apiClient.get<{ count: number }>('/wishlist/count');
    return res?.count || 0;
  },

  /**
   * Check whether a single product is saved in customer's wishlist.
   */
  async checkSaved(productId: string): Promise<boolean> {
    const res = await apiClient.get<{ isSaved: boolean }>(`/wishlist/check/${productId}`);
    return !!res?.isSaved;
  },
};
