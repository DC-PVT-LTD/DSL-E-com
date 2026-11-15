import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paymentsService } from '../paymentsService';
import { apiClient } from '@/lib/api/apiClient';

describe('paymentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSummary', () => {
    it('calls GET /admin/payments/summary and returns summary data', async () => {
      const mockSummary = {
        totalPaidVolumeCents: 500000,
        totalTransactions: 25,
        bankTransfers: {
          pending: 3,
          verified: 12,
          rejected: 2,
          totalVolumeCents: 240000,
        },
        payhereCards: {
          succeeded: 8,
          pending: 1,
          failed: 1,
          totalVolumeCents: 160000,
        },
        cashOnDelivery: {
          pendingCollection: 5,
          deliveredPaid: 5,
          totalVolumeCents: 100000,
        },
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        success: true,
        data: mockSummary,
      } as any);

      const result = await paymentsService.getSummary();
      expect(getSpy).toHaveBeenCalledWith('/admin/payments/summary', { params: undefined });
      expect(result.totalPaidVolumeCents).toBe(500000);
      expect(result.bankTransfers.verified).toBe(12);
    });
  });

  describe('getTransactions', () => {
    it('calls GET /admin/payments/transactions with query parameters', async () => {
      const mockResult = {
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
            customerName: 'Kamal Perera',
            customerEmail: 'kamal@dsl.lk',
            customerPhone: '0771234567',
            createdAt: '2026-11-14T10:00:00.000Z',
            paidAt: '2026-11-14T11:00:00.000Z',
            bankTransferDetails: {
              submissionId: 'sub-1',
              status: 'VERIFIED',
              referenceNumber: 'REF1234',
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

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockResult as any);

      const result = await paymentsService.getTransactions({
        page: 1,
        paymentMethod: 'BANK_TRANSFER',
      });

      expect(getSpy).toHaveBeenCalledWith('/admin/payments/transactions', {
        params: { page: 1, paymentMethod: 'BANK_TRANSFER' },
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0].orderNumber).toBe('DSL-2026-0001');
    });
  });

  describe('getBankTransfers', () => {
    it('calls GET /admin/payments/bank-transfers and returns paginated queue', async () => {
      const mockQueue = {
        success: true,
        data: [
          {
            id: 'sub-100',
            orderId: 'ord-100',
            referenceNumber: 'TX9988',
            depositDate: '2026-11-14',
            amountCents: 150000,
            status: 'PENDING',
            rejectionReason: null,
            reviewedById: null,
            reviewedAt: null,
            createdAt: '2026-11-14T12:00:00.000Z',
            order: {
              id: 'ord-100',
              orderNumber: 'DSL-2026-100',
              totalAmountCents: 150000,
              orderStatus: 'PENDING',
              paymentStatus: 'PENDING',
              createdAt: '2026-11-14T12:00:00.000Z',
              customer: {
                id: 'cust-1',
                name: 'Nimal Silva',
                email: 'nimal@dsl.lk',
                phone: '0712345678',
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

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockQueue as any);

      const result = await paymentsService.getBankTransfers({ status: 'PENDING' });
      expect(getSpy).toHaveBeenCalledWith('/admin/payments/bank-transfers', {
        params: { status: 'PENDING' },
      });
      expect(result.data[0].status).toBe('PENDING');
    });
  });

  describe('approveBankTransfer', () => {
    it('calls POST /admin/payments/bank-transfers/:id/approve', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        success: true,
        data: { success: true, message: 'Bank transfer verified' },
      } as any);

      const res = await paymentsService.approveBankTransfer('sub-100', {
        adminNotes: 'Verified on statement',
      });

      expect(postSpy).toHaveBeenCalledWith('/admin/payments/bank-transfers/sub-100/approve', {
        adminNotes: 'Verified on statement',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('rejectBankTransfer', () => {
    it('calls POST /admin/payments/bank-transfers/:id/reject with mandatory category and explanation', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        success: true,
        data: { success: true, message: 'Bank transfer rejected', stockRestored: true },
      } as any);

      const res = await paymentsService.rejectBankTransfer('sub-100', {
        category: 'REFERENCE_NOT_FOUND',
        explanation: 'Reference TX9988 does not appear on statement.',
      });

      expect(postSpy).toHaveBeenCalledWith('/admin/payments/bank-transfers/sub-100/reject', {
        category: 'REFERENCE_NOT_FOUND',
        explanation: 'Reference TX9988 does not appear on statement.',
      });
      expect(res.stockRestored).toBe(true);
    });
  });

  describe('getReceiptFileUrl', () => {
    it('constructs authorized receipt file stream URL', () => {
      vi.spyOn(apiClient, 'getBaseUrl').mockReturnValueOnce('http://localhost:4000/api/v1');
      const url = paymentsService.getReceiptFileUrl('sub-100');
      expect(url).toBe('http://localhost:4000/api/v1/checkout/bank-receipt/sub-100');
    });
  });

  describe('getReconciliationReport', () => {
    it('calls GET /admin/payments/reconciliation-report', async () => {
      const mockReport = {
        summary: {
          totalCheckedOrders: 50,
          totalAnomalies: 0,
          healthy: true,
        },
        anomalies: [],
        checkedAt: '2026-11-14T12:00:00.000Z',
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        success: true,
        data: mockReport,
      } as any);

      const res = await paymentsService.getReconciliationReport();
      expect(getSpy).toHaveBeenCalledWith('/admin/payments/reconciliation-report');
      expect(res.summary.healthy).toBe(true);
      expect(res.anomalies.length).toBe(0);
    });
  });
});
