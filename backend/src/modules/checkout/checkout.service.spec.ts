import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { CheckoutService } from './checkout.service';
import { ReservationStatus, PaymentMethod, PaymentAttemptStatus, OrderStatus, PaymentStatus } from '../../generated/prisma';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let mockPrisma: any;
  let mockInventoryGateway: any;
  let mockCartService: any;
  let mockNotificationsService: any;

  beforeEach(() => {
    mockPrisma = {
      product: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: 'p1', stockQuantity: 10 }),
      },
      productVariant: {
        update: vi.fn().mockResolvedValue({ id: 'v1', stockQuantity: 5 }),
      },
      storeSettings: {
        findUnique: vi.fn().mockResolvedValue({
          flatDeliveryFeeCents: 35000,
          freeDeliveryThresholdCents: 500000,
        }),
      },
      promotion: {
        findUnique: vi.fn(),
      },
      schoolPack: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      stockReservation: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      stockReservationItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      paymentAttempt: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: 'att-1' }),
        update: vi.fn().mockResolvedValue({ id: 'att-1' }),
      },
      order: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: 'ord-1' }),
      },
      inventoryMovement: {
        create: vi.fn(),
      },
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'Product 1', priceCents: 100000, stockQuantity: 20, isActive: true },
      ]),
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };

    mockInventoryGateway = {
      broadcastStockUpdate: vi.fn(),
    };

    mockCartService = {
      clearCart: vi.fn().mockResolvedValue(true),
      removePurchasedItems: vi.fn().mockResolvedValue(true),
    };

    mockNotificationsService = {
      sendOrderConfirmation: vi.fn().mockResolvedValue({ success: true, messageId: 'm1' }),
      sendPaymentOutcome: vi.fn().mockResolvedValue({ success: true, messageId: 'm2' }),
    };

    service = new CheckoutService(
      mockPrisma as any,
      mockInventoryGateway as any,
      mockCartService as any,
      mockNotificationsService as any
    );

    process.env.PAYHERE_MERCHANT_ID = '1211149';
    process.env.PAYHERE_MERCHANT_SECRET = 'dsl_payhere_sandbox_secret';
  });

  describe('calculateAuthoritativeTotals', () => {
    it('calculates integer cents totals with delivery fee when under threshold', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'p1',
        priceCents: 100000, // Rs. 1000.00
        variants: [],
      });

      const totals = await service.calculateAuthoritativeTotals([
        { productId: 'p1', variantId: null, quantity: 2 }, // 200000 cents
      ]);

      expect(totals.subtotalCents).toBe(200000);
      expect(totals.isFreeDelivery).toBe(false);
      expect(totals.deliveryCents).toBe(35000);
      expect(totals.totalCents).toBe(235000);
    });

    it('applies free delivery when subtotal meets or exceeds threshold', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'p1',
        priceCents: 500000, // Rs. 5000.00
        variants: [],
      });

      const totals = await service.calculateAuthoritativeTotals([
        { productId: 'p1', variantId: null, quantity: 1 },
      ]);

      expect(totals.subtotalCents).toBe(500000);
      expect(totals.isFreeDelivery).toBe(true);
      expect(totals.deliveryCents).toBe(0);
      expect(totals.totalCents).toBe(500000);
    });

    it('applies percentage voucher discount correctly and caps at maximum', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'p1',
        priceCents: 200000,
        variants: [],
      });
      mockPrisma.promotion.findUnique.mockResolvedValueOnce({
        code: 'SAVE10',
        isActive: true,
        startDate: new Date(Date.now() - 100000),
        endDate: new Date(Date.now() + 100000),
        discountType: 'PERCENTAGE',
        discountValue: 10,
        minOrderAmountCents: 100000,
        maxDiscountCents: 15000, // cap at 150.00
      });

      const totals = await service.calculateAuthoritativeTotals(
        [{ productId: 'p1', variantId: null, quantity: 1 }],
        'SAVE10'
      );

      // 10% of 200000 is 20000, capped at 15000
      expect(totals.discountCents).toBe(15000);
      expect(totals.voucherApplied?.code).toBe('SAVE10');
      expect(totals.totalCents).toBe(200000 - 15000 + 35000);
    });
  });

  describe('validatePrePay and PayHere Hash Generation', () => {
    it('throws BadRequestException if reservation has been released or consumed', async () => {
      mockPrisma.stockReservation.findUnique.mockResolvedValueOnce({
        id: 'res-released',
        status: ReservationStatus.RELEASED,
        items: [],
      });

      await expect(
        service.validatePrePay({
          reservationId: 'res-released',
          deliveryAddress: {
            fullName: 'Test User',
            phone: '0771234567',
            email: 'test@dsl.lk',
            addressLine1: 'No 1, Main St',
            city: 'Colombo',
            district: 'Colombo',
          },
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario B: throws BadRequestException if expired reservation has insufficient stock', async () => {
      mockPrisma.stockReservation.findUnique.mockResolvedValueOnce({
        id: 'res-expired',
        status: ReservationStatus.EXPIRED,
        expiresAt: new Date(Date.now() - 10000),
        items: [
          {
            productId: 'p1',
            variantId: null,
            quantity: 5,
            product: { id: 'p1', name: 'Exercise Book', priceCents: 10000 },
            variant: null,
          },
        ],
      });
      mockPrisma.product.findUnique.mockResolvedValueOnce({ id: 'p1', priceCents: 10000, variants: [] });
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { id: 'p1', name: 'Exercise Book', stockQuantity: 2, isActive: true }, // Only 2 available, requested 5!
      ]);
      mockPrisma.stockReservationItem.findMany.mockResolvedValueOnce([]);

      await expect(
        service.validatePrePay({
          reservationId: 'res-expired',
          deliveryAddress: {
            fullName: 'Test User',
            phone: '0771234567',
            email: 'test@dsl.lk',
            addressLine1: 'No 1, Main St',
            city: 'Colombo',
            district: 'Colombo',
          },
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario A: atomically secures stock under PAYMENT_PENDING if expired reservation still has sufficient stock', async () => {
      mockPrisma.stockReservation.findUnique.mockResolvedValueOnce({
        id: 'res-expired-ok',
        status: ReservationStatus.EXPIRED,
        expiresAt: new Date(Date.now() - 10000),
        items: [
          {
            productId: 'p1',
            variantId: null,
            quantity: 2,
            product: { id: 'p1', name: 'Exercise Book', priceCents: 10000 },
            variant: null,
          },
        ],
      });
      mockPrisma.product.findUnique.mockResolvedValueOnce({ id: 'p1', priceCents: 10000, variants: [] });
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { id: 'p1', name: 'Exercise Book', stockQuantity: 15, isActive: true }, // 15 available >= 2!
      ]);
      mockPrisma.stockReservationItem.findMany.mockResolvedValueOnce([]);

      const result = await service.validatePrePay({
        reservationId: 'res-expired-ok',
        deliveryAddress: {
          fullName: 'Test User',
          phone: '0771234567',
          email: 'test@dsl.lk',
          addressLine1: 'No 1, Main St',
          city: 'Colombo',
          district: 'Colombo',
        },
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      expect(result.isValid).toBe(true);
      expect(mockPrisma.stockReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-expired-ok' },
          data: expect.objectContaining({ status: ReservationStatus.PAYMENT_PENDING }),
        })
      );
    });

    it('generates official PayHere checkout payload and valid MD5 hash without exposing secret', async () => {
      process.env.PAYHERE_MERCHANT_ID = '1211149';
      process.env.PAYHERE_MERCHANT_SECRET = 'test_secret_123';

      mockPrisma.stockReservation.findUnique.mockResolvedValueOnce({
        id: 'res-valid',
        status: ReservationStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 500000),
        items: [
          {
            productId: 'p1',
            variantId: null,
            quantity: 1,
            product: { id: 'p1', name: 'Pen', priceCents: 100000, stockQuantity: 20 },
            variant: null,
          },
        ],
      });
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'p1',
        priceCents: 100000,
        variants: [],
      });

      const result = await service.validatePrePay({
        reservationId: 'res-valid',
        deliveryAddress: {
          fullName: 'Kavindu Senanayake',
          phone: '0771234567',
          email: 'kavindu@dsl.lk',
          addressLine1: 'No 42, Galle Rd',
          city: 'Colombo',
          district: 'Colombo',
        },
        paymentMethod: PaymentMethod.CARD_PAYHERE,
      });

      expect(result.isValid).toBe(true);
      expect(result.payHerePayload).toBeDefined();
      expect(result.payHerePayload?.merchant_id).toBe('1211149');
      expect(result.payHerePayload?.currency).toBe('LKR');
      expect(result.payHerePayload?.amount).toBe('1350.00'); // 1000.00 + 350.00 delivery

      // Verify MD5 hash format matches official PayHere formula:
      // strtoupper(md5(merchant_id + order_id + amount + currency + strtoupper(md5(merchant_secret))))
      const hashedSecret = crypto.createHash('md5').update('test_secret_123').digest('hex').toUpperCase();
      const expectedHash = crypto
        .createHash('md5')
        .update(`1211149${result.payHerePayload?.order_id}1350.00LKR${hashedSecret}`)
        .digest('hex')
        .toUpperCase();

      expect(result.payHerePayload?.hash).toBe(expectedHash);
    });
  });

  describe('handlePayHereWebhook', () => {
    const merchantId = '1211149';
    const secret = 'dsl_payhere_sandbox_secret';
    process.env.PAYHERE_MERCHANT_ID = merchantId;
    process.env.PAYHERE_MERCHANT_SECRET = secret;

    function generateWebhookSig(orderId: string, amount: string, currency: string, statusCode: string) {
      const hashedSecret = crypto.createHash('md5').update(secret).digest('hex').toUpperCase();
      return crypto
        .createHash('md5')
        .update(`${merchantId}${orderId}${amount}${currency}${statusCode}${hashedSecret}`)
        .digest('hex')
        .toUpperCase();
    }

    it('rejects webhooks with invalid signatures', async () => {
      await expect(
        service.handlePayHereWebhook({
          merchant_id: merchantId,
          order_id: 'DSL-101',
          payment_id: 'pay-1',
          payhere_amount: '1000.00',
          payhere_currency: 'LKR',
          status_code: '2',
          md5sig: 'INVALID_SIGNATURE',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects webhooks with incorrect merchant ID', async () => {
      const sig = generateWebhookSig('DSL-101', '1000.00', 'LKR', '2');
      await expect(
        service.handlePayHereWebhook({
          merchant_id: 'WRONG_MERCHANT_ID',
          order_id: 'DSL-101',
          payment_id: 'pay-1',
          payhere_amount: '1000.00',
          payhere_currency: 'LKR',
          status_code: '2',
          md5sig: sig,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects webhooks with currency other than LKR', async () => {
      const hashedSecret = crypto.createHash('md5').update(secret).digest('hex').toUpperCase();
      const sig = crypto.createHash('md5').update(`${merchantId}DSL-1011000.00USD2${hashedSecret}`).digest('hex').toUpperCase();

      await expect(
        service.handlePayHereWebhook({
          merchant_id: merchantId,
          order_id: 'DSL-101',
          payment_id: 'pay-1',
          payhere_amount: '1000.00',
          payhere_currency: 'USD',
          status_code: '2',
          md5sig: sig,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('processes successful payment (status 2) and updates status to SUCCEEDED', async () => {
      const sig = generateWebhookSig('DSL-200', '1000.00', 'LKR', '2');

      mockPrisma.paymentAttempt.findFirst.mockResolvedValueOnce({
        id: 'att-200',
        reservationId: 'res-200',
        amountCents: 100000,
        currency: 'LKR',
        status: PaymentAttemptStatus.PROCESSING,
        idempotencyKey: 'idemp-200',
        gatewayPayload: {
          deliveryAddress: {
            fullName: 'Test Customer',
            phone: '0771234567',
            email: 'test@dsl.lk',
            addressLine1: 'No 5, Kandy Rd',
            city: 'Colombo',
            district: 'Colombo',
          },
        },
      });

      // Mock processPayment inside webhook
      mockPrisma.stockReservation.findUnique.mockResolvedValue({
        id: 'res-200',
        status: ReservationStatus.PAYMENT_PENDING,
        expiresAt: new Date(Date.now() + 100000),
        items: [],
      });
      mockPrisma.order.create.mockResolvedValueOnce({
        id: 'ord-200',
        orderNumber: 'DSL-2026-999999',
        customerName: 'Test Customer',
        customerEmail: 'test@dsl.lk',
        customerPhone: '0771234567',
        totalCents: 100000,
        paymentMethod: PaymentMethod.CARD_PAYHERE,
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.CONFIRMED,
        items: [],
        addressSnapshot: { addressLine1: 'No 5', city: 'Colombo' },
      });

      const res = await service.handlePayHereWebhook({
        merchant_id: merchantId,
        order_id: 'DSL-200',
        payment_id: 'payhere-trans-12345',
        payhere_amount: '1000.00',
        payhere_currency: 'LKR',
        status_code: '2',
        md5sig: sig,
        custom_1: 'res-200',
        custom_2: 'idemp-200',
      });

      expect(res.status).toBe('success');
      expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att-200' },
          data: expect.objectContaining({
            status: PaymentAttemptStatus.SUCCEEDED,
            gatewayReference: 'payhere-trans-12345',
          }),
        })
      );
      expect(mockNotificationsService.sendPaymentOutcome).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SUCCESS' })
      );
    });

    it('is idempotent on duplicate successful payment callbacks', async () => {
      const sig = generateWebhookSig('DSL-200', '1000.00', 'LKR', '2');

      mockPrisma.paymentAttempt.findFirst.mockResolvedValueOnce({
        id: 'att-200',
        amountCents: 100000,
        status: PaymentAttemptStatus.SUCCEEDED, // Already processed
        orderId: 'ord-200',
      });

      const res = await service.handlePayHereWebhook({
        merchant_id: merchantId,
        order_id: 'DSL-200',
        payment_id: 'payhere-trans-12345',
        payhere_amount: '1000.00',
        payhere_currency: 'LKR',
        status_code: '2',
        md5sig: sig,
      });

      expect(res.status).toBe('success');
      expect(res.message).toBe('Payment already processed');
      // No order creation called again
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });

    it('handles cancelled/failed payment (status -1) by releasing reservation and marking attempt FAILED', async () => {
      const sig = generateWebhookSig('DSL-300', '1000.00', 'LKR', '-1');

      mockPrisma.paymentAttempt.findFirst.mockResolvedValueOnce({
        id: 'att-300',
        reservationId: 'res-300',
        amountCents: 100000,
        status: PaymentAttemptStatus.PROCESSING,
        reservation: {
          id: 'res-300',
          status: ReservationStatus.PAYMENT_PENDING,
          items: [{ productId: 'p1', variantId: null }],
        },
      });

      const res = await service.handlePayHereWebhook({
        merchant_id: merchantId,
        order_id: 'DSL-300',
        payment_id: 'pay-fail-1',
        payhere_amount: '1000.00',
        payhere_currency: 'LKR',
        status_code: '-1',
        status_message: 'User cancelled payment',
        md5sig: sig,
      });

      expect(res.status).toBe('failed');
      expect(mockPrisma.stockReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-300' },
          data: { status: ReservationStatus.RELEASED },
        })
      );
      expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att-300' },
          data: expect.objectContaining({
            status: PaymentAttemptStatus.FAILED,
          }),
        })
      );
      expect(mockNotificationsService.sendPaymentOutcome).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CANCELLED' })
      );
    });

    it('safely aborts late payment (status 2) on expired reservation when stock is insufficient without overselling', async () => {
      const sig = generateWebhookSig('DSL-EXPIRED-1', '1000.00', 'LKR', '2');

      mockPrisma.paymentAttempt.findFirst.mockResolvedValueOnce({
        id: 'att-late-1',
        reservationId: 'res-expired-1',
        amountCents: 100000,
        status: PaymentAttemptStatus.EXPIRED,
        reservation: {
          id: 'res-expired-1',
          status: ReservationStatus.EXPIRED,
          items: [{ productId: 'p1', variantId: null, quantity: 5 }],
        },
      });

      // Product stock has been depleted by other customers to 0
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'p1',
        stockQuantity: 0,
      });

      const res = await service.handlePayHereWebhook({
        merchant_id: merchantId,
        order_id: 'DSL-EXPIRED-1',
        payment_id: 'pay-late-123',
        payhere_amount: '1000.00',
        payhere_currency: 'LKR',
        status_code: '2',
        md5sig: sig,
      });

      expect(res.status).toBe('expired');
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
      expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att-late-1' },
          data: expect.objectContaining({
            status: PaymentAttemptStatus.FAILED,
            gatewayReference: 'pay-late-123',
            failureReason: expect.stringContaining('Payment captured after reservation expired'),
          }),
        })
      );
    });

    it('handles PayHere chargeback (status -3) as a dispute without restoring already-fulfilled physical stock', async () => {
      const sig = generateWebhookSig('DSL-CHARGEBACK-1', '1000.00', 'LKR', '-3');

      mockPrisma.paymentAttempt.findFirst.mockResolvedValueOnce({
        id: 'att-cb-1',
        orderId: 'ord-cb-1',
        reservationId: 'res-cb-1',
        amountCents: 100000,
        status: PaymentAttemptStatus.SUCCEEDED,
        reservation: {
          id: 'res-cb-1',
          status: ReservationStatus.CONSUMED,
          items: [{ productId: 'p1', variantId: null, quantity: 2 }],
        },
      });

      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 'ord-cb-1',
        orderNumber: 'DSL-2026-999999',
        notes: 'Original order notes',
      });

      const res = await service.handlePayHereWebhook({
        merchant_id: merchantId,
        order_id: 'DSL-CHARGEBACK-1',
        payment_id: 'pay-dispute-888',
        payhere_amount: '1000.00',
        payhere_currency: 'LKR',
        status_code: '-3',
        status_message: 'Customer initiated cardholder dispute',
        md5sig: sig,
      });

      expect(res.status).toBe('chargedback');
      // Payment attempt marked FAILED with dispute reason
      expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att-cb-1' },
          data: expect.objectContaining({
            status: PaymentAttemptStatus.FAILED,
            failureReason: expect.stringContaining('Chargeback'),
          }),
        })
      );

      // Order notes updated with dispute flag
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-cb-1' },
          data: expect.objectContaining({
            notes: expect.stringContaining('CHARGEBACK DISPUTE'),
          }),
        })
      );

      // Invariant: Physical stock was NOT restored (product.update NOT called with increment)
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
      // Invariant: Reservation was NOT released (remains CONSUMED)
      expect(mockPrisma.stockReservation.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: ReservationStatus.RELEASED },
        })
      );
    });
  });

  describe('processPayment Idempotency & Concurrency Safety', () => {
    it('gracefully returns existing order when reservation was already completed (idempotent duplicate)', async () => {
      mockPrisma.paymentAttempt.findUnique.mockResolvedValueOnce(null);
      mockPrisma.stockReservation.findUnique.mockResolvedValueOnce({
        id: 'res-already-consumed',
        status: ReservationStatus.CONSUMED,
        orderId: 'ord-existing-1',
        items: [],
      });

      mockPrisma.order.findFirst.mockResolvedValueOnce({
        id: 'ord-existing-1',
        orderNumber: 'DSL-2026-111111',
        items: [],
      });

      const result = await service.processPayment({
        reservationId: 'res-already-consumed',
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        deliveryAddress: {
          fullName: 'Kamal Perera',
          email: 'kamal@dsl.lk',
          phone: '0771234567',
          addressLine1: '12 Galle Rd',
          city: 'Colombo',
          district: 'Colombo',
        },
        idempotencyKey: 'dup-key-1',
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.order.orderNumber).toBe('DSL-2026-111111');
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });

    it('aborts and throws BadRequestException if physical stock is insufficient during fulfillment (prevents overselling)', async () => {
      mockPrisma.paymentAttempt.findUnique.mockResolvedValueOnce(null);
      mockPrisma.stockReservation.findUnique
        .mockResolvedValueOnce({
          id: 'res-low-stock',
          status: ReservationStatus.ACTIVE,
          expiresAt: new Date(Date.now() + 600000),
          items: [
            {
              id: 'it-1',
              productId: 'p-scarce',
              variantId: null,
              quantity: 10,
              unitPriceCents: 50000,
              product: { id: 'p-scarce', name: 'Rare Fountain Pen', priceCents: 50000, variants: [] },
              variant: null,
            },
          ],
        })
        .mockResolvedValueOnce({
          id: 'res-low-stock',
          status: ReservationStatus.ACTIVE,
        });

      mockPrisma.product.findUnique
        // calculateAuthoritativeTotals
        .mockResolvedValueOnce({ id: 'p-scarce', name: 'Rare Fountain Pen', priceCents: 50000, variants: [] })
        // Inside transaction: physical stock is only 2 (less than 10 requested!)
        .mockResolvedValueOnce({ id: 'p-scarce', stockQuantity: 2 });

      await expect(
        service.processPayment({
          reservationId: 'res-low-stock',
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          deliveryAddress: {
            fullName: 'Nimal Perera',
            email: 'nimal@dsl.lk',
            phone: '0771234567',
            addressLine1: '12 Kandy Rd',
            city: 'Kandy',
            district: 'Kandy',
          },
          idempotencyKey: 'low-stock-key',
        })
      ).rejects.toThrow(/Insufficient physical stock/);

      // Order was NOT created
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
      // Stock was NOT decremented
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });

    it('simulates two customers attempting to buy the final available item concurrently where exactly one succeeds and the other receives insufficient-stock', async () => {
      // Simulating Customer A succeeding and decrementing stock from 1 to 0
      // Customer B arrives when stock is now 0
      mockPrisma.paymentAttempt.findUnique.mockResolvedValue(null);
      mockPrisma.stockReservation.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 'res-cust-a') {
          return {
            id: 'res-cust-a',
            status: ReservationStatus.PAYMENT_PENDING,
            expiresAt: new Date(Date.now() + 60000),
            items: [
              {
                id: 'it-a',
                productId: 'p-last-item',
                variantId: null,
                quantity: 1,
                unitPriceCents: 10000,
                product: { id: 'p-last-item', name: 'Final Book', priceCents: 10000, variants: [] },
                variant: null,
              },
            ],
          };
        }
        return {
          id: 'res-cust-b',
          status: ReservationStatus.PAYMENT_PENDING,
          expiresAt: new Date(Date.now() + 60000),
          items: [
            {
              id: 'it-b',
              productId: 'p-last-item',
              variantId: null,
              quantity: 1,
              unitPriceCents: 10000,
              product: { id: 'p-last-item', name: 'Final Book', priceCents: 10000, variants: [] },
              variant: null,
            },
          ],
        };
      });

      let currentPhysicalStock = 1;
      mockPrisma.product.findUnique.mockImplementation(async () => {
        return {
          id: 'p-last-item',
          name: 'Final Book',
          priceCents: 10000,
          stockQuantity: currentPhysicalStock,
          variants: [],
        };
      });
      mockPrisma.product.update.mockImplementation(async ({ data }: any) => {
        currentPhysicalStock -= data.stockQuantity.decrement;
        return { id: 'p-last-item', stockQuantity: currentPhysicalStock };
      });
      mockPrisma.order.create.mockResolvedValueOnce({
        id: 'ord-cust-a',
        orderNumber: 'DSL-2026-WINNER',
        items: [],
      });

      // Customer A processes payment and secures the final item
      const resA = await service.processPayment({
        reservationId: 'res-cust-a',
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        deliveryAddress: {
          fullName: 'Customer A',
          email: 'custA@example.com',
          phone: '0771111111',
          addressLine1: 'Road A',
          city: 'Colombo',
          district: 'Colombo',
        },
        idempotencyKey: 'idemp-cust-a',
      });
      expect(resA.order.orderNumber).toBe('DSL-2026-WINNER');
      expect(currentPhysicalStock).toBe(0);

      // Customer B attempts payment for the same item now that stock is 0
      await expect(
        service.processPayment({
          reservationId: 'res-cust-b',
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          deliveryAddress: {
            fullName: 'Customer B',
            email: 'custB@example.com',
            phone: '0772222222',
            addressLine1: 'Road B',
            city: 'Colombo',
            district: 'Colombo',
          },
          idempotencyKey: 'idemp-cust-b',
        })
      ).rejects.toThrow(/Insufficient physical stock/);

      // Stock never goes negative!
      expect(currentPhysicalStock).toBe(0);
    });
  });

  describe('reconcilePaymentStatus', () => {
    it('returns confirmed order and payment attempt details when order exists', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce({
        id: 'ord-rec-1',
        orderNumber: 'DSL-2026-123456',
        orderStatus: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        paymentAttempts: [{ id: 'att-1', status: PaymentAttemptStatus.SUCCEEDED }],
      });

      const result = await service.reconcilePaymentStatus('DSL-2026-123456');

      expect(result.orderNumber).toBe('DSL-2026-123456');
      expect(result.isConfirmed).toBe(true);
      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
    });
  });

  describe('School Packs Authoritative Pricing and Checkout', () => {
    it('calculates bundle discount correctly from database prices and savings percentage', async () => {
      mockPrisma.product.findUnique
        .mockResolvedValueOnce({ id: 'p1', name: 'Exercise Book', priceCents: 100000, variants: [] })
        .mockResolvedValueOnce({ id: 'p2', name: 'Gel Pen', priceCents: 50000, variants: [] });

      mockPrisma.schoolPack.findUnique.mockResolvedValueOnce({
        id: 'pack-grade-5',
        name: 'Grade 5 Starter Pack',
        savingsPercentage: 10,
        isActive: true,
        items: [
          { productId: 'p1', substituteProductIds: [] },
          { productId: 'p2', substituteProductIds: [] },
        ],
      });

      const totals = await service.calculateAuthoritativeTotals(
        [
          { productId: 'p1', variantId: null, quantity: 2 },
          { productId: 'p2', variantId: null, quantity: 1 },
        ],
        null,
        [
          { productId: 'p1', variantId: null, packId: 'pack-grade-5' },
          { productId: 'p2', variantId: null, packId: 'pack-grade-5' },
        ]
      );

      // p1: 2 * 100,000 = 200,000; p2: 1 * 50,000 = 50,000. Subtotal: 250,000
      expect(totals.subtotalCents).toBe(250000);
      // 10% of 250,000 = 25,000
      expect(totals.bundleDiscountCents).toBe(25000);
      expect(totals.discountCents).toBe(25000);
      // 250,000 - 25,000 = 225,000 (< 500,000 threshold -> 35,000 delivery fee)
      expect(totals.deliveryCents).toBe(35000);
      expect(totals.totalCents).toBe(260000);
      expect(totals.schoolPacksSnapshot).toHaveLength(1);
      expect(totals.schoolPacksSnapshot![0].packName).toBe('Grade 5 Starter Pack');
      expect(totals.schoolPacksSnapshot![0].bundleDiscountCents).toBe(25000);
    });

    it('recognizes approved substitute products in a school pack', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'p1-sub',
        name: 'Exercise Book Hardcover (Substitute)',
        priceCents: 120000,
        variants: [],
      });

      mockPrisma.schoolPack.findUnique.mockResolvedValueOnce({
        id: 'pack-1',
        name: 'Primary Bundle',
        savingsPercentage: 15,
        isActive: true,
        items: [{ productId: 'p1-primary', substituteProductIds: ['p1-sub'] }],
      });

      const totals = await service.calculateAuthoritativeTotals(
        [{ productId: 'p1-sub', variantId: null, quantity: 1 }],
        null,
        [{ productId: 'p1-sub', variantId: null, packId: 'pack-1' }]
      );

      expect(totals.subtotalCents).toBe(120000);
      // 15% of 120,000 = 18,000
      expect(totals.bundleDiscountCents).toBe(18000);
      expect(totals.totalCents).toBe(120000 - 18000 + 35000);
    });

    it('denies bundle discount for rogue products not belonging to the pack', async () => {
      mockPrisma.product.findUnique
        .mockResolvedValueOnce({ id: 'p1', name: 'Legit Pack Item', priceCents: 100000, variants: [] })
        .mockResolvedValueOnce({ id: 'p-rogue', name: 'Luxury Backpack', priceCents: 400000, variants: [] });

      mockPrisma.schoolPack.findUnique.mockResolvedValueOnce({
        id: 'pack-1',
        name: 'Stationery Pack',
        savingsPercentage: 20,
        isActive: true,
        items: [{ productId: 'p1', substituteProductIds: [] }], // p-rogue NOT in pack!
      });

      const totals = await service.calculateAuthoritativeTotals(
        [
          { productId: 'p1', variantId: null, quantity: 1 },
          { productId: 'p-rogue', variantId: null, quantity: 1 },
        ],
        null,
        [
          { productId: 'p1', variantId: null, packId: 'pack-1' },
          { productId: 'p-rogue', variantId: null, packId: 'pack-1' }, // Tampered claim!
        ]
      );

      // Subtotal: 100,000 + 400,000 = 500,000
      expect(totals.subtotalCents).toBe(500000);
      // Discount applies ONLY to legit item: 20% of 100,000 = 20,000. Rogue item gets 0 discount.
      expect(totals.bundleDiscountCents).toBe(20000);
      expect(totals.discountCents).toBe(20000);
      // Net subtotal: 480,000 (< 500,000 -> 35,000 delivery fee)
      expect(totals.deliveryCents).toBe(35000);
      expect(totals.totalCents).toBe(480000 + 35000);
    });

    it('denies bundle discount when pack is inactive or does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'p1',
        name: 'Item',
        priceCents: 50000,
        variants: [],
      });

      // DB returns null (pack inactive or deleted)
      mockPrisma.schoolPack.findUnique.mockResolvedValueOnce(null);

      const totals = await service.calculateAuthoritativeTotals(
        [{ productId: 'p1', variantId: null, quantity: 1 }],
        null,
        [{ productId: 'p1', variantId: null, packId: 'inactive-pack-id' }]
      );

      expect(totals.subtotalCents).toBe(50000);
      expect(totals.bundleDiscountCents).toBe(0);
      expect(totals.discountCents).toBe(0);
      expect(totals.totalCents).toBe(50000 + 35000);
    });

    it('handles non-integer cent percentages with strict round-to-nearest integer', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'p-odd',
        name: 'Odd Priced Item',
        priceCents: 333333,
        variants: [],
      });

      mockPrisma.schoolPack.findUnique.mockResolvedValueOnce({
        id: 'pack-odd',
        name: 'Odd Pack',
        savingsPercentage: 15,
        isActive: true,
        items: [{ productId: 'p-odd', substituteProductIds: [] }],
      });

      const totals = await service.calculateAuthoritativeTotals(
        [{ productId: 'p-odd', variantId: null, quantity: 1 }],
        null,
        [{ productId: 'p-odd', variantId: null, packId: 'pack-odd' }]
      );

      // 333,333 * 0.15 = 49,999.95 -> rounded to 50,000
      expect(totals.bundleDiscountCents).toBe(50000);
      expect(Number.isInteger(totals.bundleDiscountCents)).toBe(true);
      expect(Number.isInteger(totals.totalCents)).toBe(true);
    });

    it('combines school pack bundle discount with voucher discount sequentially', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'p1',
        name: 'Pack Book',
        priceCents: 200000,
        variants: [],
      });

      mockPrisma.schoolPack.findUnique.mockResolvedValueOnce({
        id: 'pack-1',
        name: 'Pack 1',
        savingsPercentage: 10,
        isActive: true,
        items: [{ productId: 'p1', substituteProductIds: [] }],
      });

      mockPrisma.promotion.findUnique.mockResolvedValueOnce({
        id: 'prom-1',
        code: 'WELCOME10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        isActive: true,
        startDate: new Date(Date.now() - 100000),
        endDate: new Date(Date.now() + 100000),
        minOrderValueCents: 0,
      });

      const totals = await service.calculateAuthoritativeTotals(
        [{ productId: 'p1', variantId: null, quantity: 1 }],
        'WELCOME10',
        [{ productId: 'p1', variantId: null, packId: 'pack-1' }]
      );

      // Subtotal: 200,000
      // Bundle discount (10%): 20,000 -> Net: 180,000
      // Voucher discount (10% of 180,000): 18,000
      // Total discount: 20,000 + 18,000 = 38,000
      expect(totals.bundleDiscountCents).toBe(20000);
      expect(totals.voucherDiscountCents).toBe(18000);
      expect(totals.discountCents).toBe(38000);
      expect(totals.totalCents).toBe(200000 - 38000 + 35000);
    });

    it('persists school pack identity in order notes and items during processPayment', async () => {
      const reservationId = 'res-pack-1';
      mockPrisma.stockReservation.findUnique.mockResolvedValue({
        id: reservationId,
        status: ReservationStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 600000),
        items: [
          {
            id: 'item-1',
            productId: 'p1',
            variantId: null,
            quantity: 2,
            unitPriceCents: 100000,
            product: { id: 'p1', name: 'Atlas Book', priceCents: 100000, stockQuantity: 10, variants: [] },
            variant: null,
          },
        ],
      });

      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Atlas Book',
        priceCents: 100000,
        stockQuantity: 10,
        variants: [],
      });

      mockPrisma.schoolPack.findUnique.mockResolvedValue({
        id: 'pack-school-1',
        name: 'Atlas Student Pack',
        savingsPercentage: 10,
        isActive: true,
        items: [{ productId: 'p1', substituteProductIds: [] }],
      });

      mockPrisma.order.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 'ord-new-pack-1',
          orderNumber: data.orderNumber,
          notes: data.notes,
          discountCents: data.discountCents,
          totalCents: data.totalCents,
          items: data.items.create,
        });
      });

      const result = await service.processPayment({
        reservationId,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        deliveryAddress: {
          fullName: 'Saman Perera',
          email: 'saman@dsl.lk',
          phone: '0771234567',
          addressLine1: '45 Galle Road',
          city: 'Colombo',
          district: 'Colombo',
        },
        idempotencyKey: 'idemp-pack-test-1',
        packSelections: [{ productId: 'p1', variantId: null, packId: 'pack-school-1' }],
      });

      expect(result.order.discountCents).toBe(20000); // 10% of 200,000
      expect(result.order.notes).toBeDefined();

      const parsedNotes = JSON.parse(result.order.notes!);
      expect(parsedNotes.schoolPacks).toBeDefined();
      expect(parsedNotes.schoolPacks[0].packName).toBe('Atlas Student Pack');
      expect(parsedNotes.schoolPacks[0].bundleDiscountCents).toBe(20000);

      // Check item variantName annotation
      expect(result.order.items[0].variantName).toContain('[🎒 Atlas Student Pack]');
    });
  });

  describe('Phase B — Customer and Guest Checkout', () => {
    it('successfully processes guest checkout with userId: null and creates immutable address snapshot', async () => {
      const reservationId = 'res-guest-1';
      mockPrisma.stockReservation.findUnique.mockResolvedValue({
        id: reservationId,
        status: ReservationStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 600000),
        items: [
          {
            id: 'ri1',
            productId: 'p1',
            variantId: null,
            quantity: 2,
            unitPriceCents: 10000,
            product: { id: 'p1', name: 'DSL Pen', sku: 'PEN-1', priceCents: 10000, stockQuantity: 50, variants: [] },
            variant: null,
          },
        ],
        paymentAttempt: null,
      });
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'DSL Pen',
        sku: 'PEN-1',
        priceCents: 10000,
        stockQuantity: 50,
        isActive: true,
        variants: [],
      });
      mockPrisma.order.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 'ord-guest-1',
          orderNumber: data.orderNumber,
          userId: data.userId,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          totalCents: data.totalCents,
          addressSnapshot: data.addressSnapshot.create,
          items: data.items.create,
        });
      });

      const result = await service.processPayment(
        {
          reservationId,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          deliveryAddress: {
            fullName: 'Guest Customer',
            email: 'guest@example.lk',
            phone: '0779876543',
            addressLine1: '123 Beach Road',
            city: 'Negombo',
            district: 'Gampaha',
            province: 'Western',
          },
          idempotencyKey: 'idemp-guest-test-1',
        },
        null
      );

      expect(result.order.userId).toBeNull();
      expect(result.order.customerName).toBe('Guest Customer');
      expect(result.order.customerEmail).toBe('guest@example.lk');
      expect(result.order.addressSnapshot.city).toBe('Negombo');
      expect(mockCartService.removePurchasedItems).toHaveBeenCalled();
    });

    it('successfully processes authenticated customer checkout with userId attached', async () => {
      const reservationId = 'res-cust-1';
      mockPrisma.stockReservation.findUnique.mockResolvedValue({
        id: reservationId,
        status: ReservationStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 600000),
        items: [
          {
            id: 'ri1',
            productId: 'p1',
            variantId: null,
            quantity: 1,
            unitPriceCents: 5000,
            product: { id: 'p1', name: 'Exercise Book', sku: 'EB-1', priceCents: 5000, stockQuantity: 50, variants: [] },
            variant: null,
          },
        ],
        paymentAttempt: null,
      });
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Exercise Book',
        sku: 'EB-1',
        priceCents: 5000,
        stockQuantity: 50,
        isActive: true,
        variants: [],
      });
      mockPrisma.order.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 'ord-cust-1',
          orderNumber: data.orderNumber,
          userId: data.userId,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          totalCents: data.totalCents,
          addressSnapshot: data.addressSnapshot.create,
          items: data.items.create,
        });
      });

      const result = await service.processPayment(
        {
          reservationId,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          deliveryAddress: {
            fullName: 'Registered Customer',
            email: 'registered@dsl.lk',
            phone: '0712345678',
            addressLine1: '77 Kandy Road',
            city: 'Kadawatha',
            district: 'Gampaha',
            province: 'Western',
          },
          idempotencyKey: 'idemp-cust-test-1',
        },
        'user-authenticated-123'
      );

      expect(result.order.userId).toBe('user-authenticated-123');
      expect(result.order.customerEmail).toBe('registered@dsl.lk');
      expect(result.order.addressSnapshot.city).toBe('Kadawatha');
    });
  });
});
