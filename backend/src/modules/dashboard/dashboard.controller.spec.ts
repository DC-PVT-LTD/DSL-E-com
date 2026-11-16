import { describe, it, expect, vi } from 'vitest';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { UserRole } from '../../generated/prisma';

describe('DashboardController', () => {
  it('delegates to DashboardService with validated query and user role', async () => {
    const mockService = {
      getDashboardKpis: vi.fn().mockResolvedValue({
        period: 'last30days',
        dateFrom: '2026-10-17',
        dateTo: '2026-11-15',
        timezone: 'Asia/Colombo',
        userRole: UserRole.ADMIN,
        orders: { totalOrdersInPeriod: 10, pendingFulfillmentQueue: 2 },
        inventory: { lowStockSkuCount: 1, lowStockItems: [] },
        topSellingProducts: [],
        recentOrders: [],
      }),
    };

    const controller = new DashboardController(mockService as unknown as DashboardService);

    const user = {
      id: 'admin-1',
      email: 'admin@dsl.lk',
      name: 'System Admin',
      role: 'ADMIN',
      isActive: true,
    };

    const result = await controller.getDashboardKpis({ period: 'last30days' }, user);

    expect(mockService.getDashboardKpis).toHaveBeenCalledWith(
      { period: 'last30days' },
      UserRole.ADMIN
    );
    expect(result.period).toBe('last30days');
    expect(result.userRole).toBe(UserRole.ADMIN);
  });
});
