import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminReportsPage from '../page';
import { reportService } from '@/services/reportService';
import { SalesReportResponse } from '@/types/report';

let mockCurrentUser: any = { id: 'admin-1', role: 'ADMIN', name: 'Admin User' };

vi.mock('@/services/userStore', () => ({
  useUserStore: (selector: any) =>
    selector({
      currentUser: mockCurrentUser,
    }),
}));

vi.mock('@/services/reportService', () => ({
  reportService: {
    fetchSalesReport: vi.fn(),
    downloadReportFile: vi.fn(),
  },
}));

describe('AdminReportsPage (Stage 4.3)', () => {
  const mockReportData: SalesReportResponse = {
    period: 'last30days',
    dateFrom: '2026-10-17',
    dateTo: '2026-11-15',
    timezone: 'Asia/Colombo',
    kpi: {
      grossSalesCents: 1500000,
      netRevenueCents: 1200000,
      totalRefundsCents: 300000,
      salesEligibleRefundsCents: 300000,
      cancelledOrderRefundsCents: 0,
      totalOrdersCount: 15,
      paidOrdersCount: 12,
      averageOrderValueCents: 125000,
      deliveredOrdersCount: 10,
      cancelledOrdersCount: 2,
      pendingFulfillmentCount: 3,
      codCollectedCents: 450000,
      codCollectedCount: 4,
      codPendingCents: 150000,
      codPendingCount: 1,
    },
    cancellationReconciliation: {
      cohortDescription: 'Orders placed between 2026-10-17 and 2026-11-15 with CANCELLED status',
      asOfTimestamp: '2026-11-15T00:00:00.000Z',
      cancelledPaidOrdersCount: 1,
      cancelledPaidCapturedCents: 200000,
      cancelledPaidRefundedCents: 0,
      cancelledPaidOutstandingCents: 200000,
    },
    reconciliation: {
      isNetRevenueReconciled: true,
      isRefundsReconciled: true,
      isCancelledReconciled: true,
      independentVerification: {
        overallStatus: 'PASS',
        asOfTimestamp: '2026-11-15T00:00:00.000Z',
        inconsistencies: [],
      },
      inconsistencies: [],
    },
    paymentMethods: [
      {
        method: 'CARD_PAYHERE',
        name: 'Card Payment (PayHere)',
        count: 8,
        totalCents: 1000000,
        percentage: 66.67,
      },
      {
        method: 'CASH_ON_DELIVERY',
        name: 'Cash on Delivery (COD)',
        count: 4,
        totalCents: 500000,
        percentage: 33.33,
      },
    ],
    orderStatuses: [
      {
        status: 'DELIVERED',
        name: 'Delivered',
        count: 10,
        totalCents: 1200000,
        percentage: 66.67,
      },
      {
        status: 'CANCELLED',
        name: 'Cancelled',
        count: 2,
        totalCents: 200000,
        percentage: 13.33,
      },
    ],
    districtDistribution: [
      {
        district: 'Colombo',
        count: 8,
        totalCents: 900000,
        percentage: 60,
      },
      {
        district: 'Gampaha',
        count: 4,
        totalCents: 600000,
        percentage: 40,
      },
    ],
    dailySales: [
      {
        date: '2026-11-01',
        grossSalesCents: 500000,
        netRevenueCents: 400000,
        refundsCents: 100000,
        cancelledRefundsCents: 0,
        orderCount: 5,
        paidOrderCount: 4,
        averageOrderValueCents: 125000,
      },
      {
        date: '2026-11-02',
        grossSalesCents: 1000000,
        netRevenueCents: 800000,
        refundsCents: 200000,
        cancelledRefundsCents: 0,
        orderCount: 10,
        paidOrderCount: 8,
        averageOrderValueCents: 125000,
      },
    ],
    recentOrders: [
      {
        id: 'ord-1',
        orderNumber: 'DSL-2026-001',
        customerName: 'Kamal Perera',
        totalCents: 500000,
        paymentMethod: 'CARD_PAYHERE',
        paymentStatus: 'PAID',
        orderStatus: 'DELIVERED',
        createdAt: '2026-11-01T10:00:00.000Z',
        district: 'Colombo',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = { id: 'admin-1', role: 'ADMIN', name: 'Admin User' };
    vi.mocked(reportService.fetchSalesReport).mockResolvedValue(mockReportData);
  });

  it('displays access restriction for unauthorized STAFF role', () => {
    mockCurrentUser = { id: 'staff-1', role: 'STAFF', name: 'Staff User' };
    render(<AdminReportsPage />);

    expect(screen.getByText('Access Restricted')).toBeDefined();
    expect(
      screen.getByText(/Access is strictly restricted to Administrators and Managers/)
    ).toBeDefined();
    expect(reportService.fetchSalesReport).not.toHaveBeenCalled();
  });

  it('allows MANAGER role and loads reporting data', async () => {
    mockCurrentUser = { id: 'mgr-1', role: 'MANAGER', name: 'Manager User' };
    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(reportService.fetchSalesReport).toHaveBeenCalled();
      expect(screen.getByText('Financial & Executive Reports')).toBeDefined();
      expect(screen.getAllByText('Gross Sales').length).toBeGreaterThan(0);
    });
  });

  it('renders all key KPI cards with formatted LKR values', async () => {
    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Gross Sales').length).toBeGreaterThan(0);
      expect(screen.getByText('Rs. 15,000.00')).toBeDefined();
      expect(screen.getAllByText('Net Revenue').length).toBeGreaterThan(0);
      expect(screen.getByText('Rs. 12,000.00')).toBeDefined();
      expect(screen.getByText('Completed Refunds')).toBeDefined();
      expect(screen.getByText('Rs. 3,000.00')).toBeDefined();
    });
  });

  it('renders cancellation and refund ledger reconciliation cards and badges', async () => {
    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cancellation & Refund Ledger Reconciliation')).toBeDefined();
      expect(screen.getByText('Independent Verification Passed')).toBeDefined();
      expect(screen.getByText('Net Revenue Reconciled')).toBeDefined();
      expect(screen.getByText('Refunds Reconciled')).toBeDefined();
      expect(screen.getByText('Cancelled Ledger Reconciled')).toBeDefined();
      expect(screen.getByText('Outstanding Cancelled Balance')).toBeDefined();
      expect(
        screen.getByText(/Orders placed between 2026-10-17 and 2026-11-15 with CANCELLED status/)
      ).toBeDefined();
    });
  });

  it('rejects invalid Gregorian calendar dates in custom date filter', async () => {
    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Custom Range')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Custom Range'));

    const fromInput = document.getElementById('custom-from') as HTMLInputElement;
    const toInput = document.getElementById('custom-to') as HTMLInputElement;

    // Test invalid leap year date (2025 is not a leap year, so 2025-02-29 is invalid)
    fireEvent.change(fromInput, { target: { value: '2025-02-29' } });
    fireEvent.change(toInput, { target: { value: '2025-03-01' } });

    fireEvent.submit(fromInput.closest('form')!);

    await waitFor(() => {
      expect(
        screen.getByText('Please enter valid calendar dates in YYYY-MM-DD format.')
      ).toBeDefined();
    });
  });

  it('accepts valid Gregorian leap year date (2024-02-29)', async () => {
    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Custom Range')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Custom Range'));

    const fromInput = document.getElementById('custom-from') as HTMLInputElement;
    const toInput = document.getElementById('custom-to') as HTMLInputElement;

    fireEvent.change(fromInput, { target: { value: '2024-02-29' } });
    fireEvent.change(toInput, { target: { value: '2024-03-01' } });

    fireEvent.submit(fromInput.closest('form')!);

    await waitFor(() => {
      expect(
        screen.queryByText('Please enter valid calendar dates in YYYY-MM-DD format.')
      ).toBeNull();
      expect(reportService.fetchSalesReport).toHaveBeenCalledWith({
        period: 'custom',
        dateFrom: '2024-02-29',
        dateTo: '2024-03-01',
      });
    });
  });

  it('rejects custom date range exceeding 366 days', async () => {
    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Custom Range')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Custom Range'));

    const fromInput = document.getElementById('custom-from') as HTMLInputElement;
    const toInput = document.getElementById('custom-to') as HTMLInputElement;

    // Over 1 year range (2 years)
    fireEvent.change(fromInput, { target: { value: '2024-01-01' } });
    fireEvent.change(toInput, { target: { value: '2026-01-01' } });

    fireEvent.submit(fromInput.closest('form')!);

    await waitFor(() => {
      expect(
        screen.getByText('Custom reporting period cannot exceed 366 days (1 year).')
      ).toBeDefined();
    });
  });

  it('switches between visual chart and tabular view', async () => {
    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Visual Chart')).toBeDefined();
      expect(screen.getByText('Tabular Ledger')).toBeDefined();
    });

    // Switch to tabular view
    fireEvent.click(screen.getByText('Tabular Ledger'));
    expect(screen.getByText('Date (Colombo)')).toBeDefined();
    expect(screen.getAllByText('2026-11-01').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2026-11-02').length).toBeGreaterThan(0);
  });

  it('triggers downloadReportFile when clicking Export Excel', async () => {
    vi.mocked(reportService.downloadReportFile).mockResolvedValueOnce('report.xlsx');
    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Export Excel')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Export Excel'));

    await waitFor(() => {
      expect(reportService.downloadReportFile).toHaveBeenCalledWith(
        { period: 'last30days', dateFrom: undefined, dateTo: undefined },
        'xlsx'
      );
    });
  });

  it('triggers downloadReportFile when clicking Export CSV', async () => {
    vi.mocked(reportService.downloadReportFile).mockResolvedValueOnce('report.csv');
    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(reportService.downloadReportFile).toHaveBeenCalledWith(
        { period: 'last30days', dateFrom: undefined, dateTo: undefined },
        'csv'
      );
    });
  });

  it('renders error state and retry button on fetch failure', async () => {
    vi.mocked(reportService.fetchSalesReport).mockRejectedValueOnce(
      new Error('Database query timed out')
    );
    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Database query timed out')).toBeDefined();
      expect(screen.getByText('Retry')).toBeDefined();
    });
  });
});
