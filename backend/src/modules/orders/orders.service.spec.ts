import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { OrdersService, PERMITTED_STATUS_TRANSITIONS } from './orders.service';
import { OrderStatus, UserRole, InventoryChangeReason } from '../../generated/prisma';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { generateTrackingToken } from './utils/tracking-token.util';

describe('OrdersService', () => {
  let service: OrdersService;
  let mockPrisma: any;
  let mockInventoryGateway: any;
  let mockNotificationsService: any;

  beforeEach(() => {
    mockPrisma = {
      order: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      productVariant: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      inventoryMovement: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      stockReservationItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };

    mockInventoryGateway = {
      broadcastStockUpdate: vi.fn(),
    };

    mockNotificationsService = {
      sendPaymentOutcome: vi.fn().mockResolvedValue({ success: true, messageId: 'm1' }),
      sendOrderTrackingOtp: vi.fn().mockResolvedValue({ success: true, messageId: 'm2' }),
    };

    service = new OrdersService(
      mockPrisma as any,
      mockInventoryGateway as any,
      mockNotificationsService as any
    );
  });

  describe('getOrderById authorization and ownership', () => {
    it('allows staff or admin to view any order', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce({
        id: 'ord-1',
        orderNumber: 'DSL-2026-000001',
        userId: 'customer-other',
        customerEmail: 'other@dsl.lk',
      });

      const order = await service.getOrderById('ord-1', {
        id: 'staff-1',
        role: UserRole.STAFF,
      });

      expect(order.id).toBe('ord-1');
    });

    it('allows customer to view their own order by userId or email', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce({
        id: 'ord-1',
        orderNumber: 'DSL-2026-000001',
        userId: 'cust-123',
        customerEmail: 'cust@dsl.lk',
      });

      const order = await service.getOrderById('ord-1', {
        id: 'cust-123',
        role: UserRole.CUSTOMER,
        email: 'cust@dsl.lk',
      });

      expect(order.id).toBe('ord-1');
    });

    it('rejects unauthorized customer from viewing other customers orders', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce({
        id: 'ord-1',
        orderNumber: 'DSL-2026-000001',
        userId: 'cust-victim',
        customerEmail: 'victim@dsl.lk',
      });

      await expect(
        service.getOrderById('ord-1', {
          id: 'cust-attacker',
          role: UserRole.CUSTOMER,
          email: 'attacker@dsl.lk',
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows guest to view their order when a valid signed tracking token is provided', async () => {
      const mockOrder = {
        id: 'ord-guest-1',
        orderNumber: 'DSL-2026-000002',
        userId: null,
        customerEmail: 'guest.shopper@dsl.lk',
      };
      mockPrisma.order.findFirst.mockResolvedValueOnce(mockOrder);

      const validToken = generateTrackingToken(mockOrder);
      const order = await service.getOrderById('ord-guest-1', null, validToken);

      expect(order.id).toBe('ord-guest-1');
    });

    it('rejects guest when tracking token is invalid, tampered, or expired', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce({
        id: 'ord-guest-1',
        orderNumber: 'DSL-2026-000002',
        userId: null,
        customerEmail: 'guest.shopper@dsl.lk',
      });

      await expect(
        service.getOrderById('ord-guest-1', null, 'invalid.tampered.token')
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects guest request when no tracking token is provided (email alone is insufficient)', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce({
        id: 'ord-guest-1',
        orderNumber: 'DSL-2026-000002',
        userId: null,
        customerEmail: 'guest.shopper@dsl.lk',
      });

      await expect(service.getOrderById('ord-guest-1', null, null)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('throws NotFoundException when order does not exist', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getOrderById('non-existent', {
          id: 'admin-1',
          role: UserRole.ADMIN,
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('guest order tracking OTP (Phase B.1)', () => {
    it('requestTrackingOtp dispatches OTP email and stores hash', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce({
        id: 'ord-123',
        orderNumber: 'DSL-2026-999999',
        customerEmail: 'guest@example.com',
      });
      mockPrisma.order.update.mockResolvedValueOnce({});

      const result = await service.requestTrackingOtp('DSL-2026-999999', 'guest@example.com');
      expect(result.success).toBe(true);
      expect(mockNotificationsService.sendOrderTrackingOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'guest@example.com',
          orderNumber: 'DSL-2026-999999',
          otp: expect.stringMatching(/^\d{6}$/),
        })
      );
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-123' },
          data: expect.objectContaining({
            trackingOtpAttempts: 0,
          }),
        })
      );
    });

    it('verifyTrackingOtp returns signed token on correct OTP', async () => {
      const otp = '654321';
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

      mockPrisma.order.findFirst.mockResolvedValueOnce({
        id: 'ord-123',
        orderNumber: 'DSL-2026-999999',
        customerEmail: 'guest@example.com',
        trackingOtpHash: otpHash,
        trackingOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        trackingOtpAttempts: 0,
      });
      mockPrisma.order.update.mockResolvedValueOnce({});

      const result = await service.verifyTrackingOtp('DSL-2026-999999', 'guest@example.com', '654321');
      expect(result.success).toBe(true);
      expect(result.trackingToken).toBeDefined();
      expect(typeof result.trackingToken).toBe('string');
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-123' },
          data: expect.objectContaining({
            trackingOtpHash: null,
            trackingOtpExpiresAt: null,
            trackingOtpAttempts: 0,
          }),
        })
      );
    });

    it('verifyTrackingOtp rejects invalid OTP and increments attempt count', async () => {
      const otpHash = crypto.createHash('sha256').update('654321').digest('hex');

      mockPrisma.order.findFirst.mockResolvedValueOnce({
        id: 'ord-123',
        orderNumber: 'DSL-2026-999999',
        customerEmail: 'guest@example.com',
        trackingOtpHash: otpHash,
        trackingOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        trackingOtpAttempts: 2,
      });

      await expect(
        service.verifyTrackingOtp('DSL-2026-999999', 'guest@example.com', '000000')
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-123' },
        data: { trackingOtpAttempts: { increment: 1 } },
      });
    });
  });

  describe('updateStatus & Exactly-Once Stock Restoration', () => {
    it('enforces permitted status transitions', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 'ord-1',
        orderStatus: OrderStatus.CONFIRMED,
        items: [],
      });

      // Transition CONFIRMED -> DELIVERED is not permitted directly
      await expect(
        service.updateStatus('ord-1', { status: OrderStatus.DELIVERED })
      ).rejects.toThrow(ForbiddenException);
    });

    it('restores physical stock and writes audit movement when order is cancelled', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 'ord-1',
        orderNumber: 'DSL-2026-444444',
        orderStatus: OrderStatus.CONFIRMED,
        totalCents: 50000,
        customerEmail: 'test@dsl.lk',
        customerName: 'Test Buyer',
        items: [
          {
            id: 'it-1',
            productId: 'prod-pen',
            variantId: null,
            quantity: 3,
          },
        ],
      });

      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'prod-pen',
        stockQuantity: 10,
      });

      mockPrisma.order.update.mockResolvedValueOnce({
        id: 'ord-1',
        orderNumber: 'DSL-2026-444444',
        orderStatus: OrderStatus.CANCELLED,
      });

      const updated = await service.updateStatus('ord-1', { status: OrderStatus.CANCELLED });

      expect(updated.orderStatus).toBe(OrderStatus.CANCELLED);
      // Stock incremented by 3
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-pen' },
          data: { stockQuantity: { increment: 3 } },
        })
      );
      // Inventory movement audit record created
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-pen',
            changeAmount: 3,
            reason: InventoryChangeReason.RESTOCK,
            note: expect.stringContaining('Restored stock from cancelled order DSL-2026-444444'),
          }),
        })
      );
      // Notification dispatched
      expect(mockNotificationsService.sendPaymentOutcome).toHaveBeenCalledWith(
        expect.objectContaining({
          orderNumber: 'DSL-2026-444444',
          status: 'CANCELLED',
        })
      );
    });

    it('does not restore stock twice if order was already restored', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 'ord-1',
        orderNumber: 'DSL-2026-444444',
        orderStatus: OrderStatus.PROCESSING,
        items: [{ id: 'it-1', productId: 'prod-pen', quantity: 3 }],
      });

      // Simulate already restored
      mockPrisma.inventoryMovement.findFirst.mockResolvedValueOnce({
        id: 'mov-already-restored',
      });

      mockPrisma.order.update.mockResolvedValueOnce({
        id: 'ord-1',
        orderStatus: OrderStatus.CANCELLED,
      });

      await service.updateStatus('ord-1', { status: OrderStatus.CANCELLED });

      // product.update should NOT be called to avoid double restock
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });
  });

  describe('buyAgain (Phase 15.3)', () => {
    const mockOrder = {
      id: 'ord-buyagain-1',
      orderNumber: 'DSL-2026-999001',
      userId: 'customer-1',
      customerEmail: 'cust1@dsl.lk',
      notes: null,
      items: [
        {
          id: 'item-1',
          productId: 'prod-cr-book',
          variantId: null,
          productName: 'CR Book 120 Pages',
          variantName: null,
          sku: 'SKU-CR-120',
          unitPriceCents: 20000,
          quantity: 3,
        },
      ],
    };

    it('successfully processes Buy Again when all products are in stock with unchanged prices', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(mockOrder);
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'prod-cr-book',
        name: 'CR Book 120 Pages',
        slug: 'cr-book-120',
        sku: 'SKU-CR-120',
        priceCents: 20000,
        stockQuantity: 50,
        isActive: true,
        images: ['/cr.png'],
        variants: [],
      });

      const res = await service.buyAgain('ord-buyagain-1', {
        id: 'customer-1',
        role: UserRole.CUSTOMER,
        email: 'cust1@dsl.lk',
      });

      expect(res.success).toBe(true);
      expect(res.orderNumber).toBe('DSL-2026-999001');
      expect(res.items).toHaveLength(1);
      expect(res.items[0].status).toBe('AVAILABLE');
      expect(res.items[0].availableQuantity).toBe(3);
      expect(res.items[0].currentPriceCents).toBe(20000);
      expect(res.items[0].priceChanged).toBe(false);
      expect(res.summary.availableCount).toBe(1);
      expect(res.summary.partialCount).toBe(0);
      expect(res.summary.unavailableCount).toBe(0);
      expect(res.summary.estimatedTotalCents).toBe(60000);
    });

    it('rejects another customer attempting to reorder an order they do not own', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(mockOrder);

      await expect(
        service.buyAgain('ord-buyagain-1', {
          id: 'customer-attacker',
          role: UserRole.CUSTOMER,
          email: 'attacker@dsl.lk',
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows staff or admin to evaluate buy again for any order', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(mockOrder);
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'prod-cr-book',
        name: 'CR Book 120 Pages',
        priceCents: 20000,
        stockQuantity: 10,
        isActive: true,
        variants: [],
      });

      const res = await service.buyAgain('ord-buyagain-1', {
        id: 'admin-1',
        role: UserRole.ADMIN,
      });

      expect(res.success).toBe(true);
      expect(res.items[0].status).toBe('AVAILABLE');
    });

    it('throws NotFoundException when order does not exist', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.buyAgain('non-existent-order', {
          id: 'customer-1',
          role: UserRole.CUSTOMER,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('handles deleted/missing products correctly', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(mockOrder);
      // Product deleted or not found in catalog
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);

      const res = await service.buyAgain('ord-buyagain-1', {
        id: 'customer-1',
        role: UserRole.CUSTOMER,
        email: 'cust1@dsl.lk',
      });

      expect(res.items[0].status).toBe('UNAVAILABLE');
      expect(res.items[0].reason).toBe('PRODUCT_NOT_FOUND');
      expect(res.items[0].availableQuantity).toBe(0);
      expect(res.summary.unavailableCount).toBe(1);
    });

    it('handles discontinued products (isActive: false) as UNAVAILABLE', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(mockOrder);
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'prod-cr-book',
        name: 'CR Book 120 Pages',
        priceCents: 20000,
        stockQuantity: 100,
        isActive: false, // Discontinued
        variants: [],
      });

      const res = await service.buyAgain('ord-buyagain-1', {
        id: 'customer-1',
        role: UserRole.CUSTOMER,
        email: 'cust1@dsl.lk',
      });

      expect(res.items[0].status).toBe('UNAVAILABLE');
      expect(res.items[0].reason).toBe('DISCONTINUED');
      expect(res.items[0].availableQuantity).toBe(0);
    });

    it('handles out of stock products as UNAVAILABLE with OUT_OF_STOCK reason', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(mockOrder);
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'prod-cr-book',
        name: 'CR Book 120 Pages',
        priceCents: 20000,
        stockQuantity: 0, // Out of stock
        isActive: true,
        variants: [],
      });

      const res = await service.buyAgain('ord-buyagain-1', {
        id: 'customer-1',
        role: UserRole.CUSTOMER,
        email: 'cust1@dsl.lk',
      });

      expect(res.items[0].status).toBe('UNAVAILABLE');
      expect(res.items[0].reason).toBe('OUT_OF_STOCK');
      expect(res.items[0].availableQuantity).toBe(0);
    });

    it('handles partial stock availability (requested 3, available 1)', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(mockOrder);
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'prod-cr-book',
        name: 'CR Book 120 Pages',
        priceCents: 20000,
        stockQuantity: 1, // Only 1 available
        isActive: true,
        variants: [],
      });

      const res = await service.buyAgain('ord-buyagain-1', {
        id: 'customer-1',
        role: UserRole.CUSTOMER,
        email: 'cust1@dsl.lk',
      });

      expect(res.items[0].status).toBe('PARTIAL');
      expect(res.items[0].reason).toBe('INSUFFICIENT_STOCK');
      expect(res.items[0].requestedQuantity).toBe(3);
      expect(res.items[0].availableQuantity).toBe(1);
      expect(res.summary.partialCount).toBe(1);
    });

    it('detects and flags changed product prices', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(mockOrder);
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'prod-cr-book',
        name: 'CR Book 120 Pages',
        priceCents: 25000, // Increased from 20000
        stockQuantity: 50,
        isActive: true,
        variants: [],
      });

      const res = await service.buyAgain('ord-buyagain-1', {
        id: 'customer-1',
        role: UserRole.CUSTOMER,
        email: 'cust1@dsl.lk',
      });

      expect(res.items[0].status).toBe('AVAILABLE');
      expect(res.items[0].priceChanged).toBe(true);
      expect(res.items[0].historicalPriceCents).toBe(20000);
      expect(res.items[0].currentPriceCents).toBe(25000);
      expect(res.items[0].reason).toBe('PRICE_CHANGED');
    });

    it('handles product variants properly and uses variant stock & price', async () => {
      const orderWithVariant = {
        ...mockOrder,
        items: [
          {
            id: 'item-v1',
            productId: 'prod-pen',
            variantId: 'var-blue',
            productName: 'Ballpoint Pen',
            variantName: 'Blue Ink',
            sku: 'SKU-PEN-BL',
            unitPriceCents: 6000,
            quantity: 5,
          },
        ],
      };

      mockPrisma.order.findFirst.mockResolvedValueOnce(orderWithVariant);
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'prod-pen',
        name: 'Ballpoint Pen',
        priceCents: 5000,
        stockQuantity: 100,
        isActive: true,
        variants: [
          {
            id: 'var-blue',
            name: 'Blue Ink',
            sku: 'SKU-PEN-BL',
            priceCents: 6500, // variant specific price
            stockQuantity: 10, // variant specific stock
            isActive: true,
          },
        ],
      });

      const res = await service.buyAgain('ord-buyagain-1', {
        id: 'customer-1',
        role: UserRole.CUSTOMER,
        email: 'cust1@dsl.lk',
      });

      expect(res.items[0].status).toBe('AVAILABLE');
      expect(res.items[0].variantId).toBe('var-blue');
      expect(res.items[0].variantName).toBe('Blue Ink');
      expect(res.items[0].currentPriceCents).toBe(6500);
      expect(res.items[0].availableQuantity).toBe(5);
    });

    it('preserves School Pack bundleInfo when bundle is still active in database', async () => {
      const orderWithBundle = {
        ...mockOrder,
        notes: JSON.stringify({
          schoolPacks: [
            {
              packId: 'pack-grade-1',
              packName: 'Grade 1 Starter Pack',
              items: [{ productId: 'prod-cr-book', variantId: null }],
            },
          ],
        }),
      };

      mockPrisma.order.findFirst.mockResolvedValueOnce(orderWithBundle);
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'prod-cr-book',
        name: 'CR Book 120 Pages',
        priceCents: 20000,
        stockQuantity: 20,
        isActive: true,
        variants: [],
      });
      mockPrisma.schoolPack = {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: 'pack-grade-1',
          name: 'Grade 1 Starter Pack',
          savingsPercentage: 15,
          isActive: true,
        }),
      };

      const res = await service.buyAgain('ord-buyagain-1', {
        id: 'customer-1',
        role: UserRole.CUSTOMER,
        email: 'cust1@dsl.lk',
      });

      expect(res.items[0].bundleInfo).toEqual({
        packId: 'pack-grade-1',
        packName: 'Grade 1 Starter Pack',
        savingsPercentage: 15,
      });
    });
  });
});

