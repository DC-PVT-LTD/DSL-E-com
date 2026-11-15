import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentsService } from './payments.service';
import {
  BankDepositStatus,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentAttemptStatus,
  InventoryChangeReason,
} from '../../generated/prisma';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('PaymentsService — Unit Tests', () => {
  let service: PaymentsService;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockInventoryGateway: any;
  let mockPrivateReceiptStorageService: any;

  beforeEach(() => {
    mockPrisma = {
      bankDepositSubmission: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockImplementation(({ data }) => ({ ...data, id: 'sub-1' })),
      },
      order: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalCents: 0 } }),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockImplementation(({ data }) => ({ ...data, id: 'ord-1' })),
      },
      paymentAttempt: {
        update: vi.fn().mockResolvedValue({ id: 'pa-1' }),
      },
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p1', stockQuantity: 5 }),
        update: vi.fn().mockResolvedValue({ id: 'p1' }),
      },
      productVariant: {
        update: vi.fn().mockResolvedValue({ id: 'v1' }),
      },
      inventoryMovement: {
        create: vi.fn().mockResolvedValue({ id: 'im-1' }),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      stockReservationItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };

    mockAuditService = {
      recordAuditLog: vi.fn().mockResolvedValue(true),
    };

    mockInventoryGateway = {
      broadcastStockUpdate: vi.fn(),
    };

    mockPrivateReceiptStorageService = {
      getSecureFilePath: vi.fn().mockReturnValue('/path/to/receipt.pdf'),
    };

    service = new PaymentsService(
      mockPrisma,
      mockAuditService,
      mockInventoryGateway,
      mockPrivateReceiptStorageService
    );
  });

  describe('approveBankTransfer', () => {
    it('successfully approves a pending Bank Transfer, updating order to CONFIRMED and payment to PAID', async () => {
      const mockSubmission = {
        id: 'sub-1',
        orderId: 'ord-1',
        paymentAttemptId: 'pa-1',
        amountCents: 450000,
        referenceNumber: 'TXN-BANK-001',
        status: BankDepositStatus.PENDING,
        order: {
          id: 'ord-1',
          orderNumber: 'DSL-2026-0001',
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          totalCents: 450000,
          paymentStatus: PaymentStatus.PENDING,
          orderStatus: OrderStatus.PENDING,
          notes: 'Customer note',
        },
      };

      mockPrisma.bankDepositSubmission.findUnique.mockResolvedValueOnce(mockSubmission);

      const result = await service.approveBankTransfer(
        'sub-1',
        { adminNotes: 'Verified against ComBank statement 15 Nov' },
        { id: 'admin-1', email: 'admin@dsl.lk' }
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.bankDepositSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({
            status: BankDepositStatus.VERIFIED,
            reviewedById: 'admin-1',
          }),
        })
      );

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          data: expect.objectContaining({
            orderStatus: OrderStatus.CONFIRMED,
            paymentStatus: PaymentStatus.PAID,
            notes: expect.stringContaining('Verified against ComBank statement'),
          }),
        })
      );

      expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pa-1' },
          data: expect.objectContaining({
            status: PaymentAttemptStatus.SUCCEEDED,
          }),
        })
      );

      expect(mockAuditService.recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'APPROVE_BANK_TRANSFER',
          entityId: 'sub-1',
        })
      );
    });

    it('rejects approval if submitted amount does not match order total', async () => {
      const mockSubmission = {
        id: 'sub-1',
        orderId: 'ord-1',
        amountCents: 300000, // Short deposit
        status: BankDepositStatus.PENDING,
        order: {
          id: 'ord-1',
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          totalCents: 450000, // Expected 4500.00
          paymentStatus: PaymentStatus.PENDING,
          orderStatus: OrderStatus.PENDING,
        },
      };

      mockPrisma.bankDepositSubmission.findUnique.mockResolvedValueOnce(mockSubmission);

      await expect(
        service.approveBankTransfer('sub-1', {}, { id: 'admin-1', email: 'admin@dsl.lk' })
      ).rejects.toThrow(BadRequestException);
    });

    it('prevents double approval on already VERIFIED submission', async () => {
      const mockSubmission = {
        id: 'sub-1',
        status: BankDepositStatus.VERIFIED,
        order: {
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          paymentStatus: PaymentStatus.PAID,
        },
      };

      mockPrisma.bankDepositSubmission.findUnique.mockResolvedValueOnce(mockSubmission);

      await expect(
        service.approveBankTransfer('sub-1', {}, { id: 'admin-1', email: 'admin@dsl.lk' })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('rejectBankTransfer', () => {
    it('successfully rejects Bank Transfer, cancels order, and atomically restores stock', async () => {
      const mockSubmission = {
        id: 'sub-1',
        orderId: 'ord-1',
        paymentAttemptId: 'pa-1',
        amountCents: 450000,
        status: BankDepositStatus.PENDING,
        order: {
          id: 'ord-1',
          orderNumber: 'DSL-2026-0001',
          orderStatus: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          notes: 'Customer note',
          items: [{ productId: 'p1', variantId: null, quantity: 2 }],
        },
      };

      mockPrisma.bankDepositSubmission.findUnique.mockResolvedValueOnce(mockSubmission);

      const result = await service.rejectBankTransfer(
        'sub-1',
        {
          category: 'Deposit not found in bank statement',
          explanation: 'No transaction on 2026-11-14 matching LKR 4,500.00',
        },
        { id: 'admin-1', email: 'admin@dsl.lk' }
      );

      expect(result.success).toBe(true);

      // Verify submission marked REJECTED with reason
      expect(mockPrisma.bankDepositSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({
            status: BankDepositStatus.REJECTED,
            rejectionReason: expect.stringContaining('Deposit not found in bank statement'),
          }),
        })
      );

      // Verify order marked CANCELLED and FAILED
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          data: expect.objectContaining({
            orderStatus: OrderStatus.CANCELLED,
            paymentStatus: PaymentStatus.FAILED,
            notes: expect.stringContaining('REJECTED: [Deposit not found in bank statement]'),
          }),
        })
      );

      // Verify stock incremented
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1' },
          data: { stockQuantity: { increment: 2 } },
        })
      );

      // Verify inventory movement created with RESTOCK
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'p1',
            changeAmount: 2,
            reason: InventoryChangeReason.RESTOCK,
          }),
        })
      );

      // Verify Socket.IO broadcast
      expect(mockInventoryGateway.broadcastStockUpdate).toHaveBeenCalled();
    });

    it('prevents rejecting an already VERIFIED payment', async () => {
      const mockSubmission = {
        id: 'sub-1',
        status: BankDepositStatus.VERIFIED,
        order: { orderStatus: OrderStatus.CONFIRMED },
      };

      mockPrisma.bankDepositSubmission.findUnique.mockResolvedValueOnce(mockSubmission);

      await expect(
        service.rejectBankTransfer(
          'sub-1',
          { category: 'Fake receipt', explanation: 'Invalid slip' },
          { id: 'admin-1', email: 'admin@dsl.lk' }
        )
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('exportPaymentsCsv', () => {
    it('escapes CSV cells and neutralizes formula injection attacks', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'ord-1',
          orderNumber: '=cmd|"/C calc"!A0', // Dangerous formula injection
          customerName: '+Malicious Customer',
          customerEmail: 'normal@dsl.lk',
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          totalCents: 150000,
          paymentStatus: PaymentStatus.PENDING,
          orderStatus: OrderStatus.PENDING,
          createdAt: new Date('2026-11-14T10:00:00Z'),
          updatedAt: new Date('2026-11-14T10:00:00Z'),
          bankDepositSubmissions: [{ referenceNumber: '@danger', status: BankDepositStatus.PENDING }],
          paymentAttempts: [],
        },
      ]);
      mockPrisma.order.count.mockResolvedValueOnce(1);

      const csv = await service.exportPaymentsCsv({}, { id: 'admin-1', email: 'admin@dsl.lk' });

      expect(csv).toContain("\"'=cmd"); // Leading single quote prefixed to neutralize formula
      expect(csv).toContain("\"'+Malicious"); // Leading single quote prefixed
      expect(csv).toContain("\"'@danger"); // Leading single quote prefixed
      expect(csv).toContain('"1500.00"');
    });
  });

  describe('getPaymentReconciliationReport', () => {
    it('returns healthy report when database states are consistent', async () => {
      mockPrisma.order.count.mockResolvedValueOnce(50);
      mockPrisma.order.findMany
        .mockResolvedValueOnce([]) // unpaidDeliveredCodOrders
        .mockResolvedValueOnce([]) // activeCardOrders
        .mockResolvedValueOnce([]) // allPaidOrders
        .mockResolvedValueOnce([]) // ordersWithAttempts
        .mockResolvedValueOnce([]) // cancelledOrders
        .mockResolvedValueOnce([]); // multiSubOrders

      mockPrisma.bankDepositSubmission.findMany
        .mockResolvedValueOnce([]) // verifiedSubs
        .mockResolvedValueOnce([]); // rejectedSubmissions

      mockPrisma.inventoryMovement.findMany.mockResolvedValueOnce([]);

      const report = await service.getPaymentReconciliationReport();

      expect(report.healthy).toBe(true);
      expect(report.summary.totalAnomalies).toBe(0);
      expect(report.summary.totalCheckedOrders).toBe(50);
      expect(report.anomalies.length).toBe(0);
    });

    it('detects DELIVERED_COD_UNPAID anomaly', async () => {
      mockPrisma.order.count.mockResolvedValueOnce(1);
      mockPrisma.order.findMany
        .mockResolvedValueOnce([
          {
            id: 'ord-cod-1',
            orderNumber: 'DSL-COD-001',
            orderStatus: OrderStatus.DELIVERED,
            paymentStatus: PaymentStatus.PENDING,
          },
        ]) // unpaidDeliveredCodOrders
        .mockResolvedValueOnce([]) // activeCardOrders
        .mockResolvedValueOnce([]) // allPaidOrders
        .mockResolvedValueOnce([]) // ordersWithAttempts
        .mockResolvedValueOnce([]) // cancelledOrders
        .mockResolvedValueOnce([]); // multiSubOrders

      mockPrisma.bankDepositSubmission.findMany
        .mockResolvedValueOnce([]) // verifiedSubs
        .mockResolvedValueOnce([]); // rejectedSubmissions

      mockPrisma.inventoryMovement.findMany.mockResolvedValueOnce([]);

      const report = await service.getPaymentReconciliationReport();

      expect(report.healthy).toBe(false);
      expect(report.summary.totalAnomalies).toBe(1);
      expect(report.anomalies[0].type).toBe('DELIVERED_COD_UNPAID');
      expect(report.anomalies[0].orderNumber).toBe('DSL-COD-001');
    });

    it('detects VERIFIED_DEPOSIT_UNCONFIRMED_ORDER anomaly', async () => {
      mockPrisma.order.count.mockResolvedValueOnce(1);
      mockPrisma.order.findMany
        .mockResolvedValueOnce([]) // unpaidDeliveredCodOrders
        .mockResolvedValueOnce([]) // activeCardOrders
        .mockResolvedValueOnce([]) // allPaidOrders
        .mockResolvedValueOnce([]) // ordersWithAttempts
        .mockResolvedValueOnce([]) // cancelledOrders
        .mockResolvedValueOnce([]); // multiSubOrders

      mockPrisma.bankDepositSubmission.findMany
        .mockResolvedValueOnce([
          {
            id: 'sub-ver-1',
            status: BankDepositStatus.VERIFIED,
            order: {
              id: 'ord-bt-1',
              orderNumber: 'DSL-BT-001',
              orderStatus: OrderStatus.CANCELLED,
              paymentStatus: PaymentStatus.FAILED,
            },
          },
        ]) // verifiedSubs
        .mockResolvedValueOnce([]); // rejectedSubmissions

      mockPrisma.inventoryMovement.findMany.mockResolvedValueOnce([]);

      const report = await service.getPaymentReconciliationReport();

      expect(report.healthy).toBe(false);
      expect(report.summary.totalAnomalies).toBe(1);
      expect(report.anomalies[0].type).toBe('VERIFIED_DEPOSIT_UNCONFIRMED_ORDER');
    });

    it('detects CONFIRMED_CARD_WITHOUT_SUCCESS_ATTEMPT anomaly', async () => {
      mockPrisma.order.count.mockResolvedValueOnce(1);
      mockPrisma.order.findMany
        .mockResolvedValueOnce([]) // unpaidDeliveredCodOrders
        .mockResolvedValueOnce([
          {
            id: 'ord-card-1',
            orderNumber: 'DSL-CARD-001',
            orderStatus: OrderStatus.CONFIRMED,
            paymentStatus: PaymentStatus.PENDING,
            paymentAttempts: [], // No SUCCEEDED attempts
          },
        ]) // activeCardOrders
        .mockResolvedValueOnce([]) // allPaidOrders
        .mockResolvedValueOnce([]) // ordersWithAttempts
        .mockResolvedValueOnce([]) // cancelledOrders
        .mockResolvedValueOnce([]); // multiSubOrders

      mockPrisma.bankDepositSubmission.findMany
        .mockResolvedValueOnce([]) // verifiedSubs
        .mockResolvedValueOnce([]); // rejectedSubmissions

      mockPrisma.inventoryMovement.findMany.mockResolvedValueOnce([]);

      const report = await service.getPaymentReconciliationReport();

      expect(report.healthy).toBe(false);
      expect(report.summary.totalAnomalies).toBe(1);
      expect(report.anomalies[0].type).toBe('CONFIRMED_CARD_WITHOUT_SUCCESS_ATTEMPT');
    });

    it('detects DUPLICATE_SUCCEEDED_PAYMENT_ATTEMPTS anomaly', async () => {
      mockPrisma.order.count.mockResolvedValueOnce(1);
      mockPrisma.order.findMany
        .mockResolvedValueOnce([]) // unpaidDeliveredCodOrders
        .mockResolvedValueOnce([]) // activeCardOrders
        .mockResolvedValueOnce([]) // allPaidOrders
        .mockResolvedValueOnce([
          {
            id: 'ord-dup-1',
            orderNumber: 'DSL-DUP-001',
            orderStatus: OrderStatus.CONFIRMED,
            paymentStatus: PaymentStatus.PAID,
            paymentAttempts: [
              { id: 'pa-1', status: PaymentAttemptStatus.SUCCEEDED },
              { id: 'pa-2', status: PaymentAttemptStatus.SUCCEEDED },
            ],
          },
        ]) // ordersWithAttempts
        .mockResolvedValueOnce([]) // cancelledOrders
        .mockResolvedValueOnce([]); // multiSubOrders

      mockPrisma.bankDepositSubmission.findMany
        .mockResolvedValueOnce([]) // verifiedSubs
        .mockResolvedValueOnce([]); // rejectedSubmissions

      mockPrisma.inventoryMovement.findMany.mockResolvedValueOnce([]);

      const report = await service.getPaymentReconciliationReport();

      expect(report.healthy).toBe(false);
      expect(report.anomalies.some((a) => a.type === 'DUPLICATE_SUCCEEDED_PAYMENT_ATTEMPTS')).toBe(true);
    });

    it('detects DUPLICATE_RESTOCK_MOVEMENT anomaly', async () => {
      mockPrisma.order.count.mockResolvedValueOnce(1);
      mockPrisma.order.findMany
        .mockResolvedValueOnce([]) // unpaidDeliveredCodOrders
        .mockResolvedValueOnce([]) // activeCardOrders
        .mockResolvedValueOnce([]) // allPaidOrders
        .mockResolvedValueOnce([]) // ordersWithAttempts
        .mockResolvedValueOnce([]) // cancelledOrders
        .mockResolvedValueOnce([]); // multiSubOrders

      mockPrisma.bankDepositSubmission.findMany
        .mockResolvedValueOnce([]) // verifiedSubs
        .mockResolvedValueOnce([]); // rejectedSubmissions

      mockPrisma.inventoryMovement.findMany.mockResolvedValueOnce([
        {
          id: 'mov-1',
          productId: 'prod-pen',
          note: 'Restored stock for cancelled order DSL-2026-999',
          createdAt: new Date(),
        },
        {
          id: 'mov-2',
          productId: 'prod-pen',
          note: 'Restored stock for cancelled order DSL-2026-999',
          createdAt: new Date(),
        },
      ]);

      const report = await service.getPaymentReconciliationReport();

      expect(report.healthy).toBe(false);
      expect(report.anomalies.some((a) => a.type === 'DUPLICATE_RESTOCK_MOVEMENT')).toBe(true);
    });

    describe('PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT evidence validation', () => {
      const mockReconciliationQueries = (paidOrders: any[]) => {
        mockPrisma.order.count.mockResolvedValueOnce(paidOrders.length);
        mockPrisma.order.findMany
          .mockResolvedValueOnce([]) // 1. unpaidDeliveredCodOrders
          .mockResolvedValueOnce([]) // 3. activeCardOrders
          .mockResolvedValueOnce(paidOrders) // 4. allPaidOrders
          .mockResolvedValueOnce([]) // 5. ordersWithAttempts
          .mockResolvedValueOnce([]) // 8. cancelledOrders
          .mockResolvedValueOnce([]); // 9. multiSubOrders

        mockPrisma.bankDepositSubmission.findMany
          .mockResolvedValueOnce([]) // 2. verifiedSubs
          .mockResolvedValueOnce([]); // 7. rejectedSubmissions

        mockPrisma.inventoryMovement.findMany.mockResolvedValueOnce([]); // 6. restockMovements
      };

      it('PayHere: flags PAID order with only FAILED attempts', async () => {
        mockReconciliationQueries([
          {
            id: 'ord-pay-1',
            orderNumber: 'DSL-PAY-001',
            paymentMethod: PaymentMethod.CARD_PAYHERE,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.CONFIRMED,
            paymentAttempts: [{ id: 'pa-1', status: PaymentAttemptStatus.FAILED }],
            bankDepositSubmissions: [],
          },
        ]);

        const report = await service.getPaymentReconciliationReport();
        expect(report.healthy).toBe(false);
        const anomaly = report.anomalies.find((a) => a.type === 'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
        expect(anomaly).toBeDefined();
        expect(anomaly?.orderNumber).toBe('DSL-PAY-001');
      });

      it('PayHere: flags PAID order with only PROCESSING attempts', async () => {
        mockReconciliationQueries([
          {
            id: 'ord-pay-2',
            orderNumber: 'DSL-PAY-002',
            paymentMethod: PaymentMethod.CARD_PAYHERE,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.CONFIRMED,
            paymentAttempts: [{ id: 'pa-2', status: PaymentAttemptStatus.PROCESSING }],
            bankDepositSubmissions: [],
          },
        ]);

        const report = await service.getPaymentReconciliationReport();
        expect(report.healthy).toBe(false);
        const anomaly = report.anomalies.find((a) => a.type === 'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
        expect(anomaly).toBeDefined();
        expect(anomaly?.orderNumber).toBe('DSL-PAY-002');
      });

      it('PayHere: does NOT flag PAID order with at least one SUCCEEDED attempt', async () => {
        mockReconciliationQueries([
          {
            id: 'ord-pay-3',
            orderNumber: 'DSL-PAY-003',
            paymentMethod: PaymentMethod.CARD_PAYHERE,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.CONFIRMED,
            paymentAttempts: [{ id: 'pa-3', status: PaymentAttemptStatus.SUCCEEDED }],
            bankDepositSubmissions: [],
          },
        ]);

        const report = await service.getPaymentReconciliationReport();
        const anomaly = report.anomalies.find((a) => a.type === 'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
        expect(anomaly).toBeUndefined();
      });

      it('PayHere: does NOT flag PAID order with both FAILED and SUCCEEDED attempts', async () => {
        mockReconciliationQueries([
          {
            id: 'ord-pay-4',
            orderNumber: 'DSL-PAY-004',
            paymentMethod: PaymentMethod.CARD_PAYHERE,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.CONFIRMED,
            paymentAttempts: [
              { id: 'pa-4a', status: PaymentAttemptStatus.FAILED },
              { id: 'pa-4b', status: PaymentAttemptStatus.SUCCEEDED },
            ],
            bankDepositSubmissions: [],
          },
        ]);

        const report = await service.getPaymentReconciliationReport();
        const anomaly = report.anomalies.find((a) => a.type === 'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
        expect(anomaly).toBeUndefined();
      });

      it('Bank Transfer: flags PAID order with only PENDING submissions', async () => {
        mockReconciliationQueries([
          {
            id: 'ord-bt-1',
            orderNumber: 'DSL-BT-001',
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.CONFIRMED,
            paymentAttempts: [],
            bankDepositSubmissions: [{ id: 'sub-1', status: BankDepositStatus.PENDING }],
          },
        ]);

        const report = await service.getPaymentReconciliationReport();
        expect(report.healthy).toBe(false);
        const anomaly = report.anomalies.find((a) => a.type === 'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
        expect(anomaly).toBeDefined();
        expect(anomaly?.orderNumber).toBe('DSL-BT-001');
      });

      it('Bank Transfer: flags PAID order with only REJECTED submissions', async () => {
        mockReconciliationQueries([
          {
            id: 'ord-bt-2',
            orderNumber: 'DSL-BT-002',
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.CONFIRMED,
            paymentAttempts: [],
            bankDepositSubmissions: [{ id: 'sub-2', status: BankDepositStatus.REJECTED }],
          },
        ]);

        const report = await service.getPaymentReconciliationReport();
        expect(report.healthy).toBe(false);
        const anomaly = report.anomalies.find((a) => a.type === 'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
        expect(anomaly).toBeDefined();
        expect(anomaly?.orderNumber).toBe('DSL-BT-002');
      });

      it('Bank Transfer: does NOT flag PAID order with at least one VERIFIED submission', async () => {
        mockReconciliationQueries([
          {
            id: 'ord-bt-3',
            orderNumber: 'DSL-BT-003',
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.CONFIRMED,
            paymentAttempts: [],
            bankDepositSubmissions: [{ id: 'sub-3', status: BankDepositStatus.VERIFIED }],
          },
        ]);

        const report = await service.getPaymentReconciliationReport();
        const anomaly = report.anomalies.find((a) => a.type === 'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
        expect(anomaly).toBeUndefined();
      });

      it('Bank Transfer: does NOT flag PAID order with PENDING and VERIFIED submissions', async () => {
        mockReconciliationQueries([
          {
            id: 'ord-bt-4',
            orderNumber: 'DSL-BT-004',
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.CONFIRMED,
            paymentAttempts: [],
            bankDepositSubmissions: [
              { id: 'sub-4a', status: BankDepositStatus.PENDING },
              { id: 'sub-4b', status: BankDepositStatus.VERIFIED },
            ],
          },
        ]);

        const report = await service.getPaymentReconciliationReport();
        const anomaly = report.anomalies.find((a) => a.type === 'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
        expect(anomaly).toBeUndefined();
      });

      it('COD: does NOT flag PAID COD order with DELIVERED status', async () => {
        mockReconciliationQueries([
          {
            id: 'ord-cod-1',
            orderNumber: 'DSL-COD-001',
            paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.DELIVERED,
            paymentAttempts: [],
            bankDepositSubmissions: [],
          },
        ]);

        const report = await service.getPaymentReconciliationReport();
        const anomaly = report.anomalies.find((a) => a.type === 'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
        expect(anomaly).toBeUndefined();
      });

      it('COD: flags PAID COD order with non-DELIVERED status', async () => {
        mockReconciliationQueries([
          {
            id: 'ord-cod-2',
            orderNumber: 'DSL-COD-002',
            paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.CONFIRMED,
            paymentAttempts: [],
            bankDepositSubmissions: [],
          },
        ]);

        const report = await service.getPaymentReconciliationReport();
        expect(report.healthy).toBe(false);
        const anomaly = report.anomalies.find((a) => a.type === 'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
        expect(anomaly).toBeDefined();
        expect(anomaly?.orderNumber).toBe('DSL-COD-002');
      });

      it('Flags orders with no related payment records', async () => {
        mockReconciliationQueries([
          {
            id: 'ord-empty-card',
            orderNumber: 'DSL-EMPTY-001',
            paymentMethod: PaymentMethod.CARD_PAYHERE,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.CONFIRMED,
            paymentAttempts: [],
            bankDepositSubmissions: [],
          },
          {
            id: 'ord-empty-bank',
            orderNumber: 'DSL-EMPTY-002',
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.CONFIRMED,
            paymentAttempts: [],
            bankDepositSubmissions: [],
          },
        ]);

        const report = await service.getPaymentReconciliationReport();
        expect(report.healthy).toBe(false);
        const cardAnomaly = report.anomalies.find((a) => a.orderNumber === 'DSL-EMPTY-001');
        const bankAnomaly = report.anomalies.find((a) => a.orderNumber === 'DSL-EMPTY-002');
        expect(cardAnomaly?.type).toBe('PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
        expect(bankAnomaly?.type).toBe('PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
      });

      it('Handles multiple related attempts and submissions correctly', async () => {
        mockReconciliationQueries([
          {
            id: 'ord-multi-card',
            orderNumber: 'DSL-MULTI-001',
            paymentMethod: PaymentMethod.CARD_PAYHERE,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.CONFIRMED,
            paymentAttempts: [
              { id: 'pa-m1', status: PaymentAttemptStatus.FAILED },
              { id: 'pa-m2', status: PaymentAttemptStatus.PROCESSING },
              { id: 'pa-m3', status: PaymentAttemptStatus.SUCCEEDED },
            ],
            bankDepositSubmissions: [],
          },
          {
            id: 'ord-multi-bt',
            orderNumber: 'DSL-MULTI-002',
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.CONFIRMED,
            paymentAttempts: [],
            bankDepositSubmissions: [
              { id: 'sub-m1', status: BankDepositStatus.REJECTED },
              { id: 'sub-m2', status: BankDepositStatus.PENDING },
              { id: 'sub-m3', status: BankDepositStatus.VERIFIED },
            ],
          },
        ]);

        const report = await service.getPaymentReconciliationReport();
        const anomalies = report.anomalies.filter((a) => a.type === 'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
        expect(anomalies.length).toBe(0);
      });

      it('Flags unsupported or unknown payment methods safely without crashing', async () => {
        mockReconciliationQueries([
          {
            id: 'ord-unknown-1',
            orderNumber: 'DSL-UNK-001',
            paymentMethod: 'CRYPTO' as any,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.CONFIRMED,
            paymentAttempts: [],
            bankDepositSubmissions: [],
          },
        ]);

        const report = await service.getPaymentReconciliationReport();
        expect(report.healthy).toBe(false);
        const anomaly = report.anomalies.find((a) => a.type === 'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
        expect(anomaly).toBeDefined();
        expect(anomaly?.orderNumber).toBe('DSL-UNK-001');
      });
    });
  });
});
