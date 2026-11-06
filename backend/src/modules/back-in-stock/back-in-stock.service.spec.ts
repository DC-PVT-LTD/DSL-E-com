import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { BackInStockService } from './back-in-stock.service';
import { BackInStockAlertStatus } from '../../generated/prisma';
import {
  DefiniteDeliveryException,
  UncertainDeliveryTimeoutException,
} from '../notifications/notifications.service';

describe('BackInStockService (Phase 15.4)', () => {
  let service: BackInStockService;
  let prismaMock: any;
  let notificationsMock: any;

  beforeEach(() => {
    prismaMock = {
      product: {
        findUnique: vi.fn(),
      },
      backInStockAlert: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    notificationsMock = {
      sendBackInStockAlert: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-123' }),
    };

    service = new BackInStockService(prismaMock, notificationsMock);
  });

  describe('Subscription Handling', () => {
    it('successfully subscribes an authenticated customer to an out-of-stock product', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'prod-out',
        name: 'Atlas Gel Pen 0.5 Black',
        slug: 'atlas-gel-pen-black',
        sku: 'PEN-BLK-05',
        priceCents: 12000,
        stockQuantity: 0,
        isActive: true,
        images: ['/pen.jpg'],
      });
      prismaMock.backInStockAlert.findFirst.mockResolvedValue(null);
      prismaMock.backInStockAlert.create.mockResolvedValue({
        id: 'alert-1',
        userId: 'user-1',
        productId: 'prod-out',
        status: BackInStockAlertStatus.PENDING,
        sentAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.subscribe('user-1', 'prod-out');
      expect(result.id).toBe('alert-1');
      expect(result.isAlreadySubscribed).toBe(false);
      expect(result.status).toBe(BackInStockAlertStatus.PENDING);
      expect(prismaMock.backInStockAlert.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          productId: 'prod-out',
          status: BackInStockAlertStatus.PENDING,
        },
      });
    });

    it('prevents duplicate active subscriptions and returns existing subscription idempotently', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'prod-out',
        name: 'Atlas Gel Pen 0.5 Black',
        slug: 'atlas-gel-pen-black',
        sku: 'PEN-BLK-05',
        priceCents: 12000,
        stockQuantity: 0,
        isActive: true,
        images: ['/pen.jpg'],
      });
      prismaMock.backInStockAlert.findFirst.mockResolvedValue({
        id: 'alert-existing',
        userId: 'user-1',
        productId: 'prod-out',
        status: BackInStockAlertStatus.PENDING,
        sentAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.subscribe('user-1', 'prod-out');
      expect(result.id).toBe('alert-existing');
      expect(result.isAlreadySubscribed).toBe(true);
      expect(result.message).toContain('already subscribed');
      expect(prismaMock.backInStockAlert.create).not.toHaveBeenCalled();
    });

    it('rejects subscriptions when the product is already in stock', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'prod-in-stock',
        name: 'Atlas Ruled Book',
        stockQuantity: 15,
        isActive: true,
      });

      await expect(service.subscribe('user-1', 'prod-in-stock')).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects subscriptions for non-existent or inactive products', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);
      await expect(service.subscribe('user-1', 'non-existent')).rejects.toThrow(
        NotFoundException
      );

      prismaMock.product.findUnique.mockResolvedValue({
        id: 'prod-inactive',
        stockQuantity: 0,
        isActive: false,
      });
      await expect(service.subscribe('user-1', 'prod-inactive')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('Customer Alerts & Cancellation', () => {
    it('retrieves all alert subscriptions for the authenticated customer', async () => {
      prismaMock.backInStockAlert.findMany.mockResolvedValue([
        {
          id: 'alert-1',
          userId: 'user-1',
          productId: 'prod-1',
          status: BackInStockAlertStatus.PENDING,
          sentAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: {
            id: 'prod-1',
            name: 'Pencil 2B',
            slug: 'pencil-2b',
            sku: 'PENCIL-2B',
            priceCents: 4500,
            stockQuantity: 0,
            isActive: true,
            images: ['/pencil.jpg'],
            category: { name: 'Writing' },
          },
        },
      ]);

      const alerts = await service.getMyAlerts('user-1');
      expect(alerts).toHaveLength(1);
      expect(alerts[0].product?.name).toBe('Pencil 2B');
      expect(alerts[0].status).toBe(BackInStockAlertStatus.PENDING);
    });

    it('cancels an active alert owned by the customer', async () => {
      prismaMock.backInStockAlert.findUnique.mockResolvedValue({
        id: 'alert-1',
        userId: 'user-1',
        status: BackInStockAlertStatus.PENDING,
      });

      const result = await service.cancelAlert('user-1', 'alert-1');
      expect(result.success).toBe(true);
      expect(prismaMock.backInStockAlert.update).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: { status: BackInStockAlertStatus.CANCELLED },
      });
    });

    it('throws ForbiddenException if customer attempts to cancel another user alert', async () => {
      prismaMock.backInStockAlert.findUnique.mockResolvedValue({
        id: 'alert-1',
        userId: 'victim-user',
        status: BackInStockAlertStatus.PENDING,
      });

      await expect(service.cancelAlert('attacker-user', 'alert-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('rejects cancellation if the alert was already sent', async () => {
      prismaMock.backInStockAlert.findUnique.mockResolvedValue({
        id: 'alert-1',
        userId: 'user-1',
        status: BackInStockAlertStatus.SENT,
      });

      await expect(service.cancelAlert('user-1', 'alert-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('Automatic Stock Restock Notification Processing', () => {
    it('notifies multiple subscribed customers when stock transitions from zero to positive', async () => {
      prismaMock.backInStockAlert.findMany
        .mockResolvedValueOnce([{ id: 'a1' }, { id: 'a2' }]) // step 1 findMany
        .mockResolvedValueOnce([                              // step 3 findMany claimed
          {
            id: 'a1',
            status: BackInStockAlertStatus.PROCESSING,
            user: { id: 'u1', name: 'Alice Perera', email: 'alice@example.com' },
            product: {
              id: 'prod-out',
              name: 'Atlas Gel Pen',
              slug: 'atlas-gel-pen',
              priceCents: 12000,
              stockQuantity: 20,
              isActive: true,
              images: ['/pen.png'],
            },
          },
          {
            id: 'a2',
            status: BackInStockAlertStatus.PROCESSING,
            user: { id: 'u2', name: 'Bob Silva', email: 'bob@example.com' },
            product: {
              id: 'prod-out',
              name: 'Atlas Gel Pen',
              slug: 'atlas-gel-pen',
              priceCents: 12000,
              stockQuantity: 20,
              isActive: true,
              images: ['/pen.png'],
            },
          },
        ]);

      prismaMock.backInStockAlert.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.processStockRestocked('prod-out');
      expect(result.processedCount).toBe(2);
      expect(result.sentCount).toBe(2);
      expect(notificationsMock.sendBackInStockAlert).toHaveBeenCalledTimes(2);

      // Verify each alert status was updated to SENT
      expect(prismaMock.backInStockAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a1' },
          data: expect.objectContaining({ status: BackInStockAlertStatus.SENT }),
        })
      );
      expect(prismaMock.backInStockAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a2' },
          data: expect.objectContaining({ status: BackInStockAlertStatus.SENT }),
        })
      );
    });

    it('does nothing when no pending alerts exist for the restocked product', async () => {
      prismaMock.backInStockAlert.findMany.mockResolvedValueOnce([]);

      const result = await service.processStockRestocked('prod-none');
      expect(result.processedCount).toBe(0);
      expect(result.sentCount).toBe(0);
      expect(notificationsMock.sendBackInStockAlert).not.toHaveBeenCalled();
    });

    it('enforces concurrent processing protection by claiming via PROCESSING status', async () => {
      prismaMock.backInStockAlert.findMany.mockResolvedValueOnce([{ id: 'a1' }]);
      // Another concurrent worker claimed the alert first:
      prismaMock.backInStockAlert.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.processStockRestocked('prod-out');
      expect(result.processedCount).toBe(0);
      expect(result.sentCount).toBe(0);
      expect(notificationsMock.sendBackInStockAlert).not.toHaveBeenCalled();
    });

    it('handles definite email delivery failure safely by resetting alert to PENDING', async () => {
      prismaMock.backInStockAlert.findMany
        .mockResolvedValueOnce([{ id: 'a1' }])
        .mockResolvedValueOnce([
          {
            id: 'a1',
            status: BackInStockAlertStatus.PROCESSING,
            user: { id: 'u1', name: 'Alice Perera', email: 'alice@example.com' },
            product: {
              id: 'prod-out',
              name: 'Atlas Gel Pen',
              slug: 'atlas-gel-pen',
              priceCents: 12000,
              stockQuantity: 10,
              isActive: true,
              images: ['/pen.png'],
            },
          },
        ]);

      prismaMock.backInStockAlert.updateMany.mockResolvedValue({ count: 1 });
      notificationsMock.sendBackInStockAlert.mockRejectedValueOnce(
        new DefiniteDeliveryException('Mailbox unavailable or invalid address')
      );

      const result = await service.processStockRestocked('prod-out');
      expect(result.sentCount).toBe(0);
      expect(prismaMock.backInStockAlert.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: expect.objectContaining({
          status: BackInStockAlertStatus.PENDING,
          failureReason: 'Mailbox unavailable or invalid address',
          uncertainDelivery: false,
          leaseExpiresAt: null,
          processingStartedAt: null,
        }),
      });
    });

    it('handles uncertain provider timeout by flagging uncertainDelivery and holding PROCESSING lease', async () => {
      prismaMock.backInStockAlert.findMany
        .mockResolvedValueOnce([{ id: 'a1' }])
        .mockResolvedValueOnce([
          {
            id: 'a1',
            status: BackInStockAlertStatus.PROCESSING,
            user: { id: 'u1', name: 'Alice Perera', email: 'alice@example.com' },
            product: {
              id: 'prod-out',
              name: 'Atlas Gel Pen',
              slug: 'atlas-gel-pen',
              priceCents: 12000,
              stockQuantity: 10,
              isActive: true,
              images: ['/pen.png'],
            },
          },
        ]);

      prismaMock.backInStockAlert.updateMany.mockResolvedValue({ count: 1 });
      notificationsMock.sendBackInStockAlert.mockRejectedValueOnce(
        new UncertainDeliveryTimeoutException('Socket timeout after sending email data')
      );

      const result = await service.processStockRestocked('prod-out');
      expect(result.sentCount).toBe(0);
      expect(prismaMock.backInStockAlert.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: expect.objectContaining({
          uncertainDelivery: true,
          failureReason: expect.stringContaining('Uncertain provider timeout: Socket timeout after sending email data'),
        }),
      });
    });

    it('reverts alert to PENDING without sending email if product becomes out-of-stock again before dispatch', async () => {
      prismaMock.backInStockAlert.findMany
        .mockResolvedValueOnce([{ id: 'a1' }])
        .mockResolvedValueOnce([
          {
            id: 'a1',
            status: BackInStockAlertStatus.PROCESSING,
            user: { id: 'u1', name: 'Alice Perera', email: 'alice@example.com' },
            product: {
              id: 'prod-out',
              name: 'Atlas Gel Pen',
              slug: 'atlas-gel-pen',
              priceCents: 12000,
              stockQuantity: 0, // Rapidly bought out
              isActive: true,
              images: ['/pen.png'],
            },
          },
        ]);

      prismaMock.backInStockAlert.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.processStockRestocked('prod-out');
      expect(result.sentCount).toBe(0);
      expect(notificationsMock.sendBackInStockAlert).not.toHaveBeenCalled();
      expect(prismaMock.backInStockAlert.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: {
          status: BackInStockAlertStatus.PENDING,
          processingStartedAt: null,
          leaseExpiresAt: null,
          uncertainDelivery: false,
        },
      });
    });

    it('re为其 reuses existing idempotencyKey across retries to prevent duplicate delivery', async () => {
      prismaMock.backInStockAlert.findMany
        .mockResolvedValueOnce([{ id: 'a1' }])
        .mockResolvedValueOnce([
          {
            id: 'a1',
            status: BackInStockAlertStatus.PROCESSING,
            idempotencyKey: 'idemp-key-custom-1234',
            deliveryAttempts: 1,
            user: { id: 'u1', name: 'Alice Perera', email: 'alice@example.com' },
            product: {
              id: 'prod-out',
              name: 'Atlas Gel Pen',
              slug: 'atlas-gel-pen',
              priceCents: 12000,
              stockQuantity: 10,
              isActive: true,
              images: ['/pen.png'],
            },
          },
        ]);

      prismaMock.backInStockAlert.updateMany.mockResolvedValue({ count: 1 });

      await service.processStockRestocked('prod-out');
      expect(notificationsMock.sendBackInStockAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: 'idemp-key-custom-1234',
        })
      );
    });

    it('marks alert SENT only after confirmed provider acceptance', async () => {
      prismaMock.backInStockAlert.findMany
        .mockResolvedValueOnce([{ id: 'a1' }])
        .mockResolvedValueOnce([
          {
            id: 'a1',
            status: BackInStockAlertStatus.PROCESSING,
            user: { id: 'u1', name: 'Alice Perera', email: 'alice@example.com' },
            product: {
              id: 'prod-out',
              name: 'Atlas Gel Pen',
              slug: 'atlas-gel-pen',
              priceCents: 12000,
              stockQuantity: 10,
              isActive: true,
              images: ['/pen.png'],
            },
          },
        ]);

      prismaMock.backInStockAlert.updateMany.mockResolvedValue({ count: 1 });
      notificationsMock.sendBackInStockAlert.mockResolvedValueOnce({
        success: true,
        messageId: 'smtp-message-789',
      });

      const result = await service.processStockRestocked('prod-out');
      expect(result.sentCount).toBe(1);
      expect(prismaMock.backInStockAlert.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: expect.objectContaining({
          status: BackInStockAlertStatus.SENT,
          sentAt: expect.any(Date),
          failureReason: null,
          uncertainDelivery: false,
          leaseExpiresAt: null,
        }),
      });
    });
  });

  describe('Stale Alert Recovery & Reliability Hardening', () => {
    it('recovers stale PROCESSING alerts whose lease has expired to PENDING', async () => {
      const expiredLease = new Date(Date.now() - 10000);
      prismaMock.backInStockAlert.findMany
        .mockResolvedValueOnce([
          {
            id: 'stale-1',
            productId: 'prod-1',
            status: BackInStockAlertStatus.PROCESSING,
            leaseExpiresAt: expiredLease,
            product: { id: 'prod-1', stockQuantity: 5, isActive: true },
          },
        ]) // inside recoverStaleAlerts
        .mockResolvedValueOnce([{ id: 'stale-1' }]) // processStockRestocked findMany
        .mockResolvedValueOnce([                    // processStockRestocked claimed
          {
            id: 'stale-1',
            status: BackInStockAlertStatus.PROCESSING,
            user: { id: 'u1', name: 'Customer', email: 'cust@example.com' },
            product: { id: 'prod-1', name: 'Pencil', slug: 'pencil', stockQuantity: 5, isActive: true, priceCents: 5000, images: [] },
          },
        ]);

      prismaMock.backInStockAlert.updateMany
        .mockResolvedValueOnce({ count: 1 }) // atomic recovery
        .mockResolvedValueOnce({ count: 1 }); // processStockRestocked claim

      const result = await service.recoverStaleAlerts();
      expect(result.recoveredCount).toBe(1);
      expect(result.retriedCount).toBe(1);

      expect(prismaMock.backInStockAlert.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'stale-1',
          status: BackInStockAlertStatus.PROCESSING,
        },
        data: {
          status: BackInStockAlertStatus.PENDING,
          processingStartedAt: null,
          leaseExpiresAt: null,
          uncertainDelivery: false,
        },
      });
    });

    it('leaves non-expired PROCESSING alerts untouched', async () => {
      // findMany returns empty array because where filter excludes non-expired leases
      prismaMock.backInStockAlert.findMany.mockResolvedValueOnce([]);

      const result = await service.recoverStaleAlerts();
      expect(result.recoveredCount).toBe(0);
      expect(result.retriedCount).toBe(0);
      expect(prismaMock.backInStockAlert.updateMany).not.toHaveBeenCalled();
    });

    it('never recovers SENT alerts (query strictly filters by PROCESSING)', async () => {
      prismaMock.backInStockAlert.findMany.mockResolvedValueOnce([]);

      await service.recoverStaleAlerts();
      expect(prismaMock.backInStockAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: BackInStockAlertStatus.PROCESSING,
          }),
        })
      );
    });

    it('never recovers CANCELLED alerts', async () => {
      prismaMock.backInStockAlert.findMany.mockResolvedValueOnce([]);

      await service.recoverStaleAlerts();
      const whereArg = prismaMock.backInStockAlert.findMany.mock.calls[0][0].where;
      expect(whereArg.status).toBe(BackInStockAlertStatus.PROCESSING);
      expect(whereArg.status).not.toBe(BackInStockAlertStatus.CANCELLED);
    });

    it('prevents multiple workers from recovering or claiming the same alert atomically', async () => {
      prismaMock.backInStockAlert.findMany.mockResolvedValueOnce([
        {
          id: 'stale-1',
          productId: 'prod-1',
          status: BackInStockAlertStatus.PROCESSING,
          leaseExpiresAt: new Date(Date.now() - 5000),
          product: { id: 'prod-1', stockQuantity: 5, isActive: true },
        },
      ]);
      // Worker 2 tries to updateMany, but Worker 1 already changed it:
      prismaMock.backInStockAlert.updateMany.mockResolvedValueOnce({ count: 0 });

      const result = await service.recoverStaleAlerts();
      expect(result.recoveredCount).toBe(0);
      expect(result.retriedCount).toBe(0);
      expect(notificationsMock.sendBackInStockAlert).not.toHaveBeenCalled();
    });

    it('rechecks product stock before retrying recovered alerts and skips if out of stock', async () => {
      prismaMock.backInStockAlert.findMany.mockResolvedValueOnce([
        {
          id: 'stale-1',
          productId: 'prod-out',
          status: BackInStockAlertStatus.PROCESSING,
          leaseExpiresAt: new Date(Date.now() - 5000),
          product: { id: 'prod-out', stockQuantity: 0, isActive: true }, // Out of stock!
        },
      ]);
      prismaMock.backInStockAlert.updateMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.recoverStaleAlerts();
      expect(result.recoveredCount).toBe(1);
      expect(result.retriedCount).toBe(0); // Did not retry out-of-stock product
      expect(notificationsMock.sendBackInStockAlert).not.toHaveBeenCalled();
    });

    it('simulates recovery after server interruption and successfully completes delivery', async () => {
      // Alert was left in PROCESSING when previous server crashed
      prismaMock.backInStockAlert.findMany
        .mockResolvedValueOnce([
          {
            id: 'crashed-alert-1',
            productId: 'prod-1',
            status: BackInStockAlertStatus.PROCESSING,
            leaseExpiresAt: new Date(Date.now() - 60000),
            deliveryAttempts: 1,
            idempotencyKey: 'bis-crashed-1',
            product: { id: 'prod-1', stockQuantity: 10, isActive: true },
          },
        ])
        .mockResolvedValueOnce([{ id: 'crashed-alert-1' }])
        .mockResolvedValueOnce([
          {
            id: 'crashed-alert-1',
            status: BackInStockAlertStatus.PROCESSING,
            deliveryAttempts: 1,
            idempotencyKey: 'bis-crashed-1',
            user: { id: 'u1', name: 'John Doe', email: 'john@example.com' },
            product: { id: 'prod-1', name: 'A4 Book', slug: 'a4-book', stockQuantity: 10, isActive: true, priceCents: 25000, images: [] },
          },
        ]);

      prismaMock.backInStockAlert.updateMany
        .mockResolvedValueOnce({ count: 1 }) // atomic recovery to PENDING
        .mockResolvedValueOnce({ count: 1 }); // claimed by new server cycle

      notificationsMock.sendBackInStockAlert.mockResolvedValueOnce({
        success: true,
        messageId: 'msg-recovered-server',
      });

      const recoveryResult = await service.recoverStaleAlerts();
      expect(recoveryResult.recoveredCount).toBe(1);
      expect(recoveryResult.retriedCount).toBe(1);
      expect(notificationsMock.sendBackInStockAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          customerEmail: 'john@example.com',
          idempotencyKey: 'bis-crashed-1',
        })
      );
      expect(prismaMock.backInStockAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'crashed-alert-1' },
          data: expect.objectContaining({
            status: BackInStockAlertStatus.SENT,
          }),
        })
      );
    });
  });
});

