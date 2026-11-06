import { apiClient, BackendApiResponse } from '@/lib/api/apiClient';
import {
  StationeryPurpose,
  RecommendationCriteria,
  RecommendationResponse,
  BasketValidationItem,
  BasketValidationResult,
  RecommendationSubstitute,
  RecommendationRule,
  RecommendationConfig,
} from '@/types/recommendations';

class RecommendationService {
  /**
   * Fetches public configuration options for recommendation wizard
   */
  async getConfig(): Promise<RecommendationConfig> {
    const res = await apiClient.get<BackendApiResponse<RecommendationConfig>>('/recommendations/config');
    return res.data;
  }

  /**
   * Requests personalized stationery recommendations from the backend engine
   */
  async getRecommendations(criteria: RecommendationCriteria): Promise<RecommendationResponse> {
    const res = await apiClient.post<BackendApiResponse<RecommendationResponse>>(
      '/recommendations/generate',
      criteria
    );
    return res.data;
  }

  /**
   * Authoritative validation of basket prices, quantities and available stock in PostgreSQL
   */
  async validateBasket(
    items: BasketValidationItem[],
    budgetLkr?: number
  ): Promise<BasketValidationResult> {
    const res = await apiClient.post<BackendApiResponse<BasketValidationResult>>(
      '/recommendations/validate-basket',
      {
        items,
        budgetLkr,
      }
    );
    return res.data;
  }

  /**
   * Fetches alternative substitute products for a recommended item
   */
  async getSubstitutes(productId: string): Promise<RecommendationSubstitute[]> {
    const res = await apiClient.get<BackendApiResponse<RecommendationSubstitute[]>>(
      `/recommendations/substitutes/${productId}`
    );
    return res.data;
  }

  // ==========================================
  // ADMIN API CALLS
  // ==========================================

  async getAdminRules(purpose?: StationeryPurpose): Promise<RecommendationRule[]> {
    const url = purpose
      ? `/admin/recommendations/rules?purpose=${purpose}`
      : '/admin/recommendations/rules';
    const res = await apiClient.get<BackendApiResponse<RecommendationRule[]>>(url);
    return res.data;
  }

  async getAdminRuleById(id: string): Promise<RecommendationRule> {
    const res = await apiClient.get<BackendApiResponse<RecommendationRule>>(
      `/admin/recommendations/rules/${id}`
    );
    return res.data;
  }

  async createAdminRule(rule: Partial<RecommendationRule>): Promise<RecommendationRule> {
    const res = await apiClient.post<BackendApiResponse<RecommendationRule>>(
      '/admin/recommendations/rules',
      rule
    );
    return res.data;
  }

  async updateAdminRule(id: string, rule: Partial<RecommendationRule>): Promise<RecommendationRule> {
    const res = await apiClient.patch<BackendApiResponse<RecommendationRule>>(
      `/admin/recommendations/rules/${id}`,
      rule
    );
    return res.data;
  }

  async deleteAdminRule(id: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<BackendApiResponse<{ success: boolean; message: string }>>(
      `/admin/recommendations/rules/${id}`
    );
    return res.data;
  }

  async toggleAdminRule(id: string, isActive?: boolean): Promise<RecommendationRule> {
    const res = await apiClient.patch<BackendApiResponse<RecommendationRule>>(
      `/admin/recommendations/rules/${id}/toggle`,
      { isActive }
    );
    return res.data;
  }
}

export const recommendationService = new RecommendationService();
