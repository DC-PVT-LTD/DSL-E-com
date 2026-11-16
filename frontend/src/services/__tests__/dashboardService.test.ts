import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dashboardService } from '../dashboardService';
import { apiClient } from '@/lib/api/apiClient';

vi.mock('@/lib/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('dashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches dashboard KPIs with default period last30days', async () => {
    const mockData = {
      period: 'last30days',
      dateFrom: '2026-10-17',
      dateTo: '2026-11-15',
      timezone: 'Asia/Colombo',
      userRole: 'ADMIN',
      financial: {
        grossSalesCents: 500000,
        netRevenueCents: 450000,
        completedRefundsCents: 50000,
        paidOrdersCount: 10,
        averageOrderValueCents: 45000,
      },
      orders: {
        totalOrdersInPeriod: 12,
        pendingFulfillmentQueue: 3,
      },
      inventory: {
        lowStockSkuCount: 2,
        lowStockItems: [],
      },
      topSellingProducts: [],
      recentOrders: [],
    };

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockData,
    });

    const result = await dashboardService.fetchDashboardKpis();

    expect(apiClient.get).toHaveBeenCalledWith('admin/dashboard/kpis', {
      params: {
        period: 'last30days',
        dateFrom: undefined,
        dateTo: undefined,
      },
    });
    expect(result.period).toBe('last30days');
    expect(result.financial?.grossSalesCents).toBe(500000);
  });

  it('passes specified period and custom date range to backend', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      success: true,
      data: {
        period: 'today',
        dateFrom: '2026-11-15',
        dateTo: '2026-11-15',
        timezone: 'Asia/Colombo',
        userRole: 'STAFF',
        financial: null,
        orders: { totalOrdersInPeriod: 4, pendingFulfillmentQueue: 1 },
        inventory: { lowStockSkuCount: 0, lowStockItems: [] },
        topSellingProducts: [],
        recentOrders: [],
      },
    });

    const result = await dashboardService.fetchDashboardKpis({
      period: 'today',
    });

    expect(apiClient.get).toHaveBeenCalledWith('admin/dashboard/kpis', {
      params: {
        period: 'today',
        dateFrom: undefined,
        dateTo: undefined,
      },
    });
    expect(result.userRole).toBe('STAFF');
    expect(result.financial).toBeNull();
  });

  it('throws an error when API client returns success: false', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      success: false,
      data: null,
      message: 'Unauthorized access',
    });

    await expect(dashboardService.fetchDashboardKpis()).rejects.toThrow(
      'Unauthorized access'
    );
  });
});
