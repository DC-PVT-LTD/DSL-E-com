import { apiClient } from '@/lib/api/apiClient';
import { CartItem } from '@/types/cart';

const GUEST_SESSION_KEY = 'dsl_guest_session_id';

export interface BackendCartItem {
  id: string;
  productId: string;
  variantId?: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    images: string[];
    priceCents: number;
    stockQuantity: number;
    isActive: boolean;
    categoryName?: string;
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
    priceCents: number;
    stockQuantity: number;
    isActive: boolean;
  } | null;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  isAvailable: boolean;
  isOutOfStock: boolean;
  exceedsStock: boolean;
}

export interface BackendCartResponse {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  items: BackendCartItem[];
  itemCount: number;
  subtotalCents: number;
  discountCents: number;
  deliveryCents: number;
  totalCents: number;
  isFreeDeliveryEligible: boolean;
  freeDeliveryThresholdCents: number;
  warnings?: string[];
  updatedAt: string;
}

class CartService {
  public getGuestSessionId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(GUEST_SESSION_KEY);
  }

  public setGuestSessionId(id: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(GUEST_SESSION_KEY, id);
  }

  public clearGuestSessionId(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(GUEST_SESSION_KEY);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    const guestId = this.getGuestSessionId();
    if (guestId) {
      headers['x-guest-session-id'] = guestId;
    }
    return headers;
  }

  private handleResponse(cart: BackendCartResponse): BackendCartResponse {
    if (cart.sessionId) {
      this.setGuestSessionId(cart.sessionId);
    }
    return cart;
  }

  public async getCart(): Promise<BackendCartResponse> {
    const res = await apiClient.get<{ success: boolean; data: BackendCartResponse }>(
      '/cart',
      {
        headers: this.getHeaders(),
      }
    );
    return this.handleResponse(res.data);
  }

  public async addItem(
    productId: string,
    quantity = 1,
    variantId?: string | null
  ): Promise<BackendCartResponse> {
    const res = await apiClient.post<{ success: boolean; data: BackendCartResponse }>(
      '/cart/items',
      {
        productId,
        quantity,
        variantId: variantId || null,
      },
      {
        headers: this.getHeaders(),
      }
    );
    return this.handleResponse(res.data);
  }

  public async addSchoolPack(
    packId: string,
    items: { productId: string; variantId?: string | null; quantity: number }[]
  ): Promise<BackendCartResponse> {
    const res = await apiClient.post<{ success: boolean; data: BackendCartResponse }>(
      '/cart/school-packs',
      {
        packId,
        items,
      },
      {
        headers: this.getHeaders(),
      }
    );
    return this.handleResponse(res.data);
  }

  public async updateQuantity(
    itemId: string,
    quantity: number
  ): Promise<BackendCartResponse> {
    const res = await apiClient.patch<{ success: boolean; data: BackendCartResponse }>(
      `/cart/items/${itemId}`,
      { quantity },
      {
        headers: this.getHeaders(),
      }
    );
    return this.handleResponse(res.data);
  }

  public async removeItem(itemId: string): Promise<BackendCartResponse> {
    const res = await apiClient.delete<{ success: boolean; data: BackendCartResponse }>(
      `/cart/items/${itemId}`,
      {
        headers: this.getHeaders(),
      }
    );
    return this.handleResponse(res.data);
  }

  public async clearCart(): Promise<BackendCartResponse> {
    const res = await apiClient.delete<{ success: boolean; data: BackendCartResponse }>(
      '/cart',
      {
        headers: this.getHeaders(),
      }
    );
    return this.handleResponse(res.data);
  }

  public async mergeCart(guestSessionId: string): Promise<BackendCartResponse> {
    const res = await apiClient.post<{ success: boolean; data: BackendCartResponse }>(
      '/cart/merge',
      { guestSessionId },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      }
    );
    this.clearGuestSessionId();
    return res.data;
  }

  public toClientCartItem(item: BackendCartItem): CartItem {
    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId || undefined,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        sku: item.product.sku,
        description: '',
        shortDescription: '',
        priceCents: item.product.priceCents,
        stockQuantity: item.product.stockQuantity,
        lowStockThreshold: 5,
        isActive: item.product.isActive,
        isFeatured: false,
        isNewArrival: false,
        isBestSeller: false,
        images: item.product.images || [],
        tags: [],
        rating: 5,
        reviewCount: 0,
        specifications: {},
        categoryId: '',
        categoryName: item.product.categoryName || '',
        brandId: '',
        brandName: '',
        createdAt: '',
        updatedAt: '',
      },
      variant: item.variant
        ? {
            id: item.variant.id,
            name: item.variant.name,
            sku: item.variant.sku,
            priceCents: item.variant.priceCents,
            stockQuantity: item.variant.stockQuantity,
            attributes: {},
          }
        : undefined,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalPriceCents: item.totalPriceCents,
      isAvailable: item.isAvailable,
      isOutOfStock: item.isOutOfStock,
      exceedsStock: item.exceedsStock,
      selected: true,
    };
  }

  /**
   * Batch removes only purchased items from server cart after successful order.
   * Preserves unselected or unpurchased cart lines.
   */
  public async removePurchasedItems(
    items: Array<{ productId: string; variantId?: string | null }>
  ): Promise<BackendCartResponse | null> {
    try {
      const res = await apiClient.post<{ success: boolean; data: BackendCartResponse }>(
        '/cart/items/batch-delete',
        { items },
        { headers: this.getHeaders() }
      );
      return this.handleResponse(res.data);
    } catch (err) {
      console.warn('Failed to remove purchased items from server cart:', err);
      return null;
    }
  }
}

export const cartService = new CartService();

