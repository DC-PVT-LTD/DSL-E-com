import { DashboardKpisResponse, DashboardQueryFilters } from '@/types/dashboard';
import { apiClient, BackendApiResponse } from '@/lib/api/apiClient';

class DashboardService {
  /**
   * Fetches real-time executive dashboard KPIs and operational metrics from backend.
   */
  public async fetchDashboardKpis(
    filters: DashboardQueryFilters = {}
  ): Promise<DashboardKpisResponse> {
    const params: Record<string, string | number | boolean | undefined> = {
      period: filters.period || 'last30days',
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    };

    const res = await apiClient.get<BackendApiResponse<DashboardKpisResponse>>(
      'admin/dashboard/kpis',
      { params }
    );

    if (res && res.success && res.data) {
      return res.data;
    }

    // In case the API returns the data payload directly
    if (res && (res as any).orders) {
      return res as unknown as DashboardKpisResponse;
    }

    throw new Error(res?.message || 'Failed to fetch executive dashboard metrics');
  }
}

export const dashboardService = new DashboardService();
