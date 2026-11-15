import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminPaymentsPage from '../page';
import { paymentsService } from '@/services/paymentsService';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/admin/payments',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/services/userStore', () => ({
  useUserStore: (selector: any) =>
    selector({
      currentUser: { id: 'admin-1', role: 'ADMIN', name: 'Super Admin' },
    }),
}));

vi.mock('@/services/paymentsService', () => ({
  paymentsService: {
    getSummary: vi.fn(),
    getTransactions: vi.fn(),
    downloadCsvExport: vi.fn(),
    getReconciliationReport: vi.fn(),
  },
}));

describe('AdminPaymentsPage (Stage 3.4)', () => {
  const mockSummary = {
    totalPaidVolumeCents: 12500000,
    totalTransactions: 42,
    bankTransfers: {
      pending: 4,
      verified: 20,
      rejected: 3,
      totalVolumeCents: 6000000,
    },
    payhereCards: {
      succeeded: 12,
      pending: 1,
      failed: 1,
      totalVolumeCents: 4000000,
    },
    cashOnDelivery: {
      pendingCollection: 3,
      deliveredPaid: 7,
      totalVolumeCents: 2500000,
    },
  };

  const mockTransactions = {
    success: true,
    data: [
      {
        id: 'ord-1',
        orderNumber: 'DSL-2026-0001',
        orderStatus: 'CONFIRMED',
        paymentStatus: 'PAID',
        paymentMethod: 'BANK_TRANSFER',
        totalAmountCents: 250000,
        currency: 'LKR',
        customerName: 'Anura Bandara',
        customerEmail: 'anura@example.com',
        customerPhone: '0771234567',
        createdAt: '2026-11-14T10:00:00.000Z',
        paidAt: '2026-11-14T11:00:00.000Z',
        bankTransferDetails: {
          submissionId: 'sub-1',
          status: 'VERIFIED',
          referenceNumber: 'TX-9999',
          depositDate: '2026-11-14',
          rejectionReason: null,
          reviewedAt: '2026-11-14T11:00:00.000Z',
        },
        latestPaymentAttempt: null,
      },
    ],
    meta: {
      page: 1,
      limit: 20,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary metrics across all three supported methods and transaction list', async () => {
    vi.mocked(paymentsService.getSummary).mockResolvedValueOnce(mockSummary as any);
    vi.mocked(paymentsService.getTransactions).mockResolvedValueOnce(mockTransactions as any);

    render(<AdminPaymentsPage />);

    expect(screen.getByText('Payments & Transactions')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('DSL-2026-0001')).toBeDefined();
      expect(screen.getByText('Anura Bandara')).toBeDefined();
      expect(screen.getAllByText('Bank Transfer').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Export CSV')).toBeDefined();
    expect(screen.getByText('Consistency Check')).toBeDefined();
  });

  it('triggers CSV download with current filters when Export CSV button is clicked', async () => {
    vi.mocked(paymentsService.getSummary).mockResolvedValueOnce(mockSummary as any);
    vi.mocked(paymentsService.getTransactions).mockResolvedValueOnce(mockTransactions as any);
    vi.mocked(paymentsService.downloadCsvExport).mockResolvedValueOnce();

    render(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(paymentsService.downloadCsvExport).toHaveBeenCalled();
    });
  });

  it('opens consistency check diagnostic modal when clicked', async () => {
    vi.mocked(paymentsService.getSummary).mockResolvedValueOnce(mockSummary as any);
    vi.mocked(paymentsService.getTransactions).mockResolvedValueOnce(mockTransactions as any);
    vi.mocked(paymentsService.getReconciliationReport).mockResolvedValueOnce({
      summary: { totalCheckedOrders: 10, totalAnomalies: 0, healthy: true },
      anomalies: [],
      checkedAt: '2026-11-14T12:00:00.000Z',
    });

    render(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Consistency Check')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Consistency Check'));

    await waitFor(() => {
      expect(paymentsService.getReconciliationReport).toHaveBeenCalled();
      expect(screen.getByText('Payment Ledger State: Healthy & Consistent')).toBeDefined();
    });
  });
});
