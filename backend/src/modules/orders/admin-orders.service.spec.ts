import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminOrdersService } from './admin-orders.service';
import { OrderStatus, PaymentStatus, ReturnStatus, ReturnItemStatus, InventoryChangeReason, RefundStatus, PaymentMethod, PaymentAttemptStatus } from '../../generated/prisma';
import { BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('AdminOrdersService', () => {
  let service: AdminOrdersService;
  let mockPrisma: any;
  let mockOrdersGateway: any;
  let mockInventoryGateway: any;
  let mockNotificationsService: any;

  beforeEach(() => {
    mockPrisma = {
      order: {
        count: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      orderAuditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      orderNote: {
        create: vi.fn(),
      },
      orderAddressSnapshot: {
        upsert: vi.fn(),
      },
      orderItem: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      orderReturnRequest: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      orderReturnItem: {
        updateMany: vi.fn(),
      },
      paymentAttempt: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      refundRecord: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amountCents: 0 } }),
        update: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      productVariant: {
        update: vi.fn(),
      },
      inventoryMovement: {
        create: vi.fn(),
        findFirst: vi.fn(),
      },
      storeSettings: {
        findUnique: vi.fn().mockResolvedValue({
          flatDeliveryFeeCents: 35000,
          freeDeliveryThresholdCents: 500000,
        }),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      $queryRaw: vi.fn().mockImplementation(async (strings: TemplateStringsArray, ...values: any[]) => {
        const sql = Array.isArray(strings) ? strings.join('') : String(strings);
        if (sql.includes('"Order"')) {
          return [{
            id: values[0] || 'ord-deliv-default',
            orderNumber: 'DSL-2026-1001',
            orderStatus: OrderStatus.DELIVERED,
            paymentStatus: PaymentStatus.PAID,
            paymentMethod: 'CARD_PAYHERE',
            totalCents: 100000,
            paidAt: new Date(),
            paymentProofUrl: null,
            bankReference: null,
          }];
        }
        return [{ id: 'mock-id', orderStatus: OrderStatus.DELIVERED, stockQuantity: 20 }];
      }),
    };

    mockOrdersGateway = {
      broadcastOrderEvent: vi.fn(),
    };

    mockInventoryGateway = {
      broadcastStockUpdate: vi.fn(),
    };

    mockNotificationsService = {
      sendOrderStatusUpdate: vi.fn().mockResolvedValue({ success: true }),
      sendPaymentOutcome: vi.fn().mockResolvedValue({ success: true }),
      sendReturnStatusUpdate: vi.fn().mockResolvedValue({ success: true }),
      sendRefundNotification: vi.fn().mockResolvedValue({ success: true }),
    };

    service = new AdminOrdersService(
      mockPrisma,
      mockOrdersGateway,
      mockInventoryGateway,
      mockNotificationsService
    );
  });

  describe('getOrderStats', () => {
    it('aggregates order counts and total revenue accurately', async () => {
      mockPrisma.order.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(5)  // pending
        .mockResolvedValueOnce(10) // confirmed
        .mockResolvedValueOnce(15) // processing
        .mockResolvedValueOnce(5)  // packed
        .mockResolvedValueOnce(8)  // shipped
        .mockResolvedValueOnce(5)  // delivered
        .mockResolvedValueOnce(2); // cancelled

      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { totalCents: 25000000 },
      });

      const stats = await service.getOrderStats();

      expect(stats.total).toBe(50);
      expect(stats.pending).toBe(5);
      expect(stats.confirmed).toBe(10);
      expect(stats.processing).toBe(15);
      expect(stats.packed).toBe(5);
      expect(stats.shipped).toBe(8);
      expect(stats.delivered).toBe(5);
      expect(stats.cancelled).toBe(2);
      expect(stats.totalRevenueCents).toBe(25000000);
    });
  });

  describe('updateStatus', () => {
    it('allows valid status transition PROCESSING -> PACKED', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'DSL-2026-1001',
        orderStatus: OrderStatus.PROCESSING,
        customerEmail: 'cust@dsl.lk',
        customerName: 'Test Customer',
        totalCents: 5000,
        items: [],
      };
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue({
        ...mockOrder,
        orderStatus: OrderStatus.PACKED,
      });

      const res = await service.updateStatus(
        'ord-1',
        { status: OrderStatus.PACKED },
        { id: 'admin-1', name: 'Admin One' }
      );

      expect(res.orderStatus).toBe(OrderStatus.PACKED);
      expect(mockPrisma.orderAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STATUS_CHANGE',
            previousValue: OrderStatus.PROCESSING,
            newValue: OrderStatus.PACKED,
          }),
        })
      );
      expect(mockOrdersGateway.broadcastOrderEvent).toHaveBeenCalledWith(
        'order.status.updated',
        expect.objectContaining({ orderId: 'ord-1' })
      );
    });

    it('rejects invalid status transition DELIVERED -> PENDING', async () => {
      const mockOrder = {
        id: 'ord-2',
        orderNumber: 'DSL-2026-1002',
        orderStatus: OrderStatus.DELIVERED,
      };
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.updateStatus('ord-2', { status: OrderStatus.PENDING })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateCustomerInfo', () => {
    it('updates customer contact details without altering user record and creates audit log', async () => {
      const mockOrder = {
        id: 'ord-3',
        orderNumber: 'DSL-2026-1003',
        customerName: 'Old Name',
        customerEmail: 'old@test.com',
        customerPhone: '0771111111',
      };
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue({
        ...mockOrder,
        customerName: 'New Name',
        customerEmail: 'new@test.com',
        customerPhone: '0772222222',
      });

      const res = await service.updateCustomerInfo(
        'ord-3',
        { customerName: 'New Name', customerEmail: 'new@test.com', customerPhone: '0772222222' },
        { id: 'admin-1', name: 'Admin One' }
      );

      expect(res.customerName).toBe('New Name');
      expect(mockPrisma.orderAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CUSTOMER_UPDATE',
          }),
        })
      );
      expect(mockOrdersGateway.broadcastOrderEvent).toHaveBeenCalledWith(
        'order.customer.updated',
        expect.anything()
      );
    });
  });

  describe('cancelOrder', () => {
    it('cancels order, restores inventory, and records refund in REQUESTED status if requested', async () => {
      const mockOrder = {
        id: 'ord-4',
        orderNumber: 'DSL-2026-1004',
        orderStatus: OrderStatus.PROCESSING,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.CARD_PAYHERE,
        totalCents: 450000,
        paidAt: new Date(),
        customerEmail: 'cust@dsl.lk',
        customerName: 'Customer Four',
        items: [{ id: 'it-1', productId: 'prod-1', quantity: 2 }],
      };
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
        const sql = Array.isArray(strings) ? strings.join('') : String(strings);
        if (sql.includes('"Order"')) {
          return [mockOrder];
        }
        return [{ id: 'prod-1', stockQuantity: 10 }];
      });
      mockPrisma.paymentAttempt.findMany.mockResolvedValue([
        { id: 'pa-1', status: 'SUCCEEDED', amountCents: 450000, gatewayReference: 'PAY-4' },
      ]);
      mockPrisma.refundRecord.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } });
      mockPrisma.refundRecord.create.mockResolvedValue({
        id: 'ref-cancel-4',
        orderId: 'ord-4',
        amountCents: 450000,
        status: RefundStatus.REQUESTED,
      });
      mockPrisma.order.update.mockResolvedValue({
        ...mockOrder,
        orderStatus: OrderStatus.CANCELLED,
      });

      const res = await service.cancelOrder(
        'ord-4',
        { reason: 'Customer changed mind', restoreInventory: true, processRefund: true },
        { id: 'admin-1', name: 'Admin One' }
      );

      expect(res.orderStatus).toBe(OrderStatus.CANCELLED);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stockQuantity: { increment: 2 } },
      });
      expect(mockPrisma.refundRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'ord-4',
            amountCents: 450000,
            status: RefundStatus.REQUESTED,
            idempotencyKey: 'cancel-ord-4',
          }),
        })
      );
      expect(mockOrdersGateway.broadcastOrderEvent).toHaveBeenCalledWith(
        'order.cancelled',
        expect.anything()
      );
    });

    it('rejects cancellation if order is already DELIVERED', async () => {
      const deliveredOrder = {
        id: 'ord-deliv',
        orderNumber: 'DSL-2026-DELIV',
        orderStatus: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.CARD_PAYHERE,
        totalCents: 450000,
      };
      mockPrisma.order.findUnique.mockResolvedValue(deliveredOrder);
      mockPrisma.$queryRaw.mockResolvedValue([deliveredOrder]);

      await expect(
        service.cancelOrder(
          'ord-deliv',
          { reason: 'Too late', restoreInventory: true, processRefund: false },
          { id: 'admin-1', name: 'Admin' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects refund on cancellation for COD orders', async () => {
      const codOrder = {
        id: 'ord-cod',
        orderNumber: 'DSL-2026-COD',
        orderStatus: OrderStatus.PROCESSING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        totalCents: 200000,
        items: [],
      };
      mockPrisma.order.findUnique.mockResolvedValue(codOrder);
      mockPrisma.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
        const sql = Array.isArray(strings) ? strings.join('') : String(strings);
        if (sql.includes('"Order"')) return [codOrder];
        return [];
      });

      await expect(
        service.cancelOrder(
          'ord-cod',
          { reason: 'Cancel COD', restoreInventory: false, processRefund: true },
          { id: 'admin-1', name: 'Admin' }
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refund management and safety', () => {
    describe('processRefund', () => {
      it('validates refund amount does not exceed available balance', async () => {
        const mockOrder = {
          id: 'ord-5',
          orderNumber: 'DSL-2026-1005',
          orderStatus: OrderStatus.PROCESSING,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.CARD_PAYHERE,
          totalCents: 100000,
        };
        mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
        mockPrisma.$queryRaw.mockResolvedValue([mockOrder]);
        mockPrisma.paymentAttempt.findMany.mockResolvedValue([
          { id: 'pa-5', status: 'SUCCEEDED', amountCents: 100000, gatewayReference: 'PAY-5' },
        ]);
        mockPrisma.refundRecord.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } });

        await expect(
          service.processRefund(
            'ord-5',
            {
              amountCents: 150000, // Exceeds balance of 100000
              method: 'CARD_PAYHERE',
              reason: 'Excessive refund attempt',
              idempotencyKey: 'idem-excess',
            },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);
      });

      it('creates refund record in REQUESTED status with idempotencyKey and hash', async () => {
        const mockOrder = {
          id: 'ord-5',
          orderNumber: 'DSL-2026-1005',
          orderStatus: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.CARD_PAYHERE,
          totalCents: 100000,
          customerEmail: 'test@dsl.lk',
          customerName: 'Cust Five',
        };
        mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
        mockPrisma.$queryRaw.mockResolvedValue([mockOrder]);
        mockPrisma.paymentAttempt.findMany.mockResolvedValue([
          { id: 'pa-5', status: 'SUCCEEDED', amountCents: 100000, gatewayReference: 'PAY-5' },
        ]);
        mockPrisma.refundRecord.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } });
        mockPrisma.refundRecord.findFirst.mockResolvedValue(null);
        mockPrisma.refundRecord.create.mockResolvedValue({
          id: 'ref-1',
          orderId: 'ord-5',
          amountCents: 50000,
          status: RefundStatus.REQUESTED,
          idempotencyKey: 'idem-valid-1',
        });

        const refund = await service.processRefund(
          'ord-5',
          {
            amountCents: 50000,
            method: 'CARD_PAYHERE',
            reason: 'Customer requested partial refund',
            idempotencyKey: 'idem-valid-1',
          },
          { id: 'admin-1', name: 'Admin' }
        );

        expect(refund.id).toBe('ref-1');
        expect(mockPrisma.refundRecord.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              orderId: 'ord-5',
              amountCents: 50000,
              status: RefundStatus.REQUESTED,
              idempotencyKey: 'idem-valid-1',
            }),
          })
        );
      });

      it('replays existing refund when same idempotencyKey and same payload are provided', async () => {
        const mockOrder = {
          id: 'ord-5',
          orderNumber: 'DSL-2026-1005',
          orderStatus: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.CARD_PAYHERE,
          totalCents: 100000,
        };
        mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
        mockPrisma.$queryRaw.mockResolvedValue([mockOrder]);
        mockPrisma.paymentAttempt.findMany.mockResolvedValue([
          { id: 'pa-5', status: 'SUCCEEDED', amountCents: 100000, gatewayReference: 'PAY-5' },
        ]);
        mockPrisma.refundRecord.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } });

        const dto = {
          amountCents: 50000,
          method: 'CARD_PAYHERE' as const,
          reason: 'Duplicate check',
          idempotencyKey: 'idem-replay-1',
        };
        const expectedHash = (service as any).computeRefundPayloadHash(dto);
        const existingRecord = {
          id: 'ref-existing',
          orderId: 'ord-5',
          amountCents: 50000,
          status: RefundStatus.REQUESTED,
          idempotencyKey: 'idem-replay-1',
          payloadHash: expectedHash,
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(existingRecord);
        mockPrisma.refundRecord.findFirst.mockResolvedValue(existingRecord);

        const result = await service.processRefund('ord-5', dto, { id: 'admin-1', name: 'Admin' });
        expect(result.id).toBe('ref-existing');
        expect(mockPrisma.refundRecord.create).not.toHaveBeenCalled();
      });

      it('throws 409 ConflictException when same idempotencyKey is used with different payload', async () => {
        const mockOrder = {
          id: 'ord-5',
          orderNumber: 'DSL-2026-1005',
          orderStatus: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.CARD_PAYHERE,
          totalCents: 100000,
        };
        mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
        mockPrisma.$queryRaw.mockResolvedValue([mockOrder]);
        mockPrisma.paymentAttempt.findMany.mockResolvedValue([
          { id: 'pa-5', status: 'SUCCEEDED', amountCents: 100000, gatewayReference: 'PAY-5' },
        ]);
        mockPrisma.refundRecord.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } });

        const existingRecord = {
          id: 'ref-existing',
          orderId: 'ord-5',
          amountCents: 50000,
          status: RefundStatus.REQUESTED,
          idempotencyKey: 'idem-conflict',
          payloadHash: 'hash-original',
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(existingRecord);
        mockPrisma.refundRecord.findFirst.mockResolvedValue(existingRecord);

        await expect(
          service.processRefund(
            'ord-5',
            {
              amountCents: 75000, // Different amount
              method: 'CARD_PAYHERE',
              reason: 'Conflicting payload',
              idempotencyKey: 'idem-conflict',
            },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(ConflictException);
      });

      it('rejects refund request for COD orders', async () => {
        const codOrder = {
          id: 'ord-cod-ref',
          orderNumber: 'DSL-2026-COD-REF',
          orderStatus: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          totalCents: 100000,
        };
        mockPrisma.order.findUnique.mockResolvedValue(codOrder);
        mockPrisma.$queryRaw.mockResolvedValue([codOrder]);

        await expect(
          service.processRefund(
            'ord-cod-ref',
            {
              amountCents: 50000,
              method: 'BANK_TRANSFER',
              reason: 'Refund COD attempt',
              idempotencyKey: 'idem-cod',
            },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('refund lifecycle transitions', () => {
      it('approveRefund transitions REQUESTED -> APPROVED', async () => {
        const mockRefund = {
          id: 'ref-appr',
          orderId: 'ord-appr',
          requestedById: 'admin-req',
          status: RefundStatus.REQUESTED,
          amountCents: 50000,
          order: { id: 'ord-appr', orderNumber: 'DSL-2026-APPR' },
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(mockRefund);
        mockPrisma.refundRecord.update.mockResolvedValue({
          ...mockRefund,
          status: RefundStatus.APPROVED,
          approvedById: 'admin-1',
          approvedAt: new Date(),
        });

        const res = await service.approveRefund('ord-appr', 'ref-appr', {}, { id: 'admin-1', name: 'Admin' });
        expect(res.status).toBe(RefundStatus.APPROVED);
        expect(mockPrisma.refundRecord.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'ref-appr' },
            data: expect.objectContaining({ status: RefundStatus.APPROVED, approvedById: 'admin-1' }),
          })
        );
      });

      it('processRefundExecution transitions APPROVED -> PROCESSING', async () => {
        const mockRefund = {
          id: 'ref-proc',
          orderId: 'ord-proc',
          requestedById: 'admin-req',
          approvedById: 'admin-approver',
          status: RefundStatus.APPROVED,
          amountCents: 50000,
          order: { id: 'ord-proc', orderNumber: 'DSL-2026-PROC' },
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(mockRefund);
        mockPrisma.refundRecord.update.mockResolvedValue({
          ...mockRefund,
          status: RefundStatus.PROCESSING,
          processedAt: new Date(),
        });

        const res = await service.processRefundExecution('ord-proc', 'ref-proc', {}, { id: 'admin-1', name: 'Admin' });
        expect(res.status).toBe(RefundStatus.PROCESSING);
      });

      it('completeRefund requires externalReference and transitions PROCESSING -> COMPLETED', async () => {
        const mockRefund = {
          id: 'ref-comp',
          orderId: 'ord-comp',
          requestedById: 'admin-req',
          approvedById: 'admin-approver',
          status: RefundStatus.PROCESSING,
          amountCents: 50000,
          order: { id: 'ord-comp', orderNumber: 'DSL-2026-COMP', totalCents: 50000 },
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(mockRefund);
        mockPrisma.refundRecord.update.mockResolvedValue({
          ...mockRefund,
          status: RefundStatus.COMPLETED,
          completedById: 'admin-1',
          externalReference: 'EXT-GATEWAY-123',
        });
        mockPrisma.refundRecord.aggregate.mockResolvedValue({ _sum: { amountCents: 50000 } });
        mockPrisma.$queryRaw.mockResolvedValue([
          {
            id: 'ord-comp',
            orderNumber: 'DSL-2026-COMP',
            totalCents: 50000,
            paymentStatus: PaymentStatus.PAID,
            customerEmail: 'c@dsl.lk',
            customerName: 'Customer',
          },
        ]);
        mockPrisma.order.findUnique.mockResolvedValue({
          id: 'ord-comp',
          orderNumber: 'DSL-2026-COMP',
          totalCents: 50000,
          customerEmail: 'c@dsl.lk',
          customerName: 'Customer',
        });

        // Fails when externalReference is missing
        await expect(
          service.completeRefund('ord-comp', 'ref-comp', { externalReference: '' }, { id: 'admin-1', name: 'Admin' })
        ).rejects.toThrow(BadRequestException);

        // Succeeds with valid externalReference
        const res = await service.completeRefund(
          'ord-comp',
          'ref-comp',
          { externalReference: 'EXT-GATEWAY-123' },
          { id: 'admin-1', name: 'Admin' }
        );
        expect(res.status).toBe(RefundStatus.COMPLETED);
        expect(mockPrisma.order.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'ord-comp' },
            data: { paymentStatus: PaymentStatus.REFUNDED },
          })
        );
      });

      it('completeRefund sets PARTIALLY_REFUNDED if cumulative completed refunds are less than order total', async () => {
        const mockRefund = {
          id: 'ref-part',
          orderId: 'ord-part',
          requestedById: 'admin-req',
          approvedById: 'admin-approver',
          status: RefundStatus.PROCESSING,
          amountCents: 30000,
          order: { id: 'ord-part', orderNumber: 'DSL-2026-PART', totalCents: 100000 },
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(mockRefund);
        mockPrisma.refundRecord.update.mockResolvedValue({
          ...mockRefund,
          status: RefundStatus.COMPLETED,
          completedById: 'admin-1',
          externalReference: 'EXT-PART-456',
        });
        mockPrisma.refundRecord.aggregate.mockResolvedValue({ _sum: { amountCents: 30000 } });
        mockPrisma.$queryRaw.mockResolvedValue([
          {
            id: 'ord-part',
            orderNumber: 'DSL-2026-PART',
            totalCents: 100000,
            paymentStatus: PaymentStatus.PAID,
            customerEmail: 'c@dsl.lk',
            customerName: 'Customer',
          },
        ]);
        mockPrisma.order.findUnique.mockResolvedValue({
          id: 'ord-part',
          orderNumber: 'DSL-2026-PART',
          totalCents: 100000,
          customerEmail: 'c@dsl.lk',
          customerName: 'Customer',
        });

        await service.completeRefund(
          'ord-part',
          'ref-part',
          { externalReference: 'EXT-PART-456' },
          { id: 'admin-1', name: 'Admin' }
        );

        expect(mockPrisma.order.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'ord-part' },
            data: { paymentStatus: PaymentStatus.PARTIALLY_REFUNDED },
          })
        );
      });

      it('rejectRefund transitions REQUESTED to REJECTED and saves rejectionReason', async () => {
        const mockRefund = {
          id: 'ref-rej',
          orderId: 'ord-rej',
          status: RefundStatus.REQUESTED,
          amountCents: 40000,
          order: { id: 'ord-rej', orderNumber: 'DSL-2026-REJ' },
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(mockRefund);
        mockPrisma.refundRecord.update.mockResolvedValue({
          ...mockRefund,
          status: RefundStatus.REJECTED,
          rejectionReason: 'Invalid request',
        });

        const res = await service.rejectRefund(
          'ord-rej',
          'ref-rej',
          { rejectionReason: 'Invalid request' },
          { id: 'admin-1', name: 'Admin' }
        );
        expect(res.status).toBe(RefundStatus.REJECTED);
      });

      it('failRefund transitions PROCESSING to FAILED and saves failureReason', async () => {
        const mockRefund = {
          id: 'ref-fail',
          orderId: 'ord-fail',
          status: RefundStatus.PROCESSING,
          amountCents: 40000,
          order: { id: 'ord-fail', orderNumber: 'DSL-2026-FAIL' },
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(mockRefund);
        mockPrisma.refundRecord.update.mockResolvedValue({
          ...mockRefund,
          status: RefundStatus.FAILED,
          failureReason: 'Gateway timeout',
        });

        const res = await service.failRefund(
          'ord-fail',
          'ref-fail',
          { failureReason: 'Gateway timeout' },
          { id: 'admin-1', name: 'Admin' }
        );
        expect(res.status).toBe(RefundStatus.FAILED);
      });

      it('rejects invalid state transition e.g. REQUESTED -> COMPLETED directly', async () => {
        const mockRefund = {
          id: 'ref-invalid',
          orderId: 'ord-invalid',
          requestedById: 'admin-req',
          status: RefundStatus.REQUESTED,
          amountCents: 40000,
          order: { id: 'ord-invalid', orderNumber: 'DSL-2026-INV' },
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(mockRefund);

        await expect(
          service.completeRefund(
            'ord-invalid',
            'ref-invalid',
            { externalReference: 'EXT-SKIP' },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('segregation of duties and authorization enforcement', () => {
      it('User A requests a refund; User A cannot approve it (throws ForbiddenException)', async () => {
        const mockRefund = {
          id: 'ref-sod-1',
          orderId: 'ord-sod',
          requestedById: 'user-a',
          status: RefundStatus.REQUESTED,
          amountCents: 50000,
          order: { id: 'ord-sod', orderNumber: 'DSL-2026-SOD' },
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(mockRefund);

        await expect(
          service.approveRefund('ord-sod', 'ref-sod-1', {}, { id: 'user-a', name: 'User A' })
        ).rejects.toThrow(ForbiddenException);
      });

      it('User A requests a refund; User B can approve it', async () => {
        const mockRefund = {
          id: 'ref-sod-2',
          orderId: 'ord-sod',
          requestedById: 'user-a',
          status: RefundStatus.REQUESTED,
          amountCents: 50000,
          order: { id: 'ord-sod', orderNumber: 'DSL-2026-SOD' },
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(mockRefund);
        mockPrisma.refundRecord.update.mockResolvedValue({
          ...mockRefund,
          status: RefundStatus.APPROVED,
          approvedById: 'user-b',
          approvedAt: new Date(),
        });

        const res = await service.approveRefund('ord-sod', 'ref-sod-2', {}, { id: 'user-b', name: 'User B' });
        expect(res.status).toBe(RefundStatus.APPROVED);
        expect(mockPrisma.refundRecord.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ approvedById: 'user-b' }),
          })
        );
      });

      it('User A requests a refund; User A cannot complete it (throws ForbiddenException)', async () => {
        const mockRefund = {
          id: 'ref-sod-3',
          orderId: 'ord-sod',
          requestedById: 'user-a',
          approvedById: 'user-b',
          status: RefundStatus.PROCESSING,
          amountCents: 50000,
          order: { id: 'ord-sod', orderNumber: 'DSL-2026-SOD', totalCents: 50000 },
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(mockRefund);
        mockPrisma.$queryRaw.mockResolvedValue([
          {
            id: 'ord-sod',
            orderNumber: 'DSL-2026-SOD',
            totalCents: 50000,
            paymentStatus: PaymentStatus.PAID,
            customerEmail: 'c@dsl.lk',
            customerName: 'Customer',
          },
        ]);

        await expect(
          service.completeRefund(
            'ord-sod',
            'ref-sod-3',
            { externalReference: 'PAY-EXT-123' },
            { id: 'user-a', name: 'User A' }
          )
        ).rejects.toThrow(ForbiddenException);
      });

      it('User B approves; User C completes it after independent approval', async () => {
        const mockRefund = {
          id: 'ref-sod-4',
          orderId: 'ord-sod',
          requestedById: 'user-a',
          approvedById: 'user-b',
          status: RefundStatus.PROCESSING,
          amountCents: 50000,
          order: { id: 'ord-sod', orderNumber: 'DSL-2026-SOD', totalCents: 50000 },
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(mockRefund);
        mockPrisma.refundRecord.update.mockResolvedValue({
          ...mockRefund,
          status: RefundStatus.COMPLETED,
          completedById: 'user-c',
          externalReference: 'PAY-EXT-999',
        });
        mockPrisma.refundRecord.aggregate.mockResolvedValue({ _sum: { amountCents: 50000 } });
        mockPrisma.$queryRaw.mockResolvedValue([
          {
            id: 'ord-sod',
            orderNumber: 'DSL-2026-SOD',
            totalCents: 50000,
            paymentStatus: PaymentStatus.PAID,
            customerEmail: 'c@dsl.lk',
            customerName: 'Customer',
          },
        ]);

        const completed = await service.completeRefund(
          'ord-sod',
          'ref-sod-4',
          { externalReference: 'PAY-EXT-999' },
          { id: 'user-c', name: 'User C' }
        );
        expect(completed.status).toBe(RefundStatus.COMPLETED);
        expect(mockPrisma.refundRecord.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ completedById: 'user-c' }),
          })
        );
      });

      it('Missing or undefined actor identity is rejected with BadRequestException', async () => {
        await expect(
          service.processRefund('ord-any', { amountCents: 1000, method: 'CARD_PAYHERE', reason: 'Anon' }, undefined)
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.approveRefund('ord-any', 'ref-any', {}, undefined)
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.completeRefund('ord-any', 'ref-any', { externalReference: 'EXT-1' }, undefined)
        ).rejects.toThrow(BadRequestException);
      });

      it('Legacy refund records without requestedById cannot be approved or completed', async () => {
        const legacyRefund = {
          id: 'ref-legacy',
          orderId: 'ord-legacy',
          requestedById: null, // Untracked legacy record
          status: RefundStatus.REQUESTED,
          amountCents: 20000,
          order: { id: 'ord-legacy', orderNumber: 'DSL-LEGACY' },
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(legacyRefund);

        await expect(
          service.approveRefund('ord-legacy', 'ref-legacy', {}, { id: 'admin-review', name: 'Reviewer' })
        ).rejects.toThrow(BadRequestException);

        legacyRefund.status = RefundStatus.PROCESSING;
        await expect(
          service.completeRefund(
            'ord-legacy',
            'ref-legacy',
            { externalReference: 'EXT-LEGACY' },
            { id: 'admin-review', name: 'Reviewer' }
          )
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('returns management', () => {
    describe('createReturnRequest', () => {
      it('rejects return creation if order is not delivered', async () => {
        const mockOrder = {
          id: 'ord-6',
          orderNumber: 'DSL-2026-1006',
          orderStatus: OrderStatus.PROCESSING,
          items: [{ id: 'item-1', productName: 'Ballpoint Pen', quantity: 5 }],
        };
        mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

        await expect(
          service.createReturnRequest(
            'ord-6',
            {
              reason: 'Defective item',
              items: [{ orderItemId: 'item-1', quantity: 2, reason: 'Ink leaking' }],
            },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects return if requested item is not in order', async () => {
        const mockOrder = {
          id: 'ord-6',
          orderNumber: 'DSL-2026-1006',
          orderStatus: OrderStatus.DELIVERED,
          items: [{ id: 'item-1', productName: 'Ballpoint Pen', quantity: 5 }],
        };
        mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

        await expect(
          service.createReturnRequest(
            'ord-6',
            {
              reason: 'Defective item',
              items: [{ orderItemId: 'non-existent-item', quantity: 1, reason: 'Wrong item' }],
            },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects return if quantity exceeds ordered quantity', async () => {
        const mockOrder = {
          id: 'ord-6',
          orderNumber: 'DSL-2026-1006',
          orderStatus: OrderStatus.DELIVERED,
          items: [{ id: 'item-1', productName: 'Ballpoint Pen', quantity: 5 }],
        };
        mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
        mockPrisma.orderReturnRequest.findMany.mockResolvedValue([]);

        await expect(
          service.createReturnRequest(
            'ord-6',
            {
              reason: 'Defective item',
              items: [{ orderItemId: 'item-1', quantity: 6, reason: 'Ink leaking' }],
            },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects return if previous active returns exhaust eligible quantity', async () => {
        const mockOrder = {
          id: 'ord-6',
          orderNumber: 'DSL-2026-1006',
          orderStatus: OrderStatus.DELIVERED,
          items: [{ id: 'item-1', productName: 'Ballpoint Pen', quantity: 5 }],
        };
        mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
        mockPrisma.orderReturnRequest.findMany.mockResolvedValue([
          {
            id: 'ret-prev',
            status: ReturnStatus.APPROVED,
            items: [{ orderItemId: 'item-1', quantity: 4 }],
          },
        ]);

        // Attempting to return 2 when only 1 is eligible (5 - 4 = 1)
        await expect(
          service.createReturnRequest(
            'ord-6',
            {
              reason: 'Defective item',
              items: [{ orderItemId: 'item-1', quantity: 2, reason: 'Ink leaking' }],
            },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);
      });

      it('creates return request for delivered order with valid quantity', async () => {
        const mockOrder = {
          id: 'ord-6',
          orderNumber: 'DSL-2026-1006',
          orderStatus: OrderStatus.DELIVERED,
          items: [{ id: 'item-1', productName: 'Ballpoint Pen', quantity: 5 }],
        };
        mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
        mockPrisma.orderReturnRequest.findMany.mockResolvedValue([]);
        mockPrisma.orderReturnRequest.create.mockResolvedValue({
          id: 'ret-1',
          returnNumber: 'RET-DSL-2026-1006-1234',
          status: ReturnStatus.PENDING,
        });

        const ret = await service.createReturnRequest(
          'ord-6',
          {
            reason: 'Defective item',
            items: [{ orderItemId: 'item-1', quantity: 2, reason: 'Ink leaking' }],
          },
          { id: 'admin-1', name: 'Admin' }
        );

        expect(ret.id).toBe('ret-1');
        expect(mockPrisma.$queryRaw).toHaveBeenCalled();
        expect(mockPrisma.orderAuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: 'RETURN_REQUEST_CREATED',
            }),
          })
        );
      });

      it('acquires exclusive row lock and rejects if order status changes concurrently away from DELIVERED', async () => {
        const mockOrder = {
          id: 'ord-6',
          orderNumber: 'DSL-2026-1006',
          orderStatus: OrderStatus.DELIVERED,
          items: [{ id: 'item-1', productName: 'Ballpoint Pen', quantity: 5 }],
        };
        mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
        // Lock acquired, but under lock order status is already CANCELLED
        mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 'ord-6', orderStatus: OrderStatus.CANCELLED }]);

        await expect(
          service.createReturnRequest(
            'ord-6',
            {
              reason: 'Defective item',
              items: [{ orderItemId: 'item-1', quantity: 2, reason: 'Ink leaking' }],
            },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);
      });

      it('serializes concurrent return creation: second request is rejected when combined quantities exceed ordered amount', async () => {
        const mockOrder = {
          id: 'ord-conc',
          orderNumber: 'DSL-2026-1007',
          orderStatus: OrderStatus.DELIVERED,
          items: [{ id: 'item-1', productName: 'Notebook', quantity: 5 }],
        };
        mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
        mockPrisma.$queryRaw.mockResolvedValue([{ id: 'ord-conc', orderStatus: OrderStatus.DELIVERED }]);

        // First call sees 0 existing returns; second call (after first commits) sees 4 returned
        mockPrisma.orderReturnRequest.findMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: 'ret-first',
              status: ReturnStatus.PENDING,
              items: [{ orderItemId: 'item-1', quantity: 4 }],
            },
          ]);

        mockPrisma.orderReturnRequest.create.mockResolvedValueOnce({
          id: 'ret-first',
          returnNumber: 'RET-001',
          status: ReturnStatus.PENDING,
        });

        // Request 1: asks for 4 units
        const req1 = await service.createReturnRequest(
          'ord-conc',
          {
            reason: 'Excess stock',
            items: [{ orderItemId: 'item-1', quantity: 4, reason: 'Over-ordered' }],
          },
          { id: 'admin-1', name: 'Admin' }
        );
        expect(req1.id).toBe('ret-first');

        // Request 2: concurrently asks for 4 units (only 1 eligible remaining: 5 - 4 = 1)
        await expect(
          service.createReturnRequest(
            'ord-conc',
            {
              reason: 'Excess stock',
              items: [{ orderItemId: 'item-1', quantity: 4, reason: 'Over-ordered' }],
            },
            { id: 'admin-2', name: 'Admin Two' }
          )
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('processReturnStatus', () => {
      it('approves a pending return request (PENDING -> APPROVED)', async () => {
        const mockReturn = {
          id: 'ret-1',
          orderId: 'ord-6',
          status: ReturnStatus.PENDING,
          returnNumber: 'RET-001',
          items: [{ id: 'ri-1', orderItemId: 'item-1', quantity: 2 }],
          order: { orderNumber: 'DSL-2026-1006', customerEmail: 'c@dsl.lk', customerName: 'C' },
        };
        mockPrisma.orderReturnRequest.findUnique.mockResolvedValue(mockReturn);
        mockPrisma.orderReturnRequest.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.orderReturnRequest.update.mockResolvedValue({
          ...mockReturn,
          status: ReturnStatus.APPROVED,
        });

        const res = await service.processReturnStatus(
          'ord-6',
          'ret-1',
          { action: 'APPROVE', restockItems: false },
          { id: 'admin-1', name: 'Admin' }
        );

        expect(res.status).toBe(ReturnStatus.APPROVED);
        expect(mockPrisma.orderReturnItem.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { returnRequestId: 'ret-1' },
            data: expect.objectContaining({ status: ReturnItemStatus.APPROVED }),
          })
        );
        expect(mockPrisma.orderAuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: 'RETURN_DECISION',
              previousValue: ReturnStatus.PENDING,
              newValue: ReturnStatus.APPROVED,
            }),
          })
        );
      });

      it('rejects a pending return request and persists rejectionReason', async () => {
        const mockReturn = {
          id: 'ret-1',
          orderId: 'ord-6',
          status: ReturnStatus.PENDING,
          returnNumber: 'RET-001',
          items: [{ id: 'ri-1', orderItemId: 'item-1', quantity: 2 }],
          order: { orderNumber: 'DSL-2026-1006', customerEmail: 'c@dsl.lk', customerName: 'C' },
        };
        mockPrisma.orderReturnRequest.findUnique.mockResolvedValue(mockReturn);
        mockPrisma.orderReturnRequest.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.orderReturnRequest.update.mockResolvedValue({
          ...mockReturn,
          status: ReturnStatus.REJECTED,
          rejectionReason: 'Items damaged by customer',
        });

        const res = await service.processReturnStatus(
          'ord-6',
          'ret-1',
          { action: 'REJECT', rejectionReason: 'Items damaged by customer', restockItems: false },
          { id: 'admin-1', name: 'Admin' }
        );

        expect(res.status).toBe(ReturnStatus.REJECTED);
        expect(mockPrisma.orderReturnItem.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { returnRequestId: 'ret-1' },
            data: expect.objectContaining({
              status: ReturnItemStatus.REJECTED,
              rejectionReason: 'Items damaged by customer',
            }),
          })
        );
        expect(mockNotificationsService.sendReturnStatusUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            status: ReturnStatus.REJECTED,
            rejectionReason: 'Items damaged by customer',
          })
        );
      });

      it('rejects invalid transition: cannot approve an already rejected return', async () => {
        const mockReturn = {
          id: 'ret-1',
          orderId: 'ord-6',
          status: ReturnStatus.REJECTED,
          returnNumber: 'RET-001',
          items: [],
          order: { orderNumber: 'DSL-2026-1006' },
        };
        mockPrisma.orderReturnRequest.findUnique.mockResolvedValue(mockReturn);

        await expect(
          service.processReturnStatus(
            'ord-6',
            'ret-1',
            { action: 'APPROVE', restockItems: false },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects invalid transition: pending return cannot bypass approval to CONFIRM_RECEIVED', async () => {
        const mockReturn = {
          id: 'ret-1',
          orderId: 'ord-6',
          status: ReturnStatus.PENDING,
          returnNumber: 'RET-001',
          items: [],
          order: { orderNumber: 'DSL-2026-1006' },
        };
        mockPrisma.orderReturnRequest.findUnique.mockResolvedValue(mockReturn);

        await expect(
          service.processReturnStatus(
            'ord-6',
            'ret-1',
            { action: 'CONFIRM_RECEIVED', restockItems: true },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);
      });

      it('confirms receipt with restockItems=false: marks COMPLETED and does NOT touch stock', async () => {
        const mockReturn = {
          id: 'ret-1',
          orderId: 'ord-6',
          status: ReturnStatus.APPROVED,
          returnNumber: 'RET-001',
          items: [{ id: 'ri-1', orderItemId: 'item-1', quantity: 2, receivedAt: null }],
          order: { orderNumber: 'DSL-2026-1006', customerEmail: 'c@dsl.lk', customerName: 'C' },
        };
        mockPrisma.orderReturnRequest.findUnique.mockResolvedValue(mockReturn);
        mockPrisma.orderReturnRequest.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.orderReturnRequest.update.mockResolvedValue({
          ...mockReturn,
          status: ReturnStatus.COMPLETED,
        });

        const res = await service.processReturnStatus(
          'ord-6',
          'ret-1',
          { action: 'CONFIRM_RECEIVED', restockItems: false },
          { id: 'admin-1', name: 'Admin' }
        );

        expect(res.status).toBe(ReturnStatus.COMPLETED);
        expect(mockPrisma.product.update).not.toHaveBeenCalled();
        expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
        expect(mockPrisma.orderReturnItem.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { returnRequestId: 'ret-1' },
            data: expect.objectContaining({
              status: ReturnItemStatus.RECEIVED,
              receivedAt: expect.any(Date),
            }),
          })
        );
      });

      it('confirms receipt with restockItems=true: increments stock exactly once with accurate previous/new balances', async () => {
        const mockReturn = {
          id: 'ret-1',
          orderId: 'ord-6',
          status: ReturnStatus.APPROVED,
          returnNumber: 'RET-001',
          items: [{ id: 'ri-1', orderItemId: 'item-1', quantity: 3, receivedAt: null }],
          order: { orderNumber: 'DSL-2026-1006', customerEmail: 'c@dsl.lk', customerName: 'C' },
        };
        mockPrisma.orderReturnRequest.findUnique.mockResolvedValue(mockReturn);
        mockPrisma.orderReturnRequest.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.orderItem.findUnique.mockResolvedValue({
          id: 'item-1',
          productId: 'prod-1',
          variantId: 'var-1',
        });
        mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', stockQuantity: 20 });
        mockPrisma.productVariant = {
          findUnique: vi.fn().mockResolvedValue({ id: 'var-1', stockQuantity: 10 }),
          update: vi.fn(),
        };
        mockPrisma.orderReturnRequest.update.mockResolvedValue({
          ...mockReturn,
          status: ReturnStatus.COMPLETED,
        });

        const res = await service.processReturnStatus(
          'ord-6',
          'ret-1',
          { action: 'CONFIRM_RECEIVED', restockItems: true },
          { id: 'admin-1', name: 'Admin' }
        );

        expect(res.status).toBe(ReturnStatus.COMPLETED);
        // Product stock incremented
        expect(mockPrisma.product.update).toHaveBeenCalledWith({
          where: { id: 'prod-1' },
          data: { stockQuantity: { increment: 3 } },
        });
        // Variant stock incremented
        expect(mockPrisma.productVariant.update).toHaveBeenCalledWith({
          where: { id: 'var-1' },
          data: { stockQuantity: { increment: 3 } },
        });
        // Inventory movement records real previous and new stock
        expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            productId: 'prod-1',
            variantId: 'var-1',
            previousQuantity: 20,
            newQuantity: 23,
            changeAmount: 3,
          }),
        });
      });

      it('prevents duplicate restocking: completed return cannot be processed again', async () => {
        const mockReturn = {
          id: 'ret-1',
          orderId: 'ord-6',
          status: ReturnStatus.COMPLETED,
          returnNumber: 'RET-001',
          items: [{ id: 'ri-1', orderItemId: 'item-1', quantity: 2, receivedAt: new Date() }],
          order: { orderNumber: 'DSL-2026-1006' },
        };
        mockPrisma.orderReturnRequest.findUnique.mockResolvedValue(mockReturn);

        await expect(
          service.processReturnStatus(
            'ord-6',
            'ret-1',
            { action: 'CONFIRM_RECEIVED', restockItems: true },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);

        expect(mockPrisma.product.update).not.toHaveBeenCalled();
      });

      it('prevents concurrent double restocking: if atomic update returns count 0, throws BadRequestException', async () => {
        const mockReturn = {
          id: 'ret-1',
          orderId: 'ord-6',
          status: ReturnStatus.APPROVED,
          returnNumber: 'RET-001',
          items: [{ id: 'ri-1', orderItemId: 'item-1', quantity: 2, receivedAt: null }],
          order: { orderNumber: 'DSL-2026-1006' },
        };
        // First findUnique might see APPROVED, but concurrent update acquired lock and updated it first
        mockPrisma.orderReturnRequest.findUnique
          .mockResolvedValueOnce(mockReturn)
          .mockResolvedValueOnce({ ...mockReturn, status: ReturnStatus.COMPLETED });
        mockPrisma.orderReturnRequest.updateMany.mockResolvedValue({ count: 0 }); // Atomic check failed

        await expect(
          service.processReturnStatus(
            'ord-6',
            'ret-1',
            { action: 'CONFIRM_RECEIVED', restockItems: true },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);

        expect(mockPrisma.product.update).not.toHaveBeenCalled();
      });

      it('concurrent confirmation requests cannot restock twice (simultaneous Promise.all)', async () => {
        const mockReturn = {
          id: 'ret-concurrent',
          orderId: 'ord-6',
          status: ReturnStatus.APPROVED,
          returnNumber: 'RET-CONC-001',
          items: [{ id: 'ri-1', orderItemId: 'item-1', quantity: 2, receivedAt: null }],
          order: { orderNumber: 'DSL-2026-1006', customerEmail: 'c@dsl.lk', customerName: 'C' },
        };
        mockPrisma.orderReturnRequest.findUnique.mockResolvedValue(mockReturn);
        mockPrisma.orderReturnRequest.updateMany
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 });
        mockPrisma.orderItem.findUnique.mockResolvedValue({ id: 'item-1', productId: 'prod-1' });
        mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', stockQuantity: 15 });
        mockPrisma.orderReturnRequest.update.mockResolvedValue({
          ...mockReturn,
          status: ReturnStatus.COMPLETED,
        });

        const p1 = service.processReturnStatus(
          'ord-6',
          'ret-concurrent',
          { action: 'CONFIRM_RECEIVED', restockItems: true },
          { id: 'admin-1', name: 'Admin' }
        );
        const p2 = service.processReturnStatus(
          'ord-6',
          'ret-concurrent',
          { action: 'CONFIRM_RECEIVED', restockItems: true },
          { id: 'admin-1', name: 'Admin' }
        );

        const results = await Promise.allSettled([p1, p2]);
        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');

        expect(fulfilled.length).toBe(1);
        expect(rejected.length).toBe(1);
        expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(BadRequestException);
        expect(mockPrisma.product.update).toHaveBeenCalledTimes(1);
      });

      it('acquires row lock on Product and ProductVariant before incrementing stock and creating movements', async () => {
        const mockReturn = {
          id: 'ret-lock',
          orderId: 'ord-lock',
          status: ReturnStatus.APPROVED,
          returnNumber: 'RET-LOCK-001',
          items: [{ id: 'ri-1', orderItemId: 'item-lock', quantity: 2, receivedAt: null }],
          order: { orderNumber: 'DSL-2026-1008', customerEmail: 'c@dsl.lk', customerName: 'C' },
        };
        mockPrisma.orderReturnRequest.findUnique.mockResolvedValue(mockReturn);
        mockPrisma.orderReturnRequest.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.orderItem.findUnique.mockResolvedValue({
          id: 'item-lock',
          productId: 'prod-lock',
          variantId: 'var-lock',
        });
        mockPrisma.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
          const sql = strings.join('');
          if (sql.includes('"Product"')) {
            return [{ id: 'prod-lock', stockQuantity: 30 }];
          }
          if (sql.includes('"ProductVariant"')) {
            return [{ id: 'var-lock', stockQuantity: 15 }];
          }
          return [];
        });
        mockPrisma.orderReturnRequest.update.mockResolvedValue({
          ...mockReturn,
          status: ReturnStatus.COMPLETED,
        });

        await service.processReturnStatus(
          'ord-lock',
          'ret-lock',
          { action: 'CONFIRM_RECEIVED', restockItems: true },
          { id: 'admin-1', name: 'Admin' }
        );

        expect(mockPrisma.$queryRaw).toHaveBeenCalled();
        expect(mockPrisma.product.update).toHaveBeenCalledWith({
          where: { id: 'prod-lock' },
          data: { stockQuantity: { increment: 2 } },
        });
        expect(mockPrisma.productVariant.update).toHaveBeenCalledWith({
          where: { id: 'var-lock' },
          data: { stockQuantity: { increment: 2 } },
        });
        expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            productId: 'prod-lock',
            variantId: 'var-lock',
            previousQuantity: 30,
            newQuantity: 32,
            changeAmount: 2,
            reason: InventoryChangeReason.RESTOCK,
          }),
        });
      });

      it('rolls back transaction if an error occurs during movement creation', async () => {
        const mockReturn = {
          id: 'ret-err',
          orderId: 'ord-err',
          status: ReturnStatus.APPROVED,
          returnNumber: 'RET-ERR-001',
          items: [{ id: 'ri-1', orderItemId: 'item-err', quantity: 2, receivedAt: null }],
          order: { orderNumber: 'DSL-2026-1009', customerEmail: 'c@dsl.lk', customerName: 'C' },
        };
        mockPrisma.orderReturnRequest.findUnique.mockResolvedValue(mockReturn);
        mockPrisma.orderReturnRequest.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.orderItem.findUnique.mockResolvedValue({
          id: 'item-err',
          productId: 'prod-err',
        });
        mockPrisma.$queryRaw.mockResolvedValue([{ id: 'prod-err', stockQuantity: 10 }]);
        mockPrisma.inventoryMovement.create.mockRejectedValue(new Error('DB Constraint Violation'));

        await expect(
          service.processReturnStatus(
            'ord-err',
            'ret-err',
            { action: 'CONFIRM_RECEIVED', restockItems: true },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow('DB Constraint Violation');
      });

      describe('Stage 1.2: Deterministic Lock Ordering & Deadlock Prevention', () => {
        it('locks multiple products in deterministic ascending order regardless of item sequence', async () => {
          const mockReturn = {
            id: 'ret-multi-order',
            orderId: 'ord-multi',
            status: ReturnStatus.APPROVED,
            returnNumber: 'RET-MULTI-001',
            items: [
              { id: 'ri-1', orderItemId: 'oi-z', quantity: 2, receivedAt: null },
              { id: 'ri-2', orderItemId: 'oi-a', quantity: 3, receivedAt: null },
            ],
            order: { orderNumber: 'DSL-2026-MULTI', customerEmail: 'c@dsl.lk', customerName: 'C' },
          };
          mockPrisma.orderReturnRequest.findUnique.mockResolvedValue(mockReturn);
          mockPrisma.orderReturnRequest.updateMany.mockResolvedValue({ count: 1 });
          mockPrisma.orderReturnRequest.update.mockResolvedValue({
            ...mockReturn,
            status: ReturnStatus.COMPLETED,
          });
          mockPrisma.orderItem.findMany.mockResolvedValue([
            { id: 'oi-z', productId: 'prod-zebra', variantId: null },
            { id: 'oi-a', productId: 'prod-apple', variantId: null },
          ]);

          const lockedOrder: string[] = [];
          mockPrisma.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...values: any[]) => {
            const sql = strings.join('');
            if (sql.includes('"Product"')) {
              lockedOrder.push(values[0]);
              return [{ id: values[0], stockQuantity: 20 }];
            }
            return [];
          });

          await service.processReturnStatus(
            'ord-multi',
            'ret-multi-order',
            { action: 'CONFIRM_RECEIVED', restockItems: true },
            { id: 'admin-1', name: 'Admin' }
          );

          // Although input was [prod-zebra, prod-apple], locks must be acquired in ascending order: [prod-apple, prod-zebra]
          expect(lockedOrder).toEqual(['prod-apple', 'prod-zebra']);
        });

        it('deduplicates Product IDs so multiple items of the same product do not cause duplicate locks and produce contiguous balances', async () => {
          const mockReturn = {
            id: 'ret-dup',
            orderId: 'ord-dup',
            status: ReturnStatus.APPROVED,
            returnNumber: 'RET-DUP-001',
            items: [
              { id: 'ri-1', orderItemId: 'oi-1', quantity: 2, receivedAt: null },
              { id: 'ri-2', orderItemId: 'oi-2', quantity: 3, receivedAt: null },
            ],
            order: { orderNumber: 'DSL-2026-DUP', customerEmail: 'c@dsl.lk', customerName: 'C' },
          };
          mockPrisma.orderReturnRequest.findUnique.mockResolvedValue(mockReturn);
          mockPrisma.orderReturnRequest.updateMany.mockResolvedValue({ count: 1 });
          mockPrisma.orderReturnRequest.update.mockResolvedValue({
            ...mockReturn,
            status: ReturnStatus.COMPLETED,
          });
          mockPrisma.orderItem.findMany.mockResolvedValue([
            { id: 'oi-1', productId: 'prod-same', variantId: 'var-1' },
            { id: 'oi-2', productId: 'prod-same', variantId: 'var-2' },
          ]);

          const productLockCalls: string[] = [];
          const variantLockCalls: string[] = [];

          mockPrisma.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...values: any[]) => {
            const sql = strings.join('');
            if (sql.includes('"Product"')) {
              productLockCalls.push(values[0]);
              return [{ id: values[0], stockQuantity: 10 }];
            }
            if (sql.includes('"ProductVariant"')) {
              variantLockCalls.push(values[0]);
              return [{ id: values[0], stockQuantity: 5 }];
            }
            return [];
          });

          await service.processReturnStatus(
            'ord-dup',
            'ret-dup',
            { action: 'CONFIRM_RECEIVED', restockItems: true },
            { id: 'admin-1', name: 'Admin' }
          );

          // prod-same must only be locked once!
          expect(productLockCalls).toEqual(['prod-same']);
          // Variants must be locked in ascending order: var-1 then var-2
          expect(variantLockCalls).toEqual(['var-1', 'var-2']);

          // Two inventory movements created with contiguous balances:
          // Item 1: 10 -> 12 (+2)
          // Item 2: 12 -> 15 (+3)
          expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                productId: 'prod-same',
                variantId: 'var-1',
                previousQuantity: 10,
                newQuantity: 12,
                changeAmount: 2,
              }),
            })
          );
          expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                productId: 'prod-same',
                variantId: 'var-2',
                previousQuantity: 12,
                newQuantity: 15,
                changeAmount: 3,
              }),
            })
          );
        });

        it('cancelOrder applies the same deterministic lock hierarchy (Product ASC -> Variant ASC)', async () => {
          const mockOrder = {
            id: 'ord-canc-sort',
            orderNumber: 'DSL-2026-CANC',
            orderStatus: OrderStatus.CONFIRMED,
            paymentStatus: PaymentStatus.PENDING,
            items: [
              { id: 'it-1', productId: 'prod-y', variantId: 'var-b', quantity: 2 },
              { id: 'it-2', productId: 'prod-x', variantId: 'var-a', quantity: 4 },
            ],
          };
          mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

          const lockSequence: string[] = [];
          mockPrisma.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...values: any[]) => {
            const sql = Array.isArray(strings) ? strings.join('') : String(strings);
            if (sql.includes('"Order"')) {
              return [{
                id: values[0] || 'ord-canc-sort',
                orderNumber: 'DSL-2026-CANC',
                orderStatus: OrderStatus.CONFIRMED,
                paymentStatus: PaymentStatus.PENDING,
                paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
                totalCents: 10000,
                paidAt: null,
                paymentProofUrl: null,
                bankReference: null,
              }];
            }
            if (sql.includes('"Product"')) {
              lockSequence.push(`PROD:${values[0]}`);
              return [{ id: values[0], stockQuantity: 20 }];
            }
            if (sql.includes('"ProductVariant"')) {
              lockSequence.push(`VAR:${values[0]}`);
              return [{ id: values[0], stockQuantity: 10 }];
            }
            return [];
          });

          await service.cancelOrder(
            'ord-canc-sort',
            { reason: 'Customer requested', restoreInventory: true, processRefund: false },
            { id: 'admin-1', name: 'Admin' }
          );

          // All products locked first in ASC order, then all variants locked in ASC order
          expect(lockSequence).toEqual([
            'PROD:prod-x',
            'PROD:prod-y',
            'VAR:var-a',
            'VAR:var-b',
          ]);
        });

        it('handles missing/deleted product rows gracefully without crash', async () => {
          const mockReturn = {
            id: 'ret-missing',
            orderId: 'ord-missing',
            status: ReturnStatus.APPROVED,
            returnNumber: 'RET-MISS-001',
            items: [{ id: 'ri-1', orderItemId: 'oi-missing', quantity: 2, receivedAt: null }],
            order: { orderNumber: 'DSL-2026-MISS', customerEmail: 'c@dsl.lk', customerName: 'C' },
          };
          mockPrisma.orderReturnRequest.findUnique.mockResolvedValue(mockReturn);
          mockPrisma.orderReturnRequest.updateMany.mockResolvedValue({ count: 1 });
          mockPrisma.orderReturnRequest.update.mockResolvedValue({
            ...mockReturn,
            status: ReturnStatus.COMPLETED,
          });
          mockPrisma.orderItem.findMany.mockResolvedValue([
            { id: 'oi-missing', productId: 'prod-deleted', variantId: null },
          ]);
          // Returns empty row array simulating deleted product
          mockPrisma.$queryRaw.mockResolvedValue([]);

          await service.processReturnStatus(
            'ord-missing',
            'ret-missing',
            { action: 'CONFIRM_RECEIVED', restockItems: true },
            { id: 'admin-1', name: 'Admin' }
          );

          expect(mockPrisma.product.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'prod-deleted' } })
          );
          expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                productId: 'prod-deleted',
                previousQuantity: 0,
                newQuantity: 2,
              }),
            })
          );
        });
      });
    });

    describe('Stage 2.3: Return Refund Management & Financial Reconciliation', () => {
      it('rejects refund request for a return in PENDING status', async () => {
        const mockOrder = {
          id: 'ord-ret-ref',
          orderNumber: 'ORD-RET-REF',
          totalCents: 10000,
          paymentMethod: PaymentMethod.CARD_PAYHERE,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
        };
        mockPrisma.$queryRaw.mockResolvedValue([mockOrder]);
        mockPrisma.orderReturnRequest.findUnique.mockResolvedValue({
          id: 'ret-pending',
          orderId: 'ord-ret-ref',
          returnNumber: 'RET-001',
          status: ReturnStatus.PENDING,
          items: [],
        });

        await expect(
          service.processRefund(
            'ord-ret-ref',
            {
              amountCents: 5000,
              method: 'CARD_PAYHERE',
              reason: 'Return refund',
              orderReturnRequestId: 'ret-pending',
            },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects refund request for a return in REJECTED status', async () => {
        const mockOrder = {
          id: 'ord-ret-ref',
          orderNumber: 'ORD-RET-REF',
          totalCents: 10000,
          paymentMethod: PaymentMethod.CARD_PAYHERE,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
        };
        mockPrisma.$queryRaw.mockResolvedValue([mockOrder]);
        mockPrisma.orderReturnRequest.findUnique.mockResolvedValue({
          id: 'ret-rejected',
          orderId: 'ord-ret-ref',
          returnNumber: 'RET-002',
          status: ReturnStatus.REJECTED,
          items: [],
        });

        await expect(
          service.processRefund(
            'ord-ret-ref',
            {
              amountCents: 5000,
              method: 'CARD_PAYHERE',
              reason: 'Return refund',
              orderReturnRequestId: 'ret-rejected',
            },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects duplicate refund for the same return request', async () => {
        const mockOrder = {
          id: 'ord-ret-ref',
          orderNumber: 'ORD-RET-REF',
          totalCents: 10000,
          paymentMethod: PaymentMethod.CARD_PAYHERE,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
        };
        mockPrisma.$queryRaw.mockResolvedValue([mockOrder]);
        mockPrisma.orderReturnRequest.findUnique.mockResolvedValue({
          id: 'ret-approved',
          orderId: 'ord-ret-ref',
          returnNumber: 'RET-003',
          status: ReturnStatus.APPROVED,
          items: [],
        });
        mockPrisma.refundRecord.findFirst.mockResolvedValue({
          id: 'existing-refund-1',
          orderReturnRequestId: 'ret-approved',
          status: RefundStatus.APPROVED,
        });

        await expect(
          service.processRefund(
            'ord-ret-ref',
            {
              amountCents: 5000,
              method: 'CARD_PAYHERE',
              reason: 'Second return refund',
              orderReturnRequestId: 'ret-approved',
            },
            { id: 'admin-1', name: 'Admin' }
          )
        ).rejects.toThrow(BadRequestException);
      });

      it('completing a linked refund updates associated return items to REFUNDED', async () => {
        const mockOrder = {
          id: 'ord-complete-ret',
          orderNumber: 'ORD-CR-001',
          totalCents: 10000,
          paymentStatus: PaymentStatus.PAID,
        };
        mockPrisma.$queryRaw.mockResolvedValue([mockOrder]);

        const mockRefund = {
          id: 'ref-linked',
          orderId: 'ord-complete-ret',
          status: RefundStatus.PROCESSING,
          amountCents: 5000,
          requestedById: 'user-requester',
          approvedById: 'user-approver',
          orderReturnRequestId: 'ret-target',
        };
        mockPrisma.refundRecord.findUnique.mockResolvedValue(mockRefund);
        mockPrisma.refundRecord.update.mockResolvedValue({
          ...mockRefund,
          status: RefundStatus.COMPLETED,
          externalReference: 'EXT-VALID-123',
        });
        mockPrisma.refundRecord.aggregate.mockResolvedValue({ _sum: { amountCents: 5000 } });
        mockPrisma.orderReturnItem.updateMany.mockResolvedValue({ count: 2 });

        await service.completeRefund(
          'ord-complete-ret',
          'ref-linked',
          { externalReference: 'EXT-VALID-123' },
          { id: 'user-completer', name: 'Completer' }
        );

        expect(mockPrisma.orderReturnItem.updateMany).toHaveBeenCalledWith({
          where: { returnRequestId: 'ret-target' },
          data: { status: ReturnItemStatus.REFUNDED },
        });
      });

      it('calculates financial reconciliation summary correctly', async () => {
        const mockOrders = [
          {
            id: 'o-1',
            totalCents: 10000,
            paymentMethod: PaymentMethod.CARD_PAYHERE,
            paymentStatus: PaymentStatus.PAID,
            paymentAttempts: [
              { amountCents: 10000, gatewayReference: 'PH-1', status: PaymentAttemptStatus.SUCCEEDED },
            ],
            refundRecords: [
              { amountCents: 3000, status: RefundStatus.COMPLETED, externalReference: 'EXT-1' },
              { amountCents: 2000, status: RefundStatus.REQUESTED },
            ],
            returnRequests: [],
          },
          {
            id: 'o-2',
            totalCents: 5000,
            paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
            paymentStatus: PaymentStatus.PAID, // Flagged: PAID without collection!
            paymentAttempts: [],
            refundRecords: [],
            returnRequests: [],
          },
        ];
        mockPrisma.order.findMany.mockResolvedValue(mockOrders);

        const summary = await service.getFinancialReconciliationSummary({ page: 1, limit: 20 });

        expect(summary.totalOrders).toBe(2);
        expect(summary.totalOrderAmountCents).toBe(15000);
        expect(summary.totalVerifiedCollectedCents).toBe(10000); // Only o-1 has verified PayHere
        expect(summary.totalCompletedRefundsCents).toBe(3000);
        expect(summary.totalReservedRefundsCents).toBe(2000);
        expect(summary.totalAvailableRefundBalanceCents).toBe(5000); // 10000 - 3000 - 2000 = 5000
        expect(summary.discrepancyCount).toBe(1); // o-2 has PAID_WITHOUT_COLLECTION
      });

      it('flags financial discrepancies in paginated reconciliation', async () => {
        const mockOrders = [
          {
            id: 'o-disc',
            orderNumber: 'ORD-DISC-001',
            customerName: 'Test Customer',
            customerEmail: 'test@dsl.lk',
            createdAt: new Date(),
            totalCents: 10000,
            paymentMethod: PaymentMethod.CARD_PAYHERE,
            paymentStatus: PaymentStatus.PAID,
            paymentAttempts: [
              { amountCents: 5000, gatewayReference: 'DUP-REF', status: PaymentAttemptStatus.SUCCEEDED },
              { amountCents: 5000, gatewayReference: 'DUP-REF', status: PaymentAttemptStatus.SUCCEEDED }, // Duplicate!
            ],
            refundRecords: [
              {
                id: 'ref-1',
                amountCents: 4000,
                status: RefundStatus.COMPLETED,
                externalReference: 'EXT-DUP',
                method: 'CARD_PAYHERE',
                reference: 'REF-1',
                requestedById: 'u1',
                approvedById: 'u2',
                completedById: 'u3',
                createdAt: new Date(),
              },
              {
                id: 'ref-2',
                amountCents: 4000,
                status: RefundStatus.COMPLETED,
                externalReference: 'EXT-DUP', // Duplicate refund ref!
                method: 'CARD_PAYHERE',
                reference: 'REF-2',
                requestedById: 'u1',
                approvedById: 'u2',
                completedById: 'u3',
                createdAt: new Date(),
              },
            ],
            returnRequests: [],
          },
        ];
        mockPrisma.order.findMany.mockResolvedValue(mockOrders);

        const result = await service.getFinancialReconciliation({ page: 1, limit: 10 });

        expect(result.items.length).toBe(1);
        const item = result.items[0];
        expect(item.hasDiscrepancy).toBe(true);
        expect(item.discrepancies.some((d: string) => d.includes('DUPLICATE_PAYMENT_REF'))).toBe(true);
        expect(item.discrepancies.some((d: string) => d.includes('DUPLICATE_REFUND_REF'))).toBe(true);
        expect(item.discrepancies.some((d: string) => d.includes('REFUNDS_EXCEED_COLLECTIONS'))).toBe(true); // 8000 > 5000
      });
    });
  });
});

