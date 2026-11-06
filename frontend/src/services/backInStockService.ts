import { apiClient } from '@/lib/api/apiClient';
import { BackInStockAlert, BackInStockStatusResponse } from '@/types/backInStock';

export const backInStockService = {
  /**
   * Subscribe an authenticated customer to back-in-stock notifications for an out-of-stock product.
   */
  async subscribe(productId: string): Promise<BackInStockAlert> {
    return apiClient.post<BackInStockAlert>('/back-in-stock/subscribe', { productId });
  },

  /**
   * Get all back-in-stock alert subscriptions for the authenticated customer.
   */
  async getMyAlerts(): Promise<BackInStockAlert[]> {
    return apiClient.get<BackInStockAlert[]>('/back-in-stock/my-alerts');
  },

  /**
   * Cancel an active alert subscription.
   */
  async cancelAlert(alertId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(`/back-in-stock/${alertId}`);
  },

  /**
   * Check whether the authenticated customer is subscribed to a product.
   */
  async getStatus(productId: string): Promise<BackInStockStatusResponse> {
    return apiClient.get<BackInStockStatusResponse>(`/back-in-stock/status/${productId}`);
  },
};

