import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminOrdersService } from './admin-orders.service';
import { OrderStatus, PaymentStatus, ReturnStatus, ReturnItemStatus } from '../../generated/prisma';
import { BadRequestException, NotFoundException } from '@nestjs/common';

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
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      orderReturnRequest: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      orderReturnItem: {
        updateMany: vi.fn(),
      },
      refundRecord: {
        create: vi.fn(),
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
    it('cancels order, restores inventory, and records refund if requested', async () => {
      const mockOrder = {
        id: 'ord-4',
        orderNumber: 'DSL-2026-1004',
        orderStatus: OrderStatus.PROCESSING,
        paymentStatus: PaymentStatus.PAID,
        totalCents: 450000,
        customerEmail: 'cust@dsl.lk',
        customerName: 'Customer Four',
        items: [{ id: 'it-1', productId: 'prod-1', quantity: 2 }],
      };
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue({
        ...mockOrder,
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.REFUNDED,
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
          }),
        })
      );
      expect(mockOrdersGateway.broadcastOrderEvent).toHaveBeenCalledWith(
        'order.cancelled',
        expect.anything()
      );
    });
  });

  describe('processRefund', () => {
    it('validates refund amount does not exceed order total', async () => {
      const mockOrder = {
        id: 'ord-5',
        totalCents: 100000,
      };
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.processRefund('ord-5', {
          amountCents: 150000, // Exceeds total
          method: 'BANK_TRANSFER',
          reason: 'Excessive refund attempt',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('creates refund record and updates order paymentStatus', async () => {
      const mockOrder = {
        id: 'ord-5',
        orderNumber: 'DSL-2026-1005',
        totalCents: 100000,
        customerEmail: 'test@dsl.lk',
        customerName: 'Cust Five',
      };
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.refundRecord.create.mockResolvedValue({ id: 'ref-1', amountCents: 100000 });

      const refund = await service.processRefund(
        'ord-5',
        { amountCents: 100000, method: 'BANK_TRANSFER', reason: 'Customer returned items' },
        { id: 'admin-1', name: 'Admin' }
      );

      expect(refund.id).toBe('ref-1');
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-5' },
        data: { paymentStatus: PaymentStatus.REFUNDED },
      });
      expect(mockOrdersGateway.broadcastOrderEvent).toHaveBeenCalledWith(
        'order.refund.updated',
        expect.anything()
      );
    });
  });

  describe('returns management', () => {
    it('creates return request and records audit entry', async () => {
      const mockOrder = {
        id: 'ord-6',
        orderNumber: 'DSL-2026-1006',
        items: [{ id: 'item-1', productName: 'Ballpoint Pen', quantity: 5 }],
      };
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
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
      expect(mockPrisma.orderAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'RETURN_REQUEST_CREATED',
          }),
        })
      );
    });
  });
});

