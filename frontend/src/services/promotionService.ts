import { apiClient, BackendApiResponse } from '@/lib/api/apiClient';
import {
  Promotion,
  PromotionCode,
  PromotionRedemption,
  PromotionReportingSummary,
  PromotionValidationResult,
  CreatePromotionPayload,
  UpdatePromotionPayload,
  PromotionStatus,
  PromotionType,
} from '@/types/promotion';

export interface PromotionListResponse {
  items: Promotion[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PromotionRedemptionsResponse {
  redemptions: PromotionRedemption[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class PromotionService {
  // ============================================================================
  // CUSTOMER PUBLIC ENDPOINTS
  // ============================================================================

  /**
   * Authoritatively validate a promo code against current cart items and school packs.
   */
  public async validatePromoCode(params: {
    code: string;
    items: Array<{ productId: string; variantId?: string | null; quantity: number }>;
    packSelections?: Array<{ productId: string; variantId?: string | null; packId: string }> | null;
  }): Promise<PromotionValidationResult> {
    const res = await apiClient.post<BackendApiResponse<PromotionValidationResult>>(
      'promotions/validate',
      params
    );
    return res.data;
  }

  /**
   * Apply promo code to cart.
   */
  public async applyPromoCode(params: {
    code: string;
    items: Array<{ productId: string; variantId?: string | null; quantity: number }>;
    packSelections?: Array<{ productId: string; variantId?: string | null; packId: string }> | null;
  }): Promise<PromotionValidationResult> {
    const res = await apiClient.post<BackendApiResponse<PromotionValidationResult>>(
      'promotions/apply',
      params
    );
    return res.data;
  }

  /**
   * Remove currently applied promo code.
   */
  public async removePromoCode(): Promise<{ removed: boolean }> {
    const res = await apiClient.post<BackendApiResponse<{ removed: boolean }>>(
      'promotions/remove',
      {}
    );
    return res.data;
  }

  // ============================================================================
  // ADMIN DASHBOARD ENDPOINTS
  // ============================================================================

  /**
   * Admin: List promotions with filters, search, and pagination.
   */
  public async getAdminPromotions(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: PromotionStatus;
    promotionType?: PromotionType;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<PromotionListResponse> {
    const res = await apiClient.get<BackendApiResponse<PromotionListResponse>>(
      'admin/promotions',
      { params: params as any }
    );
    return res.data;
  }

  /**
   * Admin: Get promotion details by ID.
   */
  public async getAdminPromotionById(id: string): Promise<Promotion> {
    const res = await apiClient.get<BackendApiResponse<Promotion>>(
      `admin/promotions/${id}`
    );
    return res.data;
  }

  /**
   * Admin: Create a new promotion with codes, products, categories, and stacking settings.
   */
  public async createPromotion(payload: CreatePromotionPayload): Promise<Promotion> {
    const res = await apiClient.post<BackendApiResponse<Promotion>>(
      'admin/promotions',
      payload
    );
    return res.data;
  }

  /**
   * Admin: Update promotion configuration.
   */
  public async updatePromotion(id: string, payload: UpdatePromotionPayload): Promise<Promotion> {
    const res = await apiClient.patch<BackendApiResponse<Promotion>>(
      `admin/promotions/${id}`,
      payload
    );
    return res.data;
  }

  /**
   * Admin: Delete draft promotion or safely disable if order history exists.
   */
  public async deletePromotion(id: string): Promise<{ success: boolean; deleted: boolean; disabled?: boolean; message: string }> {
    const res = await apiClient.delete<BackendApiResponse<{ success: boolean; deleted: boolean; disabled?: boolean; message: string }>>(
      `admin/promotions/${id}`
    );
    return res.data;
  }

  /**
   * Admin: Activate promotion.
   */
  public async activatePromotion(id: string): Promise<Promotion> {
    const res = await apiClient.post<BackendApiResponse<Promotion>>(
      `admin/promotions/${id}/activate`,
      {}
    );
    return res.data;
  }

  /**
   * Admin: Deactivate promotion.
   */
  public async deactivatePromotion(id: string): Promise<Promotion> {
    const res = await apiClient.post<BackendApiResponse<Promotion>>(
      `admin/promotions/${id}/deactivate`,
      {}
    );
    return res.data;
  }

  /**
   * Admin: Generate a random unique promo code with collision check.
   */
  public async generateUniqueCode(prefix: string = 'DSL'): Promise<string> {
    const res = await apiClient.post<BackendApiResponse<{ code: string }>>(
      'admin/promotions/generate-code',
      {},
      { params: { prefix } }
    );
    return res.data.code;
  }

  /**
   * Admin: Add a promo code to an existing promotion.
   */
  public async addPromoCode(
    promotionId: string,
    payload: {
      code?: string;
      maximumTotalUsage?: number | null;
      maximumUsagePerCustomer?: number | null;
      isActive?: boolean;
    }
  ): Promise<PromotionCode> {
    const res = await apiClient.post<BackendApiResponse<PromotionCode>>(
      `admin/promotions/${promotionId}/codes`,
      payload
    );
    return res.data;
  }

  /**
   * Admin: Get redemption history for a promotion.
   */
  public async getPromotionRedemptions(
    promotionId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PromotionRedemptionsResponse> {
    const res = await apiClient.get<BackendApiResponse<PromotionRedemptionsResponse>>(
      `admin/promotions/${promotionId}/redemptions`,
      { params: { page, limit } }
    );
    return res.data;
  }

  /**
   * Admin: Get reporting metrics summary.
   */
  public async getReportingSummary(): Promise<PromotionReportingSummary> {
    const res = await apiClient.get<BackendApiResponse<PromotionReportingSummary>>(
      'admin/promotions/reporting/summary'
    );
    return res.data;
  }
}

export const promotionService = new PromotionService();

