import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  BankDepositStatus,
  InventoryChangeReason,
  PrismaClient,
} from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { CheckoutService } from '../checkout/checkout.service';
import { ReservationsService } from '../checkout/reservations.service';
import { PrivateReceiptStorageService } from '../checkout/private-receipt-storage.service';
import { AuditService } from '../audit/audit.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Stage 3.3 & Stage 3.4 — Payment Operations Integration Tests (dsl_stationery_test)', () => {
  let pool: Pool;
  let prisma: PrismaService;
  let paymentsService: PaymentsService;
  let checkoutService: CheckoutService;
  let reservationsService: ReservationsService;
  let privateReceiptStorageService: PrivateReceiptStorageService;
  let auditService: AuditService;
  let activeDatabase: string;

  const testProductId = 'prod-stage3-3-test';
  const testCategoryId = 'cat-stage3-3-test';
  const testBrandId = 'brand-stage3-3-test';

  const mockInventoryGateway = {
    broadcastStockUpdate: () => { },
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
      throw new Error(`ABORT: Connected to unsafe database "${activeDatabase}", expected dsl_stationery_test`);
    }

    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter }) as unknown as PrismaService;
    auditService = new AuditService(prisma);
    privateReceiptStorageService = new PrivateReceiptStorageService();

    paymentsService = new PaymentsService(
      prisma,
      auditService,
      mockInventoryGateway as any,
      privateReceiptStorageService
    );

    checkoutService = new CheckoutService(
      prisma,
      mockInventoryGateway as any,
      mockCartService as any,
      privateReceiptStorageService,
      mockNotificationsService as any
    );

    reservationsService = new ReservationsService(prisma, mockInventoryGateway as any);

    // Clean existing test data in test db
    await pool.query('DELETE FROM "BankDepositSubmission" WHERE "referenceNumber" LIKE $1', ['STAGE3-3-%']);
    await pool.query('DELETE FROM "PaymentAttempt" WHERE "idempotencyKey" LIKE $1', ['stage3-3-%']);
    await pool.query('DELETE FROM "OrderItem" WHERE "productId" = $1', [testProductId]);
    await pool.query('DELETE FROM "StockReservationItem" WHERE "productId" = $1', [testProductId]);
    await pool.query('DELETE FROM "InventoryMovement" WHERE "productId" = $1', [testProductId]);
    await pool.query('DELETE FROM "Product" WHERE id = $1', [testProductId]);
    await pool.query('DELETE FROM "Category" WHERE id = $1', [testCategoryId]);
    await pool.query('DELETE FROM "Brand" WHERE id = $1', [testBrandId]);
    await pool.query('DELETE FROM "User" WHERE id = $1', ['mgr-user-1']);

    // Seed reviewer user
    await prisma.user.upsert({
      where: { id: 'mgr-user-1' },
      update: {},
      create: {
        id: 'mgr-user-1',
        email: 'manager@dslstationery.lk',
        name: 'Operations Manager',
        role: 'MANAGER' as any,
      },
    });

    // Seed Brand, Category, Product
    await prisma.brand.create({
      data: {
        id: testBrandId,
        name: 'Stage 3.3 Brand',
        slug: 'stage-3-3-brand',
        description: 'Brand for verification test',
        originCountry: 'Sri Lanka',
      },
    });

    await prisma.category.create({
      data: {
        id: testCategoryId,
        name: 'Stage 3.3 Category',
        slug: 'stage-3-3-category',
        description: 'Category for verification test',
        iconName: 'Package',
      },
    });

    await prisma.product.create({
      data: {
        id: testProductId,
        name: 'Stage 3.3 Test Pen',
        slug: 'stage-3-3-test-pen',
        description: 'Test pen for manual verification',
        shortDescription: 'Stage 3.3 item',
        sku: 'STAGE3-3-PEN-001',
        priceCents: 100000,
        stockQuantity: 10,
        categoryId: testCategoryId,
        brandId: testBrandId,
        isActive: true,
      },
    });

    // Ensure StoreSettings has complete bank config
    await prisma.storeSettings.upsert({
      where: { id: 'default' },
      update: {
        bankTransferEnabled: true,
        bankName: 'Commercial Bank of Ceylon',
        accountHolderName: 'DSL Stationery (Pvt) Ltd',
        accountNumber: '1000123456',
        branchName: 'Kollupitiya',
        paymentInstructions: 'Deposit to account',
        referenceInstructions: 'Use order reference',
      },
      create: {
        id: 'default',
        bankTransferEnabled: true,
        bankName: 'Commercial Bank of Ceylon',
        accountHolderName: 'DSL Stationery (Pvt) Ltd',
        accountNumber: '1000123456',
        branchName: 'Kollupitiya',
        paymentInstructions: 'Deposit to account',
        referenceInstructions: 'Use order reference',
      },
    });
  });

  afterAll(async () => {
    if (pool && activeDatabase === 'dsl_stationery_test') {
      await pool.query('DELETE FROM "BankDepositSubmission" WHERE "referenceNumber" LIKE $1', ['STAGE3-3-%']);
      await pool.query('DELETE FROM "PaymentAttempt" WHERE "idempotencyKey" LIKE $1', ['stage3-3-%']);
      await pool.query('DELETE FROM "OrderItem" WHERE "productId" = $1', [testProductId]);
      await pool.query('DELETE FROM "StockReservationItem" WHERE "productId" = $1', [testProductId]);
      await pool.query('DELETE FROM "InventoryMovement" WHERE "productId" = $1', [testProductId]);
      await pool.query('DELETE FROM "Product" WHERE id = $1', [testProductId]);
      await pool.query('DELETE FROM "Category" WHERE id = $1', [testCategoryId]);
      await pool.query('DELETE FROM "Brand" WHERE id = $1', [testBrandId]);
      await pool.query('DELETE FROM "User" WHERE id = $1', ['mgr-user-1']);
      await pool.end();
    }
  });

  it('1. Full Lifecycle — Bank Transfer Approval: Customer submits order → Manager approves → Order CONFIRMED & Payment PAID', async () => {
    // 1. Customer reserves 2 units
    const reservation = await reservationsService.createReservation(
      { items: [{ productId: testProductId, quantity: 2 }] },
      null,
      'test-session-bt-approve'
    );

    // 2. Customer stages receipt slip
    const sampleSlip = Buffer.concat([
      Buffer.from('%PDF-1.4', 'ascii'),
      Buffer.from('\n1 0 obj\n<< /Title (Deposit Slip) >>\nendobj\n%%EOF'),
    ]);
    const staged = await privateReceiptStorageService.stageReceipt({
      fieldname: 'receipt',
      originalname: 'deposit-slip-approval.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: sampleSlip,
      size: sampleSlip.length,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    });

    // 3. Customer places Bank Transfer order
    const orderResult = await checkoutService.processPayment({
      reservationId: reservation.reservationId,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      deliveryAddress: {
        fullName: 'Kamal Perera',
        email: 'kamal@dsl.lk',
        phone: '0771122334',
        addressLine1: '12 Temple Road',
        city: 'Colombo',
        district: 'Colombo',
      },
      idempotencyKey: `stage3-3-order-app-${Date.now()}`,
      bankTransferData: {
        receiptToken: staged.receiptToken,
        referenceNumber: 'STAGE3-3-REF-APP-001',
        depositDate: '2026-11-14',
      },
    });

    expect(orderResult.order.orderStatus).toBe(OrderStatus.PENDING);
    expect(orderResult.order.paymentStatus).toBe(PaymentStatus.PENDING);

    const submission = await prisma.bankDepositSubmission.findFirst({
      where: { orderId: orderResult.order.id },
    });
    expect(submission).toBeDefined();
    expect(submission?.status).toBe(BankDepositStatus.PENDING);

    // 4. Manager reviews and approves Bank Transfer
    const approveResult = await paymentsService.approveBankTransfer(
      submission!.id,
      { adminNotes: 'Confirmed credit in ComBank A/C #1000123456' },
      { id: 'mgr-user-1', email: 'manager@dslstationery.lk', name: 'Operations Manager' }
    );

    expect(approveResult.success).toBe(true);
    expect(approveResult.order.orderStatus).toBe(OrderStatus.CONFIRMED);
    expect(approveResult.order.paymentStatus).toBe(PaymentStatus.PAID);
    expect(approveResult.submission.status).toBe(BankDepositStatus.VERIFIED);
    expect(approveResult.submission.reviewedById).toBe('mgr-user-1');

    // Invariant: Committed physical stock was retained (10 - 2 = 8)
    const prodAfter = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(prodAfter?.stockQuantity).toBe(8);
  });

  it('2. Full Lifecycle — Bank Transfer Rejection: Customer submits order → Manager rejects → Order CANCELLED, Payment FAILED & Stock Restored', async () => {
    // 1. Customer reserves 2 units
    const reservation = await reservationsService.createReservation(
      { items: [{ productId: testProductId, quantity: 2 }] },
      null,
      'test-session-bt-reject'
    );

    // Stock was 8; after reservation, 2 units are committed
    const sampleSlip = Buffer.concat([
      Buffer.from('%PDF-1.4', 'ascii'),
      Buffer.from('\n1 0 obj\n<< /Title (Fake Slip) >>\nendobj\n%%EOF'),
    ]);
    const staged = await privateReceiptStorageService.stageReceipt({
      fieldname: 'receipt',
      originalname: 'deposit-slip-fake.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: sampleSlip,
      size: sampleSlip.length,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    });

    // 2. Customer places Bank Transfer order (commits physical stock from 8 to 6)
    const orderResult = await checkoutService.processPayment({
      reservationId: reservation.reservationId,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      deliveryAddress: {
        fullName: 'Rogue Customer',
        email: 'rogue@dsl.lk',
        phone: '0779988776',
        addressLine1: '99 Suspicious Alley',
        city: 'Colombo',
        district: 'Colombo',
      },
      idempotencyKey: `stage3-3-order-rej-${Date.now()}`,
      bankTransferData: {
        receiptToken: staged.receiptToken,
        referenceNumber: 'STAGE3-3-REF-REJ-002',
        depositDate: '2026-11-14',
      },
    });

    const prodDuring = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(prodDuring?.stockQuantity).toBe(6);

    const submission = await prisma.bankDepositSubmission.findFirst({
      where: { orderId: orderResult.order.id },
    });

    // 3. Manager rejects Bank Transfer with mandatory category and reason
    const rejectResult = await paymentsService.rejectBankTransfer(
      submission!.id,
      {
        category: 'Fake receipt',
        explanation: 'Slip reference does not correspond to any genuine bank deposit on 14 Nov',
      },
      { id: 'mgr-user-1', email: 'manager@dslstationery.lk', name: 'Operations Manager' }
    );

    expect(rejectResult.success).toBe(true);
    expect(rejectResult.order.orderStatus).toBe(OrderStatus.CANCELLED);
    expect(rejectResult.order.paymentStatus).toBe(PaymentStatus.FAILED);
    expect(rejectResult.submission.status).toBe(BankDepositStatus.REJECTED);
    expect(rejectResult.submission.rejectionReason).toContain('Fake receipt');

    // 4. Invariant: Physical stock was atomically restored back to 8
    const prodAfterRejection = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(prodAfterRejection?.stockQuantity).toBe(8);

    // Invariant: InventoryMovement logged with RESTOCK
    const movement = await prisma.inventoryMovement.findFirst({
      where: {
        productId: testProductId,
        reason: InventoryChangeReason.RESTOCK,
        note: { contains: orderResult.order.orderNumber },
      },
    });
    expect(movement).toBeDefined();
    expect(movement?.changeAmount).toBe(2);
  });

  it('3. Payments Dashboard & Aggregations (Stage 3.4): Calculates genuine metrics across all methods', async () => {
    const summary = await paymentsService.getPaymentsSummary();

    expect(summary.totalTransactions).toBeGreaterThanOrEqual(2);
    expect(summary.bankTransfers.verified).toBeGreaterThanOrEqual(1);
    expect(summary.bankTransfers.rejected).toBeGreaterThanOrEqual(1);
    expect(typeof summary.totalPaidVolumeCents).toBe('number');

    // Query consolidated transaction list
    const txList = await paymentsService.getPaymentTransactions({
      page: 1,
      limit: 10,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(txList.items.length).toBeGreaterThanOrEqual(2);
    const orderNumbers = txList.items.map((i) => i.orderNumber);
    expect(orderNumbers.length).toBeGreaterThan(0);
  });

  it('4. Read-Only Financial Consistency Checker (Stage 3.5): Identifies consistent database state', async () => {
    const report = await paymentsService.getPaymentReconciliationReport();

    expect(report.inspectedCategories).toContain('DELIVERED_COD_UNPAID');
    expect(report.inspectedCategories).toContain('VERIFIED_DEPOSIT_UNCONFIRMED_ORDER');
    expect(report.inspectedCategories).toContain('CONFIRMED_CARD_WITHOUT_SUCCESS_ATTEMPT');
    expect(report.inspectedCategories).toContain('PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT');
    expect(report.inspectedCategories).toContain('DUPLICATE_SUCCEEDED_PAYMENT_ATTEMPTS');
    expect(report.inspectedCategories).toContain('DUPLICATE_RESTOCK_MOVEMENT');
    expect(report.inspectedCategories).toContain('REJECTED_SUBMISSION_ACTIVE_ORDER');
    expect(report.inspectedCategories).toContain('MISSING_RESTOCK_MOVEMENT');
    expect(report.inspectedCategories).toContain('MULTIPLE_ACTIVE_SUBMISSIONS');
    expect(Array.isArray(report.issues)).toBe(true);
    expect(typeof report.summary.totalCheckedOrders).toBe('number');
  });

  it('5. Read-Only Financial Consistency Checker (Stage 3.5): Detects injected state inconsistencies', async () => {
    const anomalousOrderNum = `DSL-TEST-ANOMALY-${Date.now()}`;
    // Inject temporary inconsistent order: DELIVERED COD but paymentStatus is PENDING
    const anomalyOrder = await prisma.order.create({
      data: {
        orderNumber: anomalousOrderNum,
        customerName: 'Test Anomaly Customer',
        customerEmail: 'anomaly@test.lk',
        customerPhone: '0770000000',
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        orderStatus: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PENDING, // Inconsistency: DELIVERED COD must be PAID
        subtotalCents: 100000,
        discountCents: 0,
        deliveryCents: 35000,
        totalCents: 135000,
      },
    });

    try {
      const report = await paymentsService.getPaymentReconciliationReport();
      const codAnomaly = report.issues.find((i) => i.orderNumber === anomalousOrderNum);

      expect(codAnomaly).toBeDefined();
      expect(codAnomaly?.category).toBe('DELIVERED_COD_UNPAID');
      expect(codAnomaly?.severity).toBe('HIGH');
      expect(codAnomaly?.orderStatus).toBe(OrderStatus.DELIVERED);
      expect(codAnomaly?.paymentStatus).toBe(PaymentStatus.PENDING);
    } finally {
      // Clean up injected anomaly record
      await pool.query('DELETE FROM "Order" WHERE id = $1', [anomalyOrder.id]);
    }
  });
});
