import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, OrderStatus, PaymentStatus, PaymentMethod, ReservationStatus, PaymentAttemptStatus } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutService } from './checkout.service';
import { ReservationsService } from './reservations.service';
import { PrivateReceiptStorageService } from './private-receipt-storage.service';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Stage 3.2 — Checkout Overhaul & Bank Transfer Integration Tests (dsl_stationery_test)', () => {
  let pool: Pool;
  let prisma: PrismaService;
  let checkoutService: CheckoutService;
  let reservationsService: ReservationsService;
  let privateReceiptStorageService: PrivateReceiptStorageService;
  let activeDatabase: string;

  const testProductId = 'prod-stage3-2-test';
  const testCategoryId = 'cat-stage3-2-test';
  const testBrandId = 'brand-stage3-2-test';

  const mockInventoryGateway = {
    broadcastStockUpdate: () => {},
  };
  const mockCartService = {
    clearCart: async () => true,
    removePurchasedItems: async () => true,
  };
  const mockNotificationsService = {
    sendOrderConfirmation: async () => ({ success: true }),
    sendPaymentOutcome: async () => ({ success: true }),
  };

  beforeAll(async () => {
    const testDbUrl = process.env.TEST_DATABASE_URL;
    if (!testDbUrl || !testDbUrl.includes('dsl_stationery_test')) {
      throw new Error('CRITICAL SAFETY VIOLATION: TEST_DATABASE_URL does not point to dsl_stationery_test');
    }

    pool = new Pool({ connectionString: testDbUrl });

    // CRITICAL DATABASE SAFETY GUARD
    const dbCheck = await pool.query('SELECT current_database()');
    activeDatabase = dbCheck.rows[0].current_database;
    if (activeDatabase !== 'dsl_stationery_test') {
      throw new Error(`CRITICAL SAFETY ABORT: Connected to ${activeDatabase}, expected dsl_stationery_test!`);
    }

    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter }) as unknown as PrismaService;

    privateReceiptStorageService = new PrivateReceiptStorageService();
    reservationsService = new ReservationsService(prisma, mockInventoryGateway as any);
    checkoutService = new CheckoutService(
      prisma,
      mockInventoryGateway as any,
      mockCartService as any,
      privateReceiptStorageService,
      mockNotificationsService as any
    );

    // Clean existing test data in test db
    await pool.query('DELETE FROM "BankDepositSubmission" WHERE "referenceNumber" LIKE $1', ['STAGE3-2-%']);
    await pool.query('DELETE FROM "PaymentAttempt" WHERE "idempotencyKey" LIKE $1 OR "idempotencyKey" LIKE $2', ['stage3-2-%', 'conc-order-%']);
    await pool.query('DELETE FROM "OrderItem" WHERE "productId" IN ($1, $2)', [testProductId, 'prod-concurrency-test-1']);
    await pool.query('DELETE FROM "StockReservationItem" WHERE "productId" IN ($1, $2)', [testProductId, 'prod-concurrency-test-1']);
    await pool.query('DELETE FROM "InventoryMovement" WHERE "productId" IN ($1, $2)', [testProductId, 'prod-concurrency-test-1']);
    await pool.query('DELETE FROM "Product" WHERE id IN ($1, $2)', [testProductId, 'prod-concurrency-test-1']);
    await pool.query('DELETE FROM "Category" WHERE id = $1', [testCategoryId]);
    await pool.query('DELETE FROM "Brand" WHERE id = $1', [testBrandId]);

    // Seed test brand
    await prisma.brand.create({
      data: {
        id: testBrandId,
        name: 'Stage 3.2 Brand',
        slug: 'stage-3-2-brand',
        description: 'Stage 3.2 Brand Description',
        originCountry: 'Sri Lanka',
      },
    });

    // Seed test category
    await prisma.category.create({
      data: {
        id: testCategoryId,
        name: 'Stage 3.2 Test Category',
        slug: 'stage-3-2-test-category',
        description: 'Stage 3.2 Category Description',
      },
    });

    // Seed test product with 20 units
    await prisma.product.create({
      data: {
        id: testProductId,
        name: 'Stage 3.2 Notebook',
        slug: 'stage-3-2-notebook',
        sku: 'STAGE3-2-NB',
        shortDescription: 'Stage 3.2 Short Description',
        description: 'Stage 3.2 Product Description',
        priceCents: 50000, // Rs. 500.00
        stockQuantity: 20,
        category: { connect: { id: testCategoryId } },
        brand: { connect: { id: testBrandId } },
        isActive: true,
      },
    });

    // Seed StoreSettings with complete verified bank details
    await prisma.storeSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        bankTransferEnabled: true,
        bankName: 'Commercial Bank of Ceylon',
        accountHolderName: 'DSL Stationery (Pvt) Ltd',
        accountNumber: '1000987654',
        branchName: 'Corporate Banking Division',
        branchCode: '045',
        bankCode: '7010',
        paymentInstructions: 'Deposit to the designated account and upload the slip.',
        referenceInstructions: 'Include your full name and order reference.',
        codEnabled: true,
        onlineCardEnabled: false,
        flatDeliveryFeeCents: 35000,
        freeDeliveryThresholdCents: 500000,
      },
      update: {
        bankTransferEnabled: true,
        bankName: 'Commercial Bank of Ceylon',
        accountHolderName: 'DSL Stationery (Pvt) Ltd',
        accountNumber: '1000987654',
        branchName: 'Corporate Banking Division',
        branchCode: '045',
        bankCode: '7010',
        paymentInstructions: 'Deposit to the designated account and upload the slip.',
        referenceInstructions: 'Include your full name and order reference.',
      },
    });
  });

  afterAll(async () => {
    if (pool && activeDatabase === 'dsl_stationery_test') {
      await pool.query('DELETE FROM "BankDepositSubmission" WHERE "referenceNumber" LIKE $1', ['STAGE3-2-%']);
      await pool.query('DELETE FROM "PaymentAttempt" WHERE "idempotencyKey" LIKE $1 OR "idempotencyKey" LIKE $2', ['stage3-2-%', 'conc-order-%']);
      await pool.query('DELETE FROM "OrderItem" WHERE "productId" IN ($1, $2)', [testProductId, 'prod-concurrency-test-1']);
      await pool.query('DELETE FROM "StockReservationItem" WHERE "productId" IN ($1, $2)', [testProductId, 'prod-concurrency-test-1']);
      await pool.query('DELETE FROM "InventoryMovement" WHERE "productId" IN ($1, $2)', [testProductId, 'prod-concurrency-test-1']);
      await pool.query('DELETE FROM "Product" WHERE id IN ($1, $2)', [testProductId, 'prod-concurrency-test-1']);
      await pool.query('DELETE FROM "Category" WHERE id = $1', [testCategoryId]);
      await pool.query('DELETE FROM "Brand" WHERE id = $1', [testBrandId]);
      await pool.end();
    }
  });

  it('1. Successfully completes Bank Transfer checkout with mandatory receipt staging', async () => {
    // 1. Create a 10-minute stock reservation for 2 units
    const reservation = await reservationsService.createReservation(
      {
        items: [{ productId: testProductId, quantity: 2 }],
      },
      null,
      'test-session-bt-1'
    );

    expect(reservation.reservationId).toBeDefined();
    expect(reservation.status).toBe('ACTIVE');

    // 2. Stage a valid receipt slip using PrivateReceiptStorageService
    const sampleSlip = Buffer.concat([
      Buffer.from('%PDF-1.4', 'ascii'),
      Buffer.from('\n1 0 obj\n<< /Title (Bank Deposit Slip) >>\nendobj\n%%EOF'),
    ]);

    const stagedReceipt = await privateReceiptStorageService.stageReceipt({
      fieldname: 'receipt',
      originalname: 'deposit_slip_ref_001.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: sampleSlip,
      size: sampleSlip.length,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    });

    expect(stagedReceipt.receiptToken).toBeDefined();

    // 3. Process payment with Bank Transfer
    const idempotencyKey = `stage3-2-bt-${Date.now()}`;
    const result = await checkoutService.processPayment({
      reservationId: reservation.reservationId,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      deliveryAddress: {
        fullName: 'Nimal Perera',
        email: 'nimal@example.com',
        phone: '0771234567',
        addressLine1: '45 Lotus Road',
        city: 'Colombo',
        district: 'Colombo',
        province: 'Western',
      },
      idempotencyKey,
      bankTransferData: {
        receiptToken: stagedReceipt.receiptToken,
        referenceNumber: 'STAGE3-2-TXN-001',
        depositDate: '2026-11-14',
        customerNotes: 'Transferred via Commercial Bank Online',
      },
    });

    expect(result.order).toBeDefined();
    // Critical Stage 3.2 assertions:
    expect(result.order.orderStatus).toBe(OrderStatus.PENDING);
    expect(result.order.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(result.order.paymentMethod).toBe(PaymentMethod.BANK_TRANSFER);

    // Verify stock committed: physical stock reduced from 20 to 18
    const updatedProd = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(updatedProd?.stockQuantity).toBe(18);

    // Verify BankDepositSubmission in PostgreSQL
    const submission = await prisma.bankDepositSubmission.findFirst({
      where: { orderId: result.order.id },
    });
    expect(submission).toBeDefined();
    expect(submission?.status).toBe('PENDING');
    expect(submission?.referenceNumber).toBe('STAGE3-2-TXN-001');
    expect(submission?.originalFilename).toBe('deposit_slip_ref_001.pdf');
    expect(submission?.mimeType).toBe('application/pdf');
    expect(submission?.receiptStorageKey).toBe(stagedReceipt.storageKey);

    // Verify PaymentAttempt in PostgreSQL
    const paymentAttempt = await prisma.paymentAttempt.findUnique({
      where: { idempotencyKey },
    });
    expect(paymentAttempt?.paymentMethod).toBe(PaymentMethod.BANK_TRANSFER);
    expect(paymentAttempt?.status).toBe('PROCESSING');
  });

  it('2. Rejects Bank Transfer checkout if store settings has incomplete bank configuration', async () => {
    // Temporarily make bank configuration incomplete
    await prisma.storeSettings.update({
      where: { id: 'default' },
      data: { accountHolderName: null },
    });

    const reservation = await reservationsService.createReservation(
      {
        items: [{ productId: testProductId, quantity: 1 }],
      },
      null,
      'test-session-bt-2'
    );

    await expect(
      checkoutService.processPayment({
        reservationId: reservation.reservationId,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        deliveryAddress: {
          fullName: 'Test User',
          email: 'test@example.com',
          phone: '0771234567',
          addressLine1: 'Line 1',
          city: 'City',
          district: 'Colombo',
        },
        idempotencyKey: `stage3-2-bt-fail-${Date.now()}`,
        bankTransferData: {
          receiptToken: 'some-token',
          referenceNumber: 'STAGE3-2-TXN-002',
          depositDate: '2026-11-14',
        },
      })
    ).rejects.toThrow();

    // Restore complete configuration
    await prisma.storeSettings.update({
      where: { id: 'default' },
      data: { accountHolderName: 'DSL Stationery (Pvt) Ltd' },
    });
  });

  it('3. Rejects Bank Transfer checkout if receipt slip token is missing or forged', async () => {
    const reservation = await reservationsService.createReservation(
      {
        items: [{ productId: testProductId, quantity: 1 }],
      },
      null,
      'test-session-bt-3'
    );

    // Attempt without bankTransferData
    await expect(
      checkoutService.processPayment({
        reservationId: reservation.reservationId,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        deliveryAddress: {
          fullName: 'Test User',
          email: 'test@example.com',
          phone: '0771234567',
          addressLine1: 'Line 1',
          city: 'City',
          district: 'Colombo',
        },
        idempotencyKey: `stage3-2-bt-no-slip-${Date.now()}`,
      })
    ).rejects.toThrow();

    // Attempt with forged token
    await expect(
      checkoutService.processPayment({
        reservationId: reservation.reservationId,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        deliveryAddress: {
          fullName: 'Test User',
          email: 'test@example.com',
          phone: '0771234567',
          addressLine1: 'Line 1',
          city: 'City',
          district: 'Colombo',
        },
        idempotencyKey: `stage3-2-bt-forged-${Date.now()}`,
        bankTransferData: {
          receiptToken: 'forged.signature.token',
          referenceNumber: 'STAGE3-2-FORGED',
          depositDate: '2026-11-14',
        },
      })
    ).rejects.toThrow();
  });

  it('4. Genuinely failed PayHere payment cancels order and restores committed physical stock', async () => {
    // Current stock is 18
    const beforeProd = await prisma.product.findUnique({ where: { id: testProductId } });
    const stockBefore = beforeProd!.stockQuantity;

    // Create a reservation for 3 units
    const reservation = await reservationsService.createReservation(
      {
        items: [{ productId: testProductId, quantity: 3 }],
      },
      null,
      'test-session-payhere-fail'
    );

    // Fulfill order internally as if pending card authorization
    const idempotencyKey = `stage3-2-payhere-${Date.now()}`;
    const orderResult = await checkoutService.processPayment(
      {
        reservationId: reservation.reservationId,
        paymentMethod: PaymentMethod.CARD_PAYHERE,
        deliveryAddress: {
          fullName: 'Card Customer',
          email: 'card@example.com',
          phone: '0770000000',
          addressLine1: 'Card Street',
          city: 'Colombo',
          district: 'Colombo',
        },
        idempotencyKey,
      },
      null,
      null,
      true // Internal
    );

    const orderId = orderResult.order.id;
    const orderNumber = orderResult.order.orderNumber;

    // Stock should now be stockBefore - 3
    const duringProd = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(duringProd?.stockQuantity).toBe(stockBefore - 3);

    // Now simulate genuine PayHere failure callback (status_code: '-2')
    const merchantId = process.env.PAYHERE_MERCHANT_ID || '1211149';
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || 'dsl_payhere_sandbox_secret';
    const payhereAmount = (orderResult.order.totalCents / 100).toFixed(2);
    const statusCode = '-2';
    const currency = 'LKR';

    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const checkHashStr = `${merchantId}${orderNumber}${payhereAmount}${currency}${statusCode}${hashedSecret}`;
    const md5sig = crypto.createHash('md5').update(checkHashStr).digest('hex').toUpperCase();

    const webhookRes = await checkoutService.handlePayHereWebhook({
      merchant_id: merchantId,
      order_id: orderNumber,
      payment_id: 'ph-failed-trans-999',
      payhere_amount: payhereAmount,
      payhere_currency: currency,
      status_code: statusCode,
      md5sig,
      custom_1: reservation.reservationId,
      custom_2: idempotencyKey,
      status_message: 'User cancelled transaction',
    });

    expect(webhookRes.status).toBe('failed');

    // Verify order was cancelled
    const cancelledOrder = await prisma.order.findUnique({ where: { id: orderId } });
    expect(cancelledOrder?.orderStatus).toBe(OrderStatus.CANCELLED);
    expect(cancelledOrder?.paymentStatus).toBe(PaymentStatus.FAILED);

    // Verify stock was restored atomically back to stockBefore
    const afterProd = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(afterProd?.stockQuantity).toBe(stockBefore);

    // Verify InventoryMovement was logged with RESTOCK
    const movement = await prisma.inventoryMovement.findFirst({
      where: {
        productId: testProductId,
        reason: 'RESTOCK',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(movement).toBeDefined();
    expect(movement?.changeAmount).toBe(3);
  });

  it('5. Late verified PayHere success after cancellation preserves SUCCEEDED attempt and flags reconciliation without altering CANCELLED order status', async () => {
    // 1. Create a reservation and an order via COD that gets cancelled
    const reservation = await reservationsService.createReservation(
      { items: [{ productId: testProductId, quantity: 1 }] },
      null,
      'test-session-late-pay'
    );

    const idempotencyKey = `late-ph-test-${Date.now()}`;
    const orderResult = await checkoutService.processPayment({
      reservationId: reservation.reservationId,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      deliveryAddress: {
        fullName: 'Late Customer',
        email: 'late@example.com',
        phone: '0773333333',
        addressLine1: '88 High Street',
        city: 'Colombo',
        district: 'Colombo',
      },
      idempotencyKey,
    });

    const orderId = orderResult.order.id;
    const orderNumber = orderResult.order.orderNumber;

    // Simulate earlier order cancellation and failed payment attempt
    await prisma.order.update({
      where: { id: orderId },
      data: {
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.FAILED,
        notes: '[CANCELLED: Customer cancellation]',
      },
    });

    await prisma.paymentAttempt.update({
      where: { idempotencyKey },
      data: {
        status: PaymentAttemptStatus.FAILED,
      },
    });

    // 2. Now simulate late arriving verified success callback (status_code: '2')
    const merchantId = process.env.PAYHERE_MERCHANT_ID || '1211149';
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || 'dsl_payhere_sandbox_secret';
    const payhereAmount = (orderResult.order.totalCents / 100).toFixed(2);
    const statusCode = '2';
    const currency = 'LKR';

    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const checkHashStr = `${merchantId}${orderNumber}${payhereAmount}${currency}${statusCode}${hashedSecret}`;
    const md5sig = crypto.createHash('md5').update(checkHashStr).digest('hex').toUpperCase();

    const paymentId = `ph-late-success-${Date.now()}`;
    const webhookRes = await checkoutService.handlePayHereWebhook({
      merchant_id: merchantId,
      order_id: orderNumber,
      payment_id: paymentId,
      payhere_amount: payhereAmount,
      payhere_currency: currency,
      status_code: statusCode,
      md5sig,
      custom_2: idempotencyKey,
      status_message: 'Successfully paid',
    });

    expect(webhookRes.status).toBe('reconciliation_required');

    // 3. Verify PaymentAttempt status is preserved as SUCCEEDED
    const paymentAttempt = await prisma.paymentAttempt.findUnique({
      where: { idempotencyKey },
    });
    expect(paymentAttempt?.status).toBe(PaymentAttemptStatus.SUCCEEDED);
    expect(paymentAttempt?.gatewayReference).toBe(paymentId);

    // 4. Verify Order remains CANCELLED and has RECONCILIATION_REQUIRED note
    const orderInDb = await prisma.order.findUnique({ where: { id: orderId } });
    expect(orderInDb?.orderStatus).toBe(OrderStatus.CANCELLED);
    expect(orderInDb?.notes).toContain('[RECONCILIATION_REQUIRED:');
    expect(orderInDb?.notes).toContain(paymentId);
  });

  it('6. Real PostgreSQL Concurrency: Two customers compete for the final 1 stock unit with separate concurrent transactions', async () => {
    // Set up product with exact stock = 1
    const concurrencyProductId = 'prod-concurrency-test-1';
    await prisma.product.upsert({
      where: { id: concurrencyProductId },
      update: { stockQuantity: 1, isActive: true },
      create: {
        id: concurrencyProductId,
        name: 'Final Unit Concurrency Product',
        slug: 'final-unit-concurrency-prod',
        description: 'Testing race conditions',
        shortDescription: 'Final unit test item',
        sku: 'CONC-FINAL-001',
        priceCents: 150000,
        stockQuantity: 1,
        categoryId: testCategoryId,
        brandId: testBrandId,
        isActive: true,
      },
    });

    // Verify initial stock is strictly 1
    const initialProd = await prisma.product.findUnique({ where: { id: concurrencyProductId } });
    expect(initialProd?.stockQuantity).toBe(1);

    // Launch two simultaneous, concurrent reservation requests competing for the exact same 1 unit
    const results = await Promise.allSettled([
      reservationsService.createReservation(
        { items: [{ productId: concurrencyProductId, quantity: 1 }] },
        null,
        'session-alpha'
      ),
      reservationsService.createReservation(
        { items: [{ productId: concurrencyProductId, quantity: 1 }] },
        null,
        'session-beta'
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    // 1. Exactly ONE reservation must succeed
    expect(fulfilled.length).toBe(1);
    // 2. The other competing request MUST receive an unavailable stock error
    expect(rejected.length).toBe(1);
    expect(rejected[0].reason.message).toMatch(/insufficient|available|only has 0 available/i);

    const winningReservationId = fulfilled[0].value.reservationId;

    // 3. Verify stock never becomes negative and remains 1
    const postResProd = await prisma.product.findUnique({ where: { id: concurrencyProductId } });
    expect(postResProd?.stockQuantity).toBe(1);

    // 4. Verify no duplicate reservation was created in database
    const activeReservations = await prisma.stockReservationItem.findMany({
      where: { productId: concurrencyProductId },
      include: { reservation: true },
    });
    expect(activeReservations.length).toBe(1);
    expect(activeReservations[0].reservationId).toBe(winningReservationId);

    // 5. The winning customer places an order, committing the final unit
    const orderResult = await checkoutService.processPayment({
      reservationId: winningReservationId,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      deliveryAddress: {
        fullName: 'Winner Customer',
        email: 'winner@example.com',
        phone: '0779998888',
        addressLine1: '1 Winner Way',
        city: 'Colombo',
        district: 'Colombo',
      },
      idempotencyKey: `conc-order-${Date.now()}`,
    });

    expect(orderResult.order).toBeDefined();
    expect(orderResult.order.orderStatus).toBe(OrderStatus.CONFIRMED);

    // 6. Verify physical stock is now 0 (never negative)
    const fulfilledProd = await prisma.product.findUnique({ where: { id: concurrencyProductId } });
    expect(fulfilledProd?.stockQuantity).toBe(0);

    // 7. Expired reservation cleanup check:
    // Even if reservationsService.releaseExpiredReservations runs, it CANNOT release or touch committed order stock
    await prisma.stockReservation.update({
      where: { id: winningReservationId },
      data: { expiresAt: new Date(Date.now() - 60000) }, // Force timestamp in the past
    });

    const cleanupResult = await reservationsService.releaseExpiredReservations();
    // The winning reservation status is CONSUMED, so releaseExpiredReservations ignores it
    const finalProd = await prisma.product.findUnique({ where: { id: concurrencyProductId } });
    expect(finalProd?.stockQuantity).toBe(0); // Stock remains securely committed to the order
  });
});
