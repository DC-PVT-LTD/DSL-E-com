import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BankTransfersQueuePage from '../page';
import { paymentsService } from '@/services/paymentsService';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/admin/payments/bank-transfers',
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
    getBankTransfers: vi.fn(),
    getBankTransferDetails: vi.fn(),
    approveBankTransfer: vi.fn(),
    rejectBankTransfer: vi.fn(),
    getReceiptFileUrl: vi.fn().mockReturnValue('http://localhost:4000/api/v1/checkout/bank-receipt/sub-1'),
  },
  REJECTION_CATEGORY_LABELS: {
    UNREADABLE_RECEIPT: 'Receipt Unreadable / Blurry',
    AMOUNT_MISMATCH: 'Deposit Amount Mismatch',
    REFERENCE_NOT_FOUND: 'Transaction Reference Not Found on Bank Statement',
    SUSPECTED_FRAUD: 'Suspected Tampered or Duplicate Slip',
    INCORRECT_ACCOUNT: 'Transferred to Incorrect Bank Account',
    PAYMENT_EXPIRED: 'Payment Expired / Window Closed',
    OTHER: 'Other Discrepancy',
  },
}));

describe('BankTransfersQueuePage (Stage 3.3)', () => {
  const mockSubmissions = {
    success: true,
    data: [
      {
        id: 'sub-1',
        orderId: 'ord-1',
        referenceNumber: 'TX-REF-888',
        depositDate: '2026-11-14',
        amountCents: 500000,
        status: 'PENDING',
        rejectionReason: null,
        reviewedById: null,
        reviewedAt: null,
        createdAt: '2026-11-14T10:00:00.000Z',
        order: {
          id: 'ord-1',
          orderNumber: 'DSL-2026-0001',
          totalAmountCents: 500000,
          orderStatus: 'PENDING',
          paymentStatus: 'PENDING',
          createdAt: '2026-11-14T10:00:00.000Z',
          customer: {
            id: 'cust-1',
            name: 'Sunil Silva',
            email: 'sunil@dsl.lk',
            phone: '0779998888',
          },
        },
        reviewer: null,
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

  const mockDetail = {
    id: 'sub-1',
    orderId: 'ord-1',
    referenceNumber: 'TX-REF-888',
    depositDate: '2026-11-14',
    amountCents: 500000,
    status: 'PENDING',
    receiptStorageKey: 'receipts/test-slip.pdf',
    rejectionReason: null,
    reviewedById: null,
    reviewedAt: null,
    createdAt: '2026-11-14T10:00:00.000Z',
    order: {
      id: 'ord-1',
      orderNumber: 'DSL-2026-0001',
      totalAmountCents: 500000,
      orderStatus: 'PENDING',
      paymentStatus: 'PENDING',
      createdAt: '2026-11-14T10:00:00.000Z',
      customer: {
        id: 'cust-1',
        name: 'Sunil Silva',
        email: 'sunil@dsl.lk',
        phone: '0779998888',
      },
      deliveryAddress: {},
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          productName: 'Atlas Notebook',
          quantity: 5,
          priceCents: 100000,
          totalCents: 500000,
        },
      ],
      paymentAttempts: [],
    },
    reviewer: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders review queue table with pending bank deposit slip', async () => {
    vi.mocked(paymentsService.getBankTransfers).mockResolvedValueOnce(mockSubmissions as any);

    render(<BankTransfersQueuePage />);

    expect(screen.getByText('Bank Transfers Review Queue')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('DSL-2026-0001')).toBeDefined();
      expect(screen.getByText('Sunil Silva')).toBeDefined();
      expect(screen.getByText('TX-REF-888')).toBeDefined();
    });
  });

  it('opens verification drawer and allows approval of valid deposit slip', async () => {
    vi.mocked(paymentsService.getBankTransfers).mockResolvedValue(mockSubmissions as any);
    vi.mocked(paymentsService.getBankTransferDetails).mockResolvedValue(mockDetail as any);
    vi.mocked(paymentsService.approveBankTransfer).mockResolvedValueOnce({
      success: true,
      message: 'Verified',
    });

    render(<BankTransfersQueuePage />);

    await waitFor(() => {
      expect(screen.getByText('Review Slip')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Review Slip'));

    await waitFor(() => {
      expect(screen.getByText('Corporate Bank Statement Comparison Required')).toBeDefined();
      expect(screen.getByText('Verify & Confirm Order')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Verify & Confirm Order'));

    await waitFor(() => {
      expect(screen.getByText('Confirm Approval')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Confirm Approval'));

    await waitFor(() => {
      expect(paymentsService.approveBankTransfer).toHaveBeenCalledWith(
        'sub-1',
        expect.any(Object)
      );
    });
  });

  it('opens reject modal and rejects with mandatory explanation', async () => {
    vi.mocked(paymentsService.getBankTransfers).mockResolvedValue(mockSubmissions as any);
    vi.mocked(paymentsService.getBankTransferDetails).mockResolvedValue(mockDetail as any);
    vi.mocked(paymentsService.rejectBankTransfer).mockResolvedValueOnce({
      success: true,
      message: 'Rejected',
      stockRestored: true,
    });

    render(<BankTransfersQueuePage />);

    await waitFor(() => {
      expect(screen.getByText('Review Slip')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Review Slip'));

    await waitFor(() => {
      expect(screen.getByText('Reject Submission')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Reject Submission'));

    await waitFor(() => {
      expect(screen.getByText('Reason Category (Required)')).toBeDefined();
      expect(screen.getByText('Detailed Explanation for Customer (Required)')).toBeDefined();
    });

    const textarea = screen.getByPlaceholderText('Explain why the deposit could not be verified...');
    fireEvent.change(textarea, {
      target: { value: 'Slip transaction date was more than 7 days ago.' },
    });

    fireEvent.click(screen.getByText('Confirm Rejection'));

    await waitFor(() => {
      expect(paymentsService.rejectBankTransfer).toHaveBeenCalledWith(
        'sub-1',
        expect.objectContaining({
          explanation: 'Slip transaction date was more than 7 days ago.',
        })
      );
    });
  });
});
