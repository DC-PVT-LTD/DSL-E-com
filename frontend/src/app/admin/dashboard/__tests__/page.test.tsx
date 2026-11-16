import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminDashboardPage from '../page';
import { dashboardService } from '@/services/dashboardService';

vi.mock('@/services/dashboardService', () => ({
  dashboardService: {
    fetchDashboardKpis: vi.fn(),
  },
}));

const mockAdminData = {
  period: 'last30days',
  dateFrom: '2026-10-17',
  dateTo: '2026-11-15',
  timezone: 'Asia/Colombo',
  userRole: 'ADMIN',
  financial: {
    grossSalesCents: 12500000,
    netRevenueCents: 11800000,
    completedRefundsCents: 700000,
    paidOrdersCount: 28,
    averageOrderValueCents: 421428,
  },
  orders: {
    totalOrdersInPeriod: 32,
    pendingFulfillmentQueue: 5,
  },
  inventory: {
    lowStockSkuCount: 2,
    lowStockItems: [
      {
        id: 'p-1',
        productId: 'p-1',
        name: 'Atlas CR Book 120 Pages',
        sku: 'DSL-ATL-CR-120',
        stockQuantity: 2,
        lowStockThreshold: 5,
        isVariant: false,
      },
    ],
  },
  topSellingProducts: [
    {
      productId: 'p-1',
      name: 'Atlas CR Book 120 Pages',
      sku: 'DSL-ATL-CR-120',
      image: null,
      priceCents: 45000,
      unitsSold: 42,
    },
  ],
  recentOrders: [
    {
      id: 'ord-1',
      orderNumber: 'DSL-2026-4891',
      customerName: 'Kavindu Perera',
      orderStatus: 'CONFIRMED',
      paymentStatus: 'PAID',
      totalCents: 85000,
      createdAt: '2026-11-15T05:30:00.000Z',
      createdAtColombo: '2026-11-15 11:00:00 (+05:30)',
    },
  ],
};

const mockStaffData = {
  ...mockAdminData,
  userRole: 'STAFF',
  financial: null,
  recentOrders: [
    {
      id: 'ord-1',
      orderNumber: 'DSL-2026-4891',
      customerName: 'Kavindu Perera',
      orderStatus: 'CONFIRMED',
      paymentStatus: 'PAID',
      totalCents: undefined,
      createdAt: '2026-11-15T05:30:00.000Z',
      createdAtColombo: '2026-11-15 11:00:00 (+05:30)',
    },
  ],
};

describe('AdminDashboardPage (Stage 4.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders executive dashboard with financial cards and recent order totals for ADMIN', async () => {
    vi.mocked(dashboardService.fetchDashboardKpis).mockResolvedValueOnce(mockAdminData as any);

    render(<AdminDashboardPage />);

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeDefined();
    });

    // Financial Cards are displayed
    expect(screen.getByText('Gross Sales')).toBeDefined();
    expect(screen.getByText('Net Revenue')).toBeDefined();
    expect(screen.getByText('Refunds')).toBeDefined();

    // Operational Cards are displayed
    expect(screen.getByText('Total Orders')).toBeDefined();
    expect(screen.getByText('Pending Queue')).toBeDefined();
    expect(screen.getByText('Low Stock SKUs')).toBeDefined();
    expect(screen.getByText('32')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();

    // Recent Orders Table includes order total for ADMIN
    expect(screen.getByText('DSL-2026-4891')).toBeDefined();
    expect(screen.getByText('Kavindu Perera')).toBeDefined();
    expect(screen.getByText('2026-11-15 11:00:00 (+05:30)')).toBeDefined();

    // Top selling product is displayed
    expect(screen.getByText('42 units')).toBeDefined();
  });

  it('renders operational metrics only and strictly hides financial cards and totals for STAFF', async () => {
    vi.mocked(dashboardService.fetchDashboardKpis).mockResolvedValueOnce(mockStaffData as any);

    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeDefined();
    });

    // Financial cards must NOT be displayed
    expect(screen.queryByText('Gross Sales')).toBeNull();
    expect(screen.queryByText('Net Revenue')).toBeNull();
    expect(screen.queryByText('Refunds')).toBeNull();

    // Operational cards must remain visible
    expect(screen.getByText('Total Orders')).toBeDefined();
    expect(screen.getByText('Pending Queue')).toBeDefined();
    expect(screen.getByText('Low Stock SKUs')).toBeDefined();
    expect(screen.getByText('32')).toBeDefined();

    // Recent orders table does NOT have Total column
    expect(screen.queryByRole('columnheader', { name: /total/i })).toBeNull();
  });

  it('displays warning banner when independent reconciliation has not verified financial metrics', async () => {
    const unverifiedData = {
      ...mockAdminData,
      financial: null,
      financialVerificationStatus: 'NOT_VERIFIABLE',
    };
    vi.mocked(dashboardService.fetchDashboardKpis).mockResolvedValueOnce(unverifiedData as any);

    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Financial Reconciliation Notice \(NOT_VERIFIABLE\)/i)
      ).toBeDefined();
    });
  });

  it('displays error state and provides working retry button', async () => {
    vi.mocked(dashboardService.fetchDashboardKpis)
      .mockRejectedValueOnce(new Error('PostgreSQL database query timed out'))
      .mockResolvedValueOnce(mockAdminData as any);

    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load dashboard data')).toBeDefined();
      expect(screen.getByText('PostgreSQL database query timed out')).toBeDefined();
    });

    // Click retry
    const retryBtn = screen.getByRole('button', { name: /retry request/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Gross Sales')).toBeDefined();
    });
    expect(dashboardService.fetchDashboardKpis).toHaveBeenCalledTimes(2);
  });

  it('changes period filter and fetches updated data', async () => {
    vi.mocked(dashboardService.fetchDashboardKpis).mockResolvedValue(mockAdminData as any);

    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeDefined();
    });

    const todayBtn = screen.getByRole('button', { name: 'Today' });
    fireEvent.click(todayBtn);

    await waitFor(() => {
      expect(dashboardService.fetchDashboardKpis).toHaveBeenCalledWith({ period: 'today' });
    });
  });

  it('renders Access Restricted screen when 403 Forbidden is returned', async () => {
    const forbiddenError: any = new Error('Forbidden resource');
    forbiddenError.status = 403;
    vi.mocked(dashboardService.fetchDashboardKpis).mockRejectedValueOnce(forbiddenError);

    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Access Restricted')).toBeDefined();
      expect(screen.getByText(/Your account role does not have authorization/i)).toBeDefined();
    });
  });

  it('renders empty states for top selling stationery and healthy inventory', async () => {
    const emptyData = {
      ...mockAdminData,
      inventory: {
        lowStockSkuCount: 0,
        lowStockItems: [],
      },
      topSellingProducts: [],
      recentOrders: [],
    };
    vi.mocked(dashboardService.fetchDashboardKpis).mockResolvedValueOnce(emptyData as any);

    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('All inventory stock healthy.')).toBeDefined();
      expect(screen.getByText('No stationery sales recorded in this period.')).toBeDefined();
      expect(screen.getByText('No customer orders recorded yet.')).toBeDefined();
    });
  });
});
