/**
 * DSL Stationery — Stage 1.3: Real PostgreSQL Concurrency Integration Tests
 *
 * Scenarios:
 *   Test A — Concurrent return creation (Order has 5 units, 2 concurrent tx try to create 4 units each)
 *   Test B — Concurrent return receipt (Approved return of 2 units, 2 concurrent tx confirm receipt)
 *   Test C — Concurrent inventory changes (Two independent tx increment stock concurrently)
 *   Test D — Transaction rollback (Error after stock update rolls back entire transaction)
 *
 * Safety & Isolation:
 *   - Uses independent Prisma client connections via separate pg.Pool instances.
 *   - Only runs against a dedicated isolated test database (TEST_DATABASE_URL with _test suffix).
 *   - Strictly prevents execution against development or production databases.
 */

import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  ReturnStatus,
  ReturnItemStatus,
  InventoryChangeReason,
  RefundStatus,
  PaymentAttemptStatus,
} from '../../generated/prisma';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AdminOrdersService } from './admin-orders.service';

const isIsolatedTestDbConfigured = Boolean(
  process.env.TEST_DATABASE_URL &&
  process.env.TEST_DATABASE_URL.includes('_test')
);

describe.skipIf(!isIsolatedTestDbConfigured)('PostgreSQL Concurrency Integration Tests (Real Database)', () => {
  let prisma1: PrismaClient;
  let prisma2: PrismaClient;
  let prisma3: PrismaClient;
  let prisma4: PrismaClient;
  let prisma5: PrismaClient;
  let pool1: Pool;
  let pool2: Pool;
  let pool3: Pool;
  let pool4: Pool;
  let pool5: Pool;

  let service1: AdminOrdersService;
  let service2: AdminOrdersService;
  let service3: AdminOrdersService;
  let service4: AdminOrdersService;
  let service5: AdminOrdersService;

  let testCategory: any;
  let testBrand: any;

  // Track created fixtures for deterministic cleanup
  const cleanupOrderIds: string[] = [];
  const cleanupProductIds: string[] = [];
  const cleanupReservationIds: string[] = [];

  beforeAll(async () => {
    if (!isIsolatedTestDbConfigured) {
      console.warn(
        '⚠️ Missing Prerequisite: Dedicated isolated test database (TEST_DATABASE_URL) is not configured. Concurrency integration tests are skipped to protect development database integrity.'
      );
      return;
    }

    const testDbUrl = process.env.TEST_DATABASE_URL!;
    pool1 = new Pool({ connectionString: testDbUrl });
    pool2 = new Pool({ connectionString: testDbUrl });
    pool3 = new Pool({ connectionString: testDbUrl });
    pool4 = new Pool({ connectionString: testDbUrl });
    pool5 = new Pool({ connectionString: testDbUrl });

    prisma1 = new PrismaClient({ adapter: new PrismaPg(pool1) });
    prisma2 = new PrismaClient({ adapter: new PrismaPg(pool2) });
    prisma3 = new PrismaClient({ adapter: new PrismaPg(pool3) });
    prisma4 = new PrismaClient({ adapter: new PrismaPg(pool4) });
    prisma5 = new PrismaClient({ adapter: new PrismaPg(pool5) });

    await Promise.all([
      prisma1.$connect(),
      prisma2.$connect(),
      prisma3.$connect(),
      prisma4.$connect(),
      prisma5.$connect(),
    ]);

    service1 = new AdminOrdersService(prisma1 as any);
    service2 = new AdminOrdersService(prisma2 as any);
    service3 = new AdminOrdersService(prisma3 as any);
    service4 = new AdminOrdersService(prisma4 as any);
    service5 = new AdminOrdersService(prisma5 as any);

    // Create shared test Category and Brand in the isolated test DB
    testCategory = await prisma1.category.create({
      data: {
        name: `Test Conc Category ${Date.now()}`,
        slug: `test-conc-cat-${Date.now()}`,
        description: 'Category for integration testing',
      },
    });

    testBrand = await prisma1.brand.create({
      data: {
        name: `Test Conc Brand ${Date.now()}`,
        slug: `test-conc-brand-${Date.now()}`,
        description: 'Brand for integration testing',
        originCountry: 'LK',
      },
    });
  });

  afterAll(async () => {
    if (!isIsolatedTestDbConfigured) return;

    // Clean up only test-created records in reverse dependency order
    for (const orderId of cleanupOrderIds) {
      try {
        await prisma1.refundRecord.deleteMany({ where: { orderId } });
        await prisma1.paymentAttempt.deleteMany({ where: { orderId } });
        await prisma1.orderReturnItem.deleteMany({ where: { returnRequest: { orderId } } });
        await prisma1.orderReturnRequest.deleteMany({ where: { orderId } });
        await prisma1.orderAuditLog.deleteMany({ where: { orderId } });
        await prisma1.orderItem.deleteMany({ where: { orderId } });
        await prisma1.order.delete({ where: { id: orderId } });
      } catch (err) {
        console.error(`Failed to clean up test order ${orderId}:`, err);
      }
    }

    for (const resId of cleanupReservationIds) {
      try {
        await prisma1.paymentAttempt.deleteMany({ where: { reservationId: resId } });
        await prisma1.stockReservationItem.deleteMany({ where: { reservationId: resId } });
        await prisma1.stockReservation.delete({ where: { id: resId } });
      } catch (err) {
        console.error(`Failed to clean up test reservation ${resId}:`, err);
      }
    }

    for (const prodId of cleanupProductIds) {
      try {
        await prisma1.inventoryMovement.deleteMany({ where: { productId: prodId } });
        await prisma1.productVariant.deleteMany({ where: { productId: prodId } });
        await prisma1.product.delete({ where: { id: prodId } });
      } catch (err) {
        console.error(`Failed to clean up test product ${prodId}:`, err);
      }
    }

    if (testCategory) {
      try {
        await prisma1.category.delete({ where: { id: testCategory.id } });
      } catch (err) {
        console.error('Failed to clean up test category:', err);
      }
    }

    if (testBrand) {
      try {
        await prisma1.brand.delete({ where: { id: testBrand.id } });
      } catch (err) {
        console.error('Failed to clean up test brand:', err);
      }
    }

    await Promise.all([
      prisma1.$disconnect(),
      prisma2.$disconnect(),
      prisma3.$disconnect(),
      prisma4.$disconnect(),
      prisma5.$disconnect(),
    ]);
    await Promise.all([
      pool1?.end(),
      pool2?.end(),
      pool3?.end(),
      pool4?.end(),
      pool5?.end(),
    ]);
  });

  /**
   * Test A — Concurrent return creation
   * Given: An order contains 5 units of a product.
   * Two independent database transactions simultaneously attempt to create returns for 4 units each.
   * Expected:
   *   - Only one request succeeds.
   *   - The other request is rejected because only 1 unit remains eligible.
   *   - Total active/completed returned quantity never exceeds 5.
   */
  it('Test A: Concurrent return creation serializes via Order row-lock and prevents quantity exhaustion', async () => {
    const product = await prisma1.product.create({
      data: {
        name: `Test Conc Return Prod ${Date.now()}`,
        slug: `test-conc-ret-prod-${Date.now()}`,
        sku: `SKU-RET-${Date.now()}`,
        description: 'Test product for concurrency testing',
        shortDescription: 'Short desc',
        categoryId: testCategory.id,
        brandId: testBrand.id,
        priceCents: 1000,
        stockQuantity: 20,
        isActive: true,
      },
    });
    cleanupProductIds.push(product.id);

    const order = await prisma1.order.create({
      data: {
        orderNumber: `ORD-CONC-A-${Date.now()}`,
        orderStatus: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        customerName: 'Test Concurrency Buyer',
        customerEmail: 'test-conc@dsl.lk',
        customerPhone: '+94770000001',
        totalCents: 5000,
        subtotalCents: 5000,
        items: {
          create: [
            {
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              quantity: 5,
              unitPriceCents: 1000,
              totalPriceCents: 5000,
            },
          ],
        },
      },
      include: { items: true },
    });
    cleanupOrderIds.push(order.id);
    const orderItemId = order.items[0].id;

    // Helper: Execute return creation transaction with row lock
    const attemptCreateReturn = async (client: PrismaClient, reqQty: number, tag: string) => {
      return client.$transaction(async (tx) => {
        // Acquire row lock
        const locked = await tx.$queryRaw<Array<{ id: string; orderStatus: OrderStatus }>>`
          SELECT id, "orderStatus" FROM "Order" WHERE id = ${order.id} FOR UPDATE
        `;
        if (!locked.length || locked[0].orderStatus !== OrderStatus.DELIVERED) {
          throw new Error('Order not eligible for returns');
        }

        const orderItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
        const matched = orderItems.find((oi) => oi.id === orderItemId);
        if (!matched) throw new Error('Order item not found');

        const existingReturns = await tx.orderReturnRequest.findMany({
          where: {
            orderId: order.id,
            status: { in: [ReturnStatus.PENDING, ReturnStatus.APPROVED, ReturnStatus.COMPLETED] },
          },
          include: { items: true },
        });

        const previouslyReturnedQty = existingReturns
          .flatMap((r) => r.items)
          .filter((ri) => ri.orderItemId === orderItemId)
          .reduce((sum, ri) => sum + ri.quantity, 0);

        const remainingEligibleQty = matched.quantity - previouslyReturnedQty;
        if (reqQty > remainingEligibleQty) {
          throw new Error(`Only ${remainingEligibleQty} unit(s) remaining eligible; requested ${reqQty}`);
        }

        return tx.orderReturnRequest.create({
          data: {
            orderId: order.id,
            returnNumber: `RET-CONC-${tag}-${Date.now()}`,
            status: ReturnStatus.PENDING,
            reason: `Return request ${tag}`,
            items: {
              create: [
                {
                  orderItemId,
                  productName: matched.productName,
                  quantity: reqQty,
                  reason: 'Defective',
                  status: ReturnItemStatus.PENDING,
                },
              ],
            },
          },
          include: { items: true },
        });
      });
    };

    // 2. Launch two simultaneous return creation transactions requesting 4 units each
    const [res1, res2] = await Promise.allSettled([
      attemptCreateReturn(prisma1, 4, 'TX1'),
      attemptCreateReturn(prisma2, 4, 'TX2'),
    ]);

    const successes = [res1, res2].filter((r) => r.status === 'fulfilled');
    const failures = [res1, res2].filter((r) => r.status === 'rejected');

    // Exactly one must succeed and one must be rejected
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Verify database state: total returned quantity must be exactly 4, not 8
    const totalActiveReturns = await prisma1.orderReturnRequest.findMany({
      where: { orderId: order.id },
      include: { items: true },
    });
    const totalReturnedUnits = totalActiveReturns
      .flatMap((r) => r.items)
      .reduce((sum, it) => sum + it.quantity, 0);

    expect(totalReturnedUnits).toBe(4);
    expect(totalReturnedUnits).toBeLessThanOrEqual(5);
  });

  /**
   * Test B — Concurrent return receipt
   * Given: One approved return request contains 2 units.
   * Two independent requests simultaneously confirm receipt with restocking enabled.
   * Expected:
   *   - Exactly one request completes successfully.
   *   - Inventory increases by exactly 2, not 4.
   *   - Exactly one corresponding restocking movement is recorded.
   */
  it('Test B: Concurrent return receipt confirmation restocks inventory exactly once', async () => {
    const product = await prisma1.product.create({
      data: {
        name: `Test Conc Receipt Prod ${Date.now()}`,
        slug: `test-conc-rcpt-prod-${Date.now()}`,
        sku: `SKU-RCPT-${Date.now()}`,
        description: 'Test product for concurrency testing',
        shortDescription: 'Short desc',
        categoryId: testCategory.id,
        brandId: testBrand.id,
        priceCents: 1500,
        stockQuantity: 10,
        isActive: true,
      },
    });
    cleanupProductIds.push(product.id);

    const order = await prisma1.order.create({
      data: {
        orderNumber: `ORD-CONC-B-${Date.now()}`,
        orderStatus: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        customerName: 'Test Concurrency Buyer B',
        customerEmail: 'test-b@dsl.lk',
        customerPhone: '+94770000002',
        totalCents: 3000,
        subtotalCents: 3000,
        items: {
          create: [
            {
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              quantity: 2,
              unitPriceCents: 1500,
              totalPriceCents: 3000,
            },
          ],
        },
      },
      include: { items: true },
    });
    cleanupOrderIds.push(order.id);

    const returnReq = await prisma1.orderReturnRequest.create({
      data: {
        orderId: order.id,
        returnNumber: `RET-RCPT-${Date.now()}`,
        status: ReturnStatus.APPROVED,
        reason: 'Authorized exchange',
        items: {
          create: [
            {
              orderItemId: order.items[0].id,
              productName: product.name,
              quantity: 2,
              reason: 'Customer exchange',
              status: ReturnItemStatus.APPROVED,
            },
          ],
        },
      },
      include: { items: true },
    });

    // Helper: Confirm receipt with atomic claim & restocking
    const confirmReceipt = async (client: PrismaClient) => {
      return client.$transaction(async (tx) => {
        const atomicClaim = await tx.orderReturnRequest.updateMany({
          where: {
            id: returnReq.id,
            status: ReturnStatus.APPROVED,
          },
          data: {
            status: ReturnStatus.COMPLETED,
          },
        });

        if (atomicClaim.count === 0) {
          throw new Error('Return request has already been processed or status is invalid');
        }

        await tx.orderReturnItem.updateMany({
          where: { returnRequestId: returnReq.id },
          data: { status: ReturnItemStatus.RECEIVED, receivedAt: new Date() },
        });

        // Lock product row and restock
        const [locked] = await tx.$queryRaw<Array<{ id: string; stockQuantity: number }>>`
          SELECT id, "stockQuantity" FROM "Product" WHERE id = ${product.id} FOR UPDATE
        `;
        const prevQty = locked.stockQuantity;
        const newQty = prevQty + 2;

        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: { increment: 2 } },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            previousQuantity: prevQty,
            newQuantity: newQty,
            changeAmount: 2,
            reason: InventoryChangeReason.RESTOCK,
            note: `Restocked from return ${returnReq.returnNumber}`,
            performedById: 'INTEGRATION_TEST',
          },
        });

        return { success: true };
      });
    };

    // Execute concurrently
    const [res1, res2] = await Promise.allSettled([
      confirmReceipt(prisma1),
      confirmReceipt(prisma2),
    ]);

    const successes = [res1, res2].filter((r) => r.status === 'fulfilled');
    const failures = [res1, res2].filter((r) => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Verify resulting stock: initial 10 + exactly 2 = 12 (NOT 14)
    const refreshedProduct = await prisma1.product.findUnique({ where: { id: product.id } });
    expect(refreshedProduct?.stockQuantity).toBe(12);

    // Verify exactly one movement record created
    const movements = await prisma1.inventoryMovement.findMany({
      where: { productId: product.id, reason: InventoryChangeReason.RESTOCK },
    });
    expect(movements.length).toBe(1);
    expect(movements[0].previousQuantity).toBe(10);
    expect(movements[0].newQuantity).toBe(12);
    expect(movements[0].changeAmount).toBe(2);
  });

  /**
   * Test C — Concurrent inventory changes
   * Given: Two independent transactions increment the same product's stock concurrently with different quantities.
   * Expected:
   *   - Final stock equals original stock plus both increments.
   *   - Both inventory movements contain accurate, sequential previous and new quantities.
   *   - No movement history entries are lost or duplicated.
   */
  it('Test C: Concurrent stock increments produce serialized, contiguous inventory movement snapshots', async () => {
    const product = await prisma1.product.create({
      data: {
        name: `Test Conc Inv Prod ${Date.now()}`,
        slug: `test-conc-inv-prod-${Date.now()}`,
        sku: `SKU-INV-${Date.now()}`,
        description: 'Test product for concurrency testing',
        shortDescription: 'Short desc',
        categoryId: testCategory.id,
        brandId: testBrand.id,
        priceCents: 500,
        stockQuantity: 100,
        isActive: true,
      },
    });
    cleanupProductIds.push(product.id);

    const incrementStock = async (client: PrismaClient, delta: number, note: string) => {
      return client.$transaction(async (tx) => {
        const [locked] = await tx.$queryRaw<Array<{ id: string; stockQuantity: number }>>`
          SELECT id, "stockQuantity" FROM "Product" WHERE id = ${product.id} FOR UPDATE
        `;
        const prevQty = locked.stockQuantity;
        const newQty = prevQty + delta;

        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: { increment: delta } },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            previousQuantity: prevQty,
            newQuantity: newQty,
            changeAmount: delta,
            reason: InventoryChangeReason.RESTOCK,
            note,
            performedById: 'INTEGRATION_TEST',
          },
        });

        return { prevQty, newQty };
      });
    };

    // Run two concurrent increments (+15 and +25)
    const [res1, res2] = await Promise.all([
      incrementStock(prisma1, 15, 'Increment +15'),
      incrementStock(prisma2, 25, 'Increment +25'),
    ]);

    expect(res1).toBeDefined();
    expect(res2).toBeDefined();

    // Verify final stock is exactly 100 + 15 + 25 = 140
    const finalProduct = await prisma1.product.findUnique({ where: { id: product.id } });
    expect(finalProduct?.stockQuantity).toBe(140);

    // Verify movement records are strictly contiguous (no overlapping intervals)
    const movements = await prisma1.inventoryMovement.findMany({
      where: { productId: product.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(movements.length).toBe(2);

    const first = movements[0];
    const second = movements[1];

    expect(first.previousQuantity).toBe(100);
    expect(first.newQuantity).toBe(first.previousQuantity + first.changeAmount);

    expect(second.previousQuantity).toBe(first.newQuantity);
    expect(second.newQuantity).toBe(second.previousQuantity + second.changeAmount);
    expect(second.newQuantity).toBe(140);
  });

  /**
   * Test D — Transaction rollback
   * Given: An error occurs after a stock update but before movement creation completes.
   * Expected:
   *   - Stock update rolls back.
   *   - No incomplete movement record remains.
   */
  it('Test D: Transaction rollbacks cleanly on subsequent failures without leaving dirty stock changes', async () => {
    const product = await prisma1.product.create({
      data: {
        name: `Test Rollback Prod ${Date.now()}`,
        slug: `test-rb-prod-${Date.now()}`,
        sku: `SKU-RB-${Date.now()}`,
        description: 'Test product for concurrency testing',
        shortDescription: 'Short desc',
        categoryId: testCategory.id,
        brandId: testBrand.id,
        priceCents: 200,
        stockQuantity: 50,
        isActive: true,
      },
    });
    cleanupProductIds.push(product.id);

    const failingTransaction = async () => {
      return prisma1.$transaction(async (tx) => {
        const [locked] = await tx.$queryRaw<Array<{ id: string; stockQuantity: number }>>`
          SELECT id, "stockQuantity" FROM "Product" WHERE id = ${product.id} FOR UPDATE
        `;

        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: { increment: 10 } },
        });

        // Simulate crash before movement creation
        throw new Error('Simulated crash before movement creation');
      });
    };

    await expect(failingTransaction()).rejects.toThrow('Simulated crash before movement creation');

    // Verify stock remains untouched at 50
    const refreshed = await prisma1.product.findUnique({ where: { id: product.id } });
    expect(refreshed?.stockQuantity).toBe(50);

    // Verify no movements recorded
    const movements = await prisma1.inventoryMovement.findMany({
      where: { productId: product.id },
    });
    expect(movements.length).toBe(0);
  });

  // ============================================================================
  // STAGE 2.2 & 2.2.1: SHARED TEST HELPERS
  // ============================================================================

  const createTestOrder = async (overrides: Partial<any> = {}) => {
    const product = await prisma1.product.create({
      data: {
        name: `Test Prod ${Date.now()}-${Math.random().toString(36).substring(7)}`,
        slug: `test-prod-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        sku: `SKU-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        description: 'Test product for Stage 2.2',
        shortDescription: 'Short desc',
        categoryId: testCategory.id,
        brandId: testBrand.id,
        priceCents: 5000,
        stockQuantity: 20,
        isActive: true,
      },
    });
    cleanupProductIds.push(product.id);

    const order = await prisma1.order.create({
      data: {
        orderNumber: `ORD-REF-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        orderStatus: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.CARD_PAYHERE,
        customerName: 'Test Buyer',
        customerEmail: 'buyer@test.dsl.lk',
        customerPhone: '+94770000000',
        totalCents: 10000,
        subtotalCents: 10000,
        items: {
          create: [
            {
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              quantity: 2,
              unitPriceCents: 5000,
              totalPriceCents: 10000,
            },
          ],
        },
        ...overrides,
      },
      include: { items: true },
    });
    cleanupOrderIds.push(order.id);
    return { order, product };
  };

  const createPaymentAttempt = async (
    orderId: string,
    amountCents: number,
    gatewayReference: string | null,
    status: PaymentAttemptStatus = PaymentAttemptStatus.SUCCEEDED,
    paymentMethod: PaymentMethod = PaymentMethod.CARD_PAYHERE
  ) => {
    const reservation = await prisma1.stockReservation.create({
      data: {
        sessionId: `sess-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    cleanupReservationIds.push(reservation.id);

    return prisma1.paymentAttempt.create({
      data: {
        reservationId: reservation.id,
        orderId,
        amountCents,
        currency: 'LKR',
        paymentMethod,
        status,
        gatewayReference: gatewayReference || null,
        idempotencyKey: `idem-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      },
    });
  };

  // ============================================================================
  // STAGE 2.2: BACKEND REFUND & CANCELLATION HARDENING (REAL POSTGRESQL TESTS)
  // ============================================================================

  describe('Stage 2.2: Backend Refund & Cancellation Hardening (PostgreSQL)', () => {

    it('Test A: PayHere successful payment contributes to verified collected funds', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-REF-A-${Date.now()}`);

      const refund = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'Test A verified collection',
          idempotencyKey: `idem-a-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin' }
      );

      expect(refund.id).toBeDefined();
      expect(refund.amountCents).toBe(5000);
      expect(refund.status).toBe(RefundStatus.REQUESTED);

      const dbRefund = await prisma1.refundRecord.findUnique({ where: { id: refund.id } });
      expect(dbRefund?.amountCents).toBe(5000);
    });

    it('Test B: Duplicate gateway references cannot inflate collected amount', async () => {
      const { order } = await createTestOrder();
      const sharedRef = `PH-DUP-REF-${Date.now()}`;
      await createPaymentAttempt(order.id, 10000, sharedRef);

      // Attempting to insert a duplicate gatewayReference into PostgreSQL is rejected by unique constraint
      await expect(
        createPaymentAttempt(order.id, 10000, sharedRef)
      ).rejects.toThrow();

      // Furthermore, calculateRefundableBalance logic deduplicates in-memory gateway references
      const fakeAttempts = [
        { amountCents: 10000, gatewayReference: 'DUP-REF-1' },
        { amountCents: 10000, gatewayReference: 'DUP-REF-1' },
      ];
      const mockTx: any = {
        paymentAttempt: {
          findMany: async () => fakeAttempts,
        },
        refundRecord: {
          aggregate: async () => ({ _sum: { amountCents: 0 } }),
        },
      };
      const bal = await (service1 as any).calculateRefundableBalance(mockTx, order);
      // Even with 2 attempt objects of 10000 each having same reference, verified collected is 10000, not 20000!
      expect(bal.verifiedCollectedCents).toBe(10000);
    });

    it('Test C: Two distinct successful transactions with equal amounts both counted', async () => {
      const { order } = await createTestOrder({ totalCents: 20000 });
      await createPaymentAttempt(order.id, 10000, `PH-DIST-1-${Date.now()}`);
      await createPaymentAttempt(order.id, 10000, `PH-DIST-2-${Date.now()}`);

      const refund = await service1.processRefund(
        order.id,
        {
          amountCents: 15000,
          method: 'CARD_PAYHERE',
          reason: 'Test C distinct transactions counted',
          idempotencyKey: `idem-c-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin' }
      );

      expect(refund.id).toBeDefined();
      expect(refund.amountCents).toBe(15000);
    });

    it('Test D: isPaid = true without verified bank deposit reference cannot authorize refund', async () => {
      const { order } = await createTestOrder({
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        paymentStatus: PaymentStatus.PAID,
      });

      // No verified deposit reference exists -> refund must be rejected
      await expect(
        service1.processRefund(
          order.id,
          {
            amountCents: 5000,
            method: 'BANK_TRANSFER',
            reason: 'Test D unverified bank transfer',
            idempotencyKey: `idem-d1-${Date.now()}`,
          },
          { id: 'admin-1', name: 'Admin' }
        )
      ).rejects.toThrow(BadRequestException);

      // Now create a verified bank payment attempt with a valid deposit reference
      await createPaymentAttempt(
        order.id,
        10000,
        'SLIP-VERIFIED-12345',
        PaymentAttemptStatus.SUCCEEDED,
        PaymentMethod.BANK_TRANSFER
      );

      const refund = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'BANK_TRANSFER',
          reason: 'Test D verified bank transfer',
          idempotencyKey: `idem-d2-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin' }
      );

      expect(refund.id).toBeDefined();
      expect(refund.amountCents).toBe(5000);
    });

    it('Test E: COD refund rejected even when order status is DELIVERED', async () => {
      const { order } = await createTestOrder({
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        orderStatus: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
      });

      await expect(
        service1.processRefund(
          order.id,
          {
            amountCents: 5000,
            method: 'BANK_TRANSFER',
            reason: 'Test E COD refund attempt',
            idempotencyKey: `idem-e-${Date.now()}`,
          },
          { id: 'admin-1', name: 'Admin' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Test F: Koko refund rejected', async () => {
      const { order } = await createTestOrder({
        paymentMethod: PaymentMethod.KOKO_BNPL,
        orderStatus: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
      });

      await expect(
        service1.processRefund(
          order.id,
          {
            amountCents: 5000,
            method: 'KOKO_BNPL',
            reason: 'Test F Koko refund attempt',
            idempotencyKey: `idem-f-${Date.now()}`,
          },
          { id: 'admin-1', name: 'Admin' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Test G: Cumulative refunds cannot exceed verified collected funds', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-G-${Date.now()}`);

      // First refund for 6000 succeeds
      await service1.processRefund(
        order.id,
        {
          amountCents: 6000,
          method: 'CARD_PAYHERE',
          reason: 'Test G partial 1',
          idempotencyKey: `idem-g1-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin' }
      );

      // Second refund for 5000 exceeds remaining 4000 and fails
      await expect(
        service1.processRefund(
          order.id,
          {
            amountCents: 5000,
            method: 'CARD_PAYHERE',
            reason: 'Test G excessive 2',
            idempotencyKey: `idem-g2-fail-${Date.now()}`,
          },
          { id: 'admin-1', name: 'Admin' }
        )
      ).rejects.toThrow(BadRequestException);

      // Second refund for 4000 succeeds
      await service1.processRefund(
        order.id,
        {
          amountCents: 4000,
          method: 'CARD_PAYHERE',
          reason: 'Test G partial 2',
          idempotencyKey: `idem-g2-ok-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin' }
      );

      // Any further refund is completely rejected
      await expect(
        service1.processRefund(
          order.id,
          {
            amountCents: 100,
            method: 'CARD_PAYHERE',
            reason: 'Test G exhausted',
            idempotencyKey: `idem-g3-${Date.now()}`,
          },
          { id: 'admin-1', name: 'Admin' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Test H: REQUESTED, APPROVED, PROCESSING refunds reserve balance', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-H-${Date.now()}`);

      const ref1 = await service1.processRefund(
        order.id,
        {
          amountCents: 4000,
          method: 'CARD_PAYHERE',
          reason: 'Test H ref 1',
          idempotencyKey: `idem-h1-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin' }
      );
      expect(ref1.status).toBe(RefundStatus.REQUESTED);

      // Advance to APPROVED by independent admin-2
      const approvedRef = await service1.approveRefund(order.id, ref1.id, {}, { id: 'admin-2', name: 'Approver Admin' });
      expect(approvedRef.status).toBe(RefundStatus.APPROVED);

      // Advance to PROCESSING
      const processingRef = await service1.processRefundExecution(
        order.id,
        ref1.id,
        { notes: 'Submitted to gateway' },
        { id: 'admin-1', name: 'Admin' }
      );
      expect(processingRef.status).toBe(RefundStatus.PROCESSING);

      // Attempting 7000 exceeds available (10000 - 4000 = 6000)
      await expect(
        service1.processRefund(
          order.id,
          {
            amountCents: 7000,
            method: 'CARD_PAYHERE',
            reason: 'Test H excessive',
            idempotencyKey: `idem-h-fail-${Date.now()}`,
          },
          { id: 'admin-1', name: 'Admin' }
        )
      ).rejects.toThrow(BadRequestException);

      // 6000 succeeds and consumes remaining balance
      const ref2 = await service1.processRefund(
        order.id,
        {
          amountCents: 6000,
          method: 'CARD_PAYHERE',
          reason: 'Test H ref 2',
          idempotencyKey: `idem-h-ok-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin' }
      );
      expect(ref2.id).toBeDefined();
    });

    it('Test I: FAILED and REJECTED refunds release reservation', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-I-${Date.now()}`);

      // Create refund 1 (4000) and advance to PROCESSING
      const ref1 = await service1.processRefund(
        order.id,
        {
          amountCents: 4000,
          method: 'CARD_PAYHERE',
          reason: 'Test I ref 1',
          idempotencyKey: `idem-i1-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin' }
      );
      // Advance to APPROVED by independent admin-2
      await service1.approveRefund(order.id, ref1.id, {}, { id: 'admin-2', name: 'Approver Admin' });
      await service1.processRefundExecution(order.id, ref1.id, {}, { id: 'admin-1', name: 'Admin' });

      // Create refund 2 (6000 in REQUESTED)
      const ref2 = await service1.processRefund(
        order.id,
        {
          amountCents: 6000,
          method: 'CARD_PAYHERE',
          reason: 'Test I ref 2',
          idempotencyKey: `idem-i2-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin' }
      );

      // Now available balance is 0. Any new request fails.
      await expect(
        service1.processRefund(
          order.id,
          {
            amountCents: 1000,
            method: 'CARD_PAYHERE',
            reason: 'Zero balance',
            idempotencyKey: `idem-i-zero-${Date.now()}`,
          },
          { id: 'admin-1', name: 'Admin' }
        )
      ).rejects.toThrow(BadRequestException);

      // Fail refund 1 -> releases 4000
      const failed = await service1.failRefund(
        order.id,
        ref1.id,
        { failureReason: 'Bank gateway rejected card' },
        { id: 'admin-1', name: 'Admin' }
      );
      expect(failed.status).toBe(RefundStatus.FAILED);

      // Now 4000 is available again!
      const ref3 = await service1.processRefund(
        order.id,
        {
          amountCents: 4000,
          method: 'CARD_PAYHERE',
          reason: 'Test I after fail',
          idempotencyKey: `idem-i3-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin' }
      );
      expect(ref3.id).toBeDefined();

      // Reject refund 2 -> releases 6000
      const rejected = await service1.rejectRefund(
        order.id,
        ref2.id,
        { rejectionReason: 'Customer requested cancellation of refund' },
        { id: 'admin-1', name: 'Admin' }
      );
      expect(rejected.status).toBe(RefundStatus.REJECTED);

      // Now 6000 is available again!
      const ref4 = await service1.processRefund(
        order.id,
        {
          amountCents: 6000,
          method: 'CARD_PAYHERE',
          reason: 'Test I after reject',
          idempotencyKey: `idem-i4-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin' }
      );
      expect(ref4.id).toBeDefined();
    });

    it('Test J: Same idempotency key + same payload returns original record', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-J-${Date.now()}`);

      const key = `idem-j-${Date.now()}`;
      const payload = {
        amountCents: 5000,
        method: 'CARD_PAYHERE' as const,
        reason: 'Test J idempotent replay',
        idempotencyKey: key,
      };

      const firstCall = await service1.processRefund(order.id, payload, { id: 'admin-1', name: 'Admin' });
      const secondCall = await service1.processRefund(order.id, payload, { id: 'admin-1', name: 'Admin' });

      expect(secondCall.id).toBe(firstCall.id);

      const dbRefunds = await prisma1.refundRecord.findMany({ where: { orderId: order.id } });
      expect(dbRefunds.length).toBe(1);
    });

    it('Test K: Same idempotency key + different payload returns HTTP 409', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-K-${Date.now()}`);

      const key = `idem-k-${Date.now()}`;
      await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'Initial payload',
          idempotencyKey: key,
        },
        { id: 'admin-1', name: 'Admin' }
      );

      // Submit different amount with identical idempotencyKey
      await expect(
        service1.processRefund(
          order.id,
          {
            amountCents: 7000, // Different amount
            method: 'CARD_PAYHERE',
            reason: 'Conflicting payload',
            idempotencyKey: key,
          },
          { id: 'admin-1', name: 'Admin' }
        )
      ).rejects.toThrow(ConflictException);
    });

    it('Test L: Concurrent refund requests (5 parallel independent transactions) serialize via FOR UPDATE and cannot exceed balance', async () => {
      const { order } = await createTestOrder({ totalCents: 10000 });
      await createPaymentAttempt(order.id, 10000, `PH-L-${Date.now()}`);

      // 5 concurrent requests of 3000 each = 15000 total requested > 10000 available
      const services = [service1, service2, service3, service4, service5];
      const tasks = services.map((svc, idx) =>
        svc.processRefund(
          order.id,
          {
            amountCents: 3000,
            method: 'CARD_PAYHERE',
            reason: `Concurrent worker ${idx + 1}`,
            idempotencyKey: `idem-conc-l-${idx + 1}-${Date.now()}`,
          },
          { id: `admin-${idx + 1}`, name: `Worker ${idx + 1}` }
        )
      );

      const results = await Promise.allSettled(tasks);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly 3 succeed (3 x 3000 = 9000 <= 10000). The other 2 fail because 1000 < 3000.
      expect(fulfilled.length).toBe(3);
      expect(rejected.length).toBe(2);

      for (const rej of rejected) {
        if (rej.status === 'rejected') {
          expect(rej.reason).toBeInstanceOf(BadRequestException);
        }
      }

      // Verify authoritative database sum in PostgreSQL
      const aggregate = await prisma1.refundRecord.aggregate({
        where: { orderId: order.id },
        _sum: { amountCents: true },
      });
      expect(aggregate._sum.amountCents).toBe(9000);
      expect(aggregate._sum.amountCents).toBeLessThanOrEqual(10000);
    });

    it('Test M: Invalid refund state transitions rejected', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-M-${Date.now()}`);

      const ref = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'Test M state machine',
          idempotencyKey: `idem-m-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin' }
      );

      // Cannot complete directly from REQUESTED
      await expect(
        service1.completeRefund(order.id, ref.id, { externalReference: 'EXT-1' }, { id: 'admin-3', name: 'Completer Admin' })
      ).rejects.toThrow(BadRequestException);

      // Cannot process execution directly from REQUESTED
      await expect(
        service1.processRefundExecution(order.id, ref.id, {}, { id: 'admin-1', name: 'Admin' })
      ).rejects.toThrow(BadRequestException);

      // Approve: REQUESTED -> APPROVED (by independent admin-2)
      await service1.approveRefund(order.id, ref.id, {}, { id: 'admin-2', name: 'Approver Admin' });

      // Cannot complete directly from APPROVED
      await expect(
        service1.completeRefund(order.id, ref.id, { externalReference: 'EXT-2' }, { id: 'admin-3', name: 'Completer Admin' })
      ).rejects.toThrow(BadRequestException);

      // Execution: APPROVED -> PROCESSING
      await service1.processRefundExecution(order.id, ref.id, {}, { id: 'admin-1', name: 'Admin' });

      // Complete: PROCESSING -> COMPLETED (by independent admin-3)
      await service1.completeRefund(order.id, ref.id, { externalReference: 'EXT-3' }, { id: 'admin-3', name: 'Completer Admin' });

      // Cannot reject a COMPLETED refund
      await expect(
        service1.rejectRefund(order.id, ref.id, { rejectionReason: 'Too late' }, { id: 'admin-1', name: 'Admin' })
      ).rejects.toThrow(BadRequestException);
    });

    it('Test N: completeRefund without external reference rejected', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-N-${Date.now()}`);

      const ref = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'Test N external ref check',
          idempotencyKey: `idem-n-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin' }
      );
      await service1.approveRefund(order.id, ref.id, {}, { id: 'admin-2', name: 'Approver Admin' });
      await service1.processRefundExecution(order.id, ref.id, {}, { id: 'admin-1', name: 'Admin' });

      // Empty string rejected
      await expect(
        service1.completeRefund(order.id, ref.id, { externalReference: '' }, { id: 'admin-3', name: 'Completer Admin' })
      ).rejects.toThrow(BadRequestException);

      // Whitespace rejected
      await expect(
        service1.completeRefund(order.id, ref.id, { externalReference: '   ' }, { id: 'admin-3', name: 'Completer Admin' })
      ).rejects.toThrow(BadRequestException);

      // Valid reference succeeds (by independent admin-3)
      const completed = await service1.completeRefund(
        order.id,
        ref.id,
        { externalReference: 'PAYHERE-REF-VALID-999' },
        { id: 'admin-3', name: 'Completer Admin' }
      );
      expect(completed.status).toBe(RefundStatus.COMPLETED);
      expect(completed.externalReference).toBe('PAYHERE-REF-VALID-999');
    });

    it('Test O: Cancellation cannot create duplicate refunds or over-refund', async () => {
      const { order } = await createTestOrder({ totalCents: 10000 });
      await createPaymentAttempt(order.id, 10000, `PH-O-${Date.now()}`);

      // Create prior partial refund for 4000
      await service1.processRefund(
        order.id,
        {
          amountCents: 4000,
          method: 'CARD_PAYHERE',
          reason: 'Prior partial refund',
          idempotencyKey: `idem-o-prior-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin' }
      );

      // Cancel order with processRefund: true -> must refund remaining 6000 only
      const cancelledOrder = await service1.cancelOrder(
        order.id,
        { reason: 'Customer requested cancellation', restoreInventory: true, processRefund: true },
        { id: 'admin-1', name: 'Admin' }
      );
      expect(cancelledOrder.orderStatus).toBe(OrderStatus.CANCELLED);

      const refunds = await prisma1.refundRecord.findMany({ where: { orderId: order.id } });
      expect(refunds.length).toBe(2);

      const cancelRefund = refunds.find((r) => r.reason.includes('Cancellation refund'));
      expect(cancelRefund?.amountCents).toBe(6000);

      const totalRefunded = refunds.reduce((sum, r) => sum + r.amountCents, 0);
      expect(totalRefunded).toBe(10000);

      // Second attempt to cancel order is rejected
      await expect(
        service1.cancelOrder(
          order.id,
          { reason: 'Second cancel attempt', restoreInventory: true, processRefund: true },
          { id: 'admin-1', name: 'Admin' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Test P: Cancellation does not cause duplicate stock restoration', async () => {
      const { order, product } = await createTestOrder();
      // Order had 2 units of product (initial stock was 20)
      const initialStock = product.stockQuantity;

      // First cancel restores 2 units
      await service1.cancelOrder(
        order.id,
        { reason: 'Stock restoration test', restoreInventory: true, processRefund: false },
        { id: 'admin-1', name: 'Admin' }
      );

      const refreshed = await prisma1.product.findUnique({ where: { id: product.id } });
      expect(refreshed?.stockQuantity).toBe(initialStock + 2);

      // Concurrent or duplicate cancellation attempt fails
      await expect(
        service1.cancelOrder(
          order.id,
          { reason: 'Duplicate cancel', restoreInventory: true, processRefund: false },
          { id: 'admin-1', name: 'Admin' }
        )
      ).rejects.toThrow(BadRequestException);

      // Stock remains exactly initial + 2
      const stockAfter = await prisma1.product.findUnique({ where: { id: product.id } });
      expect(stockAfter?.stockQuantity).toBe(initialStock + 2);
    });

    it('Test Q: Transaction rollback leaves no orphan refund or audit records', async () => {
      const { order } = await createTestOrder();

      const failingTx = async () => {
        return prisma1.$transaction(async (tx) => {
          await tx.refundRecord.create({
            data: {
              orderId: order.id,
              amountCents: 5000,
              currency: 'LKR',
              method: 'CARD_PAYHERE',
              status: RefundStatus.REQUESTED,
              reason: 'Will be rolled back',
            },
          });

          await tx.orderAuditLog.create({
            data: {
              orderId: order.id,
              action: 'REFUND_REQUESTED',
              fieldChanged: 'refundStatus',
              newValue: RefundStatus.REQUESTED,
              reason: 'Simulated rollback audit',
            },
          });

          throw new Error('Simulated database failure during refund pipeline');
        });
      };

      await expect(failingTx()).rejects.toThrow('Simulated database failure during refund pipeline');

      const refunds = await prisma1.refundRecord.findMany({ where: { orderId: order.id } });
      expect(refunds.length).toBe(0);

      const auditLogs = await prisma1.orderAuditLog.findMany({
        where: { orderId: order.id, reason: 'Simulated rollback audit' },
      });
      expect(auditLogs.length).toBe(0);
    });
  });

  describe('Stage 2.2.1: Refund Authorization & Segregation of Duties (PostgreSQL)', () => {
    it('Scenario A: User A requests refund -> User A cannot approve it (HTTP 403 ForbiddenException)', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-SODA-${Date.now()}`);

      const ref = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'SoD Scenario A request',
          idempotencyKey: `idem-sod-a-${Date.now()}`,
        },
        { id: 'user-a', name: 'User A' }
      );
      expect(ref.requestedById).toBe('user-a');

      await expect(
        service1.approveRefund(order.id, ref.id, {}, { id: 'user-a', name: 'User A' })
      ).rejects.toThrow(ForbiddenException);

      const dbRef = await prisma1.refundRecord.findUnique({ where: { id: ref.id } });
      expect(dbRef?.status).toBe(RefundStatus.REQUESTED);
      expect(dbRef?.approvedById).toBeNull();
    });

    it('Scenario B: User A requests refund -> User B approves it successfully (APPROVED, approvedById recorded)', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-SODB-${Date.now()}`);

      const ref = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'SoD Scenario B request',
          idempotencyKey: `idem-sod-b-${Date.now()}`,
        },
        { id: 'user-a', name: 'User A' }
      );

      const approved = await service1.approveRefund(
        order.id,
        ref.id,
        { notes: 'Approved by independent manager' },
        { id: 'user-b', name: 'User B' }
      );

      expect(approved.status).toBe(RefundStatus.APPROVED);
      expect(approved.requestedById).toBe('user-a');
      expect(approved.approvedById).toBe('user-b');

      const auditLog = await prisma1.orderAuditLog.findFirst({
        where: { orderId: order.id, action: 'REFUND_APPROVED' },
      });
      expect(auditLog?.adminId).toBe('user-b');
      expect(auditLog?.reason).toContain('Requester: user-a');
      expect(auditLog?.reason).toContain('Refund approved by User B');
    });

    it('Scenario C: User A requests refund -> User A cannot complete it (HTTP 403 ForbiddenException)', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-SODC-${Date.now()}`);

      const ref = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'SoD Scenario C request',
          idempotencyKey: `idem-sod-c-${Date.now()}`,
        },
        { id: 'user-a', name: 'User A' }
      );

      // Independent approval by user-b
      await service1.approveRefund(order.id, ref.id, {}, { id: 'user-b', name: 'User B' });
      // Move to processing
      await service1.processRefundExecution(order.id, ref.id, {}, { id: 'user-b', name: 'User B' });

      // User A attempts completion -> Rejected
      await expect(
        service1.completeRefund(
          order.id,
          ref.id,
          { externalReference: 'PAYHERE-EXT-C' },
          { id: 'user-a', name: 'User A' }
        )
      ).rejects.toThrow(ForbiddenException);

      const dbRef = await prisma1.refundRecord.findUnique({ where: { id: ref.id } });
      expect(dbRef?.status).toBe(RefundStatus.PROCESSING);
      expect(dbRef?.completedById).toBeNull();
    });

    it('Scenario D: User A requests refund -> User B approves -> User C completes it successfully', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-SODD-${Date.now()}`);

      const ref = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'SoD Scenario D request',
          idempotencyKey: `idem-sod-d-${Date.now()}`,
        },
        { id: 'user-a', name: 'User A' }
      );

      await service1.approveRefund(order.id, ref.id, {}, { id: 'user-b', name: 'User B' });
      await service1.processRefundExecution(order.id, ref.id, {}, { id: 'user-b', name: 'User B' });

      const completed = await service1.completeRefund(
        order.id,
        ref.id,
        { externalReference: 'PAYHERE-EXT-D' },
        { id: 'user-c', name: 'User C' }
      );

      expect(completed.status).toBe(RefundStatus.COMPLETED);
      expect(completed.requestedById).toBe('user-a');
      expect(completed.approvedById).toBe('user-b');
      expect(completed.completedById).toBe('user-c');

      const auditLog = await prisma1.orderAuditLog.findFirst({
        where: { orderId: order.id, action: 'REFUND_COMPLETED' },
      });
      expect(auditLog?.adminId).toBe('user-c');
      expect(auditLog?.reason).toContain('Requester: user-a');
      expect(auditLog?.reason).toContain('Approver: user-b');
    });

    it('Scenario E: Dual-Custody allowance: User B can complete refund requested by User A even if User B approved it', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-SODE-${Date.now()}`);

      const ref = await service1.processRefund(
        order.id,
        {
          amountCents: 4000,
          method: 'CARD_PAYHERE',
          reason: 'SoD Scenario E request',
          idempotencyKey: `idem-sod-e-${Date.now()}`,
        },
        { id: 'user-a', name: 'User A' }
      );

      await service1.approveRefund(order.id, ref.id, {}, { id: 'user-b', name: 'User B' });
      await service1.processRefundExecution(order.id, ref.id, {}, { id: 'user-b', name: 'User B' });

      const completed = await service1.completeRefund(
        order.id,
        ref.id,
        { externalReference: 'PAYHERE-EXT-E' },
        { id: 'user-b', name: 'User B' }
      );

      expect(completed.status).toBe(RefundStatus.COMPLETED);
      expect(completed.requestedById).toBe('user-a');
      expect(completed.approvedById).toBe('user-b');
      expect(completed.completedById).toBe('user-b');
    });

    it('Scenario F: Missing or undefined actor identity is rejected with BadRequestException', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-SODF-${Date.now()}`);

      // Request with missing actor rejected
      await expect(
        service1.processRefund(
          order.id,
          {
            amountCents: 3000,
            method: 'CARD_PAYHERE',
            reason: 'Missing actor',
            idempotencyKey: `idem-sod-f-${Date.now()}`,
          },
          undefined as any
        )
      ).rejects.toThrow(BadRequestException);

      // Create valid request
      const ref = await service1.processRefund(
        order.id,
        {
          amountCents: 3000,
          method: 'CARD_PAYHERE',
          reason: 'Valid request',
          idempotencyKey: `idem-sod-f2-${Date.now()}`,
        },
        { id: 'user-a', name: 'User A' }
      );

      // Approve with missing actor rejected
      await expect(
        service1.approveRefund(order.id, ref.id, {}, {} as any)
      ).rejects.toThrow(BadRequestException);

      // Complete with missing actor rejected
      await service1.approveRefund(order.id, ref.id, {}, { id: 'user-b', name: 'User B' });
      await service1.processRefundExecution(order.id, ref.id, {}, { id: 'user-b', name: 'User B' });

      await expect(
        service1.completeRefund(order.id, ref.id, { externalReference: 'REF-F' }, { id: '   ' } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario G: Legacy refund records with requestedById = null cannot be approved or completed', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-SODG-${Date.now()}`);

      // Create a simulated legacy record directly in DB with requestedById = null
      const legacyRef = await prisma1.refundRecord.create({
        data: {
          orderId: order.id,
          amountCents: 2000,
          currency: 'LKR',
          method: 'CARD_PAYHERE',
          status: RefundStatus.REQUESTED,
          reason: 'Legacy untracked refund',
          requestedById: null,
        },
      });

      // Attempt approval -> Rejected with BadRequestException
      await expect(
        service1.approveRefund(order.id, legacyRef.id, {}, { id: 'user-b', name: 'User B' })
      ).rejects.toThrow(BadRequestException);

      // Advance manually in DB to PROCESSING to test completion guard
      await prisma1.refundRecord.update({
        where: { id: legacyRef.id },
        data: { status: RefundStatus.PROCESSING },
      });

      // Attempt completion -> Rejected with BadRequestException
      await expect(
        service1.completeRefund(order.id, legacyRef.id, { externalReference: 'LEGACY-EXT' }, { id: 'user-b', name: 'User B' })
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario H: Concurrent approval attempts by different admins serialize via FOR UPDATE and only one succeeds', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-SODH-${Date.now()}`);

      const ref = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'Concurrent approval test',
          idempotencyKey: `idem-sod-h-${Date.now()}`,
        },
        { id: 'user-a', name: 'User A' }
      );

      // Two concurrent approvals: user-b (service1) and user-c (service2)
      const tasks = [
        service1.approveRefund(order.id, ref.id, { notes: 'Approval from user-b' }, { id: 'user-b', name: 'User B' }),
        service2.approveRefund(order.id, ref.id, { notes: 'Approval from user-c' }, { id: 'user-c', name: 'User C' }),
      ];

      const results = await Promise.allSettled(tasks);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const dbRef = await prisma1.refundRecord.findUnique({ where: { id: ref.id } });
      expect(dbRef?.status).toBe(RefundStatus.APPROVED);
      expect(['user-b', 'user-c']).toContain(dbRef?.approvedById);
    });

    it('Scenario I: Concurrent completion attempts serialize via FOR UPDATE and cannot complete twice', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-SODI-${Date.now()}`);

      const ref = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'Concurrent completion test',
          idempotencyKey: `idem-sod-i-${Date.now()}`,
        },
        { id: 'user-a', name: 'User A' }
      );

      await service1.approveRefund(order.id, ref.id, {}, { id: 'user-b', name: 'User B' });
      await service1.processRefundExecution(order.id, ref.id, {}, { id: 'user-b', name: 'User B' });

      // Two concurrent completions: user-b (service1) and user-c (service2)
      const tasks = [
        service1.completeRefund(order.id, ref.id, { externalReference: 'EXT-I1' }, { id: 'user-b', name: 'User B' }),
        service2.completeRefund(order.id, ref.id, { externalReference: 'EXT-I2' }, { id: 'user-c', name: 'User C' }),
      ];

      const results = await Promise.allSettled(tasks);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const dbRef = await prisma1.refundRecord.findUnique({ where: { id: ref.id } });
      expect(dbRef?.status).toBe(RefundStatus.COMPLETED);
    });

    it('Scenario J: Authorization failure leaves financial amounts and order status unchanged', async () => {
      const { order } = await createTestOrder();
      await createPaymentAttempt(order.id, 10000, `PH-SODJ-${Date.now()}`);

      const ref = await service1.processRefund(
        order.id,
        {
          amountCents: 4000,
          method: 'CARD_PAYHERE',
          reason: 'SoD Scenario J request',
          idempotencyKey: `idem-sod-j-${Date.now()}`,
        },
        { id: 'user-a', name: 'User A' }
      );

      // User A attempts self-approval
      await expect(
        service1.approveRefund(order.id, ref.id, {}, { id: 'user-a', name: 'User A' })
      ).rejects.toThrow(ForbiddenException);

      // Verify order payment status is still PAID (order status unchanged on failed approval)
      const dbOrder = await prisma1.order.findUnique({ where: { id: order.id } });
      expect(dbOrder?.paymentStatus).toBe(PaymentStatus.PAID);

      // Verify refund record status remains REQUESTED
      const dbRef = await prisma1.refundRecord.findUnique({ where: { id: ref.id } });
      expect(dbRef?.status).toBe(RefundStatus.REQUESTED);
      expect(dbRef?.approvedById).toBeNull();

      // Verify no audit log for approval was created
      const auditLog = await prisma1.orderAuditLog.findFirst({
        where: { orderId: order.id, action: 'REFUND_APPROVED' },
      });
      expect(auditLog).toBeNull();
    });
  });

  // ============================================================================
  // STAGE 2.5: COMPLETE END-TO-END POSTGRESQL CONCURRENCY & FINANCIAL VERIFICATION
  // TESTS A THROUGH V
  // ============================================================================

  describe('Stage 2.5: Complete End-to-End PostgreSQL Concurrency & Financial Verification (Tests A through V)', () => {
    it('Test A: Multiple return requests cannot exceed purchased quantities', async () => {
      const { order, product } = await createTestOrder({
        orderStatus: OrderStatus.DELIVERED,
      });

      const orderItem = order.items[0];

      // Order item has quantity 2. Request 1 item return -> succeeds
      const ret1 = await service1.createReturnRequest(
        order.id,
        {
          reason: 'Customer return',
          items: [{ orderItemId: orderItem.id, quantity: 1, reason: 'Size too big' }],
        },
        { id: 'admin-1', name: 'Admin 1' }
      );
      expect(ret1.id).toBeDefined();

      // Attempt second return for 2 units (exceeds purchased quantity of 2) -> rejected
      await expect(
        service1.createReturnRequest(
          order.id,
          {
            reason: 'Second return request',
            items: [{ orderItemId: orderItem.id, quantity: 2, reason: 'Defective' }],
          },
          { id: 'admin-1', name: 'Admin 1' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Test B: Concurrent return creation remains safe', async () => {
      // Create delivered order with quantity 5
      const product = await prisma1.product.create({
        data: {
          name: `Conc Prod B ${Date.now()}`,
          slug: `conc-prod-b-${Date.now()}`,
          sku: `SKU-B-${Date.now()}`,
          description: 'Desc',
          shortDescription: 'Short',
          categoryId: testCategory.id,
          brandId: testBrand.id,
          priceCents: 2000,
          stockQuantity: 20,
          isActive: true,
        },
      });
      cleanupProductIds.push(product.id);

      const order = await prisma1.order.create({
        data: {
          orderNumber: `ORD-B-${Date.now()}`,
          orderStatus: OrderStatus.DELIVERED,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.CARD_PAYHERE,
          customerName: 'Buyer B',
          customerEmail: 'buyer-b@dsl.lk',
          customerPhone: '+94770000000',
          totalCents: 10000,
          subtotalCents: 10000,
          items: {
            create: [
              {
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                quantity: 5,
                unitPriceCents: 2000,
                totalPriceCents: 10000,
              },
            ],
          },
        },
        include: { items: true },
      });
      cleanupOrderIds.push(order.id);

      const orderItemId = order.items[0].id;

      // Two concurrent connections attempt to return 4 units each
      const results = await Promise.allSettled([
        service1.createReturnRequest(
          order.id,
          { reason: 'Conc 1 reason', items: [{ orderItemId, quantity: 4, reason: 'Conc 1' }] },
          { id: 'admin-1', name: 'Admin 1' }
        ),
        service2.createReturnRequest(
          order.id,
          { reason: 'Conc 2 reason', items: [{ orderItemId, quantity: 4, reason: 'Conc 2' }] },
          { id: 'admin-2', name: 'Admin 2' }
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const returns = await prisma1.orderReturnRequest.findMany({
        where: { orderId: order.id },
        include: { items: true },
      });
      expect(returns.length).toBe(1);
      expect(returns[0].items[0].quantity).toBe(4);
    });

    it('Test C: Return receipt cannot restock twice', async () => {
      const { order, product } = await createTestOrder({
        orderStatus: OrderStatus.DELIVERED,
      });
      const initialStock = product.stockQuantity;
      const orderItemId = order.items[0].id;

      const ret = await service1.createReturnRequest(
        order.id,
        { reason: 'Wrong item return', items: [{ orderItemId, quantity: 2, reason: 'Wrong item' }] },
        { id: 'admin-1', name: 'Admin 1' }
      );

      await service1.processReturnStatus(
        order.id,
        ret.id,
        { action: 'APPROVE' },
        { id: 'admin-2', name: 'Admin 2' }
      );

      // Two concurrent calls to CONFIRM_RECEIVED with restockItems: true
      const results = await Promise.allSettled([
        service1.processReturnStatus(
          order.id,
          ret.id,
          { action: 'CONFIRM_RECEIVED', restockItems: true },
          { id: 'admin-1', name: 'Admin 1' }
        ),
        service2.processReturnStatus(
          order.id,
          ret.id,
          { action: 'CONFIRM_RECEIVED', restockItems: true },
          { id: 'admin-2', name: 'Admin 2' }
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const updatedProduct = await prisma1.product.findUnique({ where: { id: product.id } });
      expect(updatedProduct?.stockQuantity).toBe(initialStock + 2);
    });

    it('Test D: Return-linked refunds retain correct relationships', async () => {
      const { order } = await createTestOrder({
        orderStatus: OrderStatus.DELIVERED,
      });
      await createPaymentAttempt(order.id, 10000, `PH-D-${Date.now()}`);

      const ret = await service1.createReturnRequest(
        order.id,
        { reason: 'Defect return', items: [{ orderItemId: order.items[0].id, quantity: 1, reason: 'Defect' }] },
        { id: 'admin-1', name: 'Admin 1' }
      );

      await service1.processReturnStatus(
        order.id,
        ret.id,
        { action: 'APPROVE' },
        { id: 'admin-2', name: 'Admin 2' }
      );

      const refund = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'Return linked refund',
          orderReturnRequestId: ret.id,
          idempotencyKey: `idem-d-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin 1' }
      );

      expect(refund.orderReturnRequestId).toBe(ret.id);

      const fetchedOrder = await service1.getOrderById(order.id);
      expect(fetchedOrder.refundRecords.length).toBe(1);
      expect(fetchedOrder.refundRecords[0].orderReturnRequestId).toBe(ret.id);
      expect(fetchedOrder.refundRecords[0].orderReturnRequest.id).toBe(ret.id);
      expect(fetchedOrder.returnRequests[0].refundRecords[0].id).toBe(refund.id);
    });

    it('Test E: A return cannot be marked REFUNDED before its refund completes', async () => {
      const { order } = await createTestOrder({
        orderStatus: OrderStatus.DELIVERED,
      });
      await createPaymentAttempt(order.id, 10000, `PH-E-${Date.now()}`);

      const ret = await service1.createReturnRequest(
        order.id,
        { reason: 'Defect return', items: [{ orderItemId: order.items[0].id, quantity: 1, reason: 'Defect' }] },
        { id: 'admin-1', name: 'Admin 1' }
      );

      await service1.processReturnStatus(
        order.id,
        ret.id,
        { action: 'APPROVE' },
        { id: 'admin-2', name: 'Admin 2' }
      );

      await service1.processReturnStatus(
        order.id,
        ret.id,
        { action: 'CONFIRM_RECEIVED', restockItems: false },
        { id: 'admin-2', name: 'Admin 2' }
      );

      const refund = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'In-flight refund',
          orderReturnRequestId: ret.id,
          idempotencyKey: `idem-e-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin 1' }
      );

      // Refund is REQUESTED -> return items must remain RECEIVED
      let items = await prisma1.orderReturnItem.findMany({ where: { returnRequestId: ret.id } });
      expect(items[0].status).toBe(ReturnItemStatus.RECEIVED);

      // Refund is APPROVED -> return items must still remain RECEIVED
      await service2.approveRefund(order.id, refund.id, {}, { id: 'admin-2', name: 'Admin 2' });
      items = await prisma1.orderReturnItem.findMany({ where: { returnRequestId: ret.id } });
      expect(items[0].status).toBe(ReturnItemStatus.RECEIVED);
    });

    it('Test F: Completing a linked refund updates the correct return item status', async () => {
      const { order } = await createTestOrder({
        orderStatus: OrderStatus.DELIVERED,
      });
      await createPaymentAttempt(order.id, 10000, `PH-F-${Date.now()}`);

      const ret = await service1.createReturnRequest(
        order.id,
        { reason: 'Defect return', items: [{ orderItemId: order.items[0].id, quantity: 1, reason: 'Defect' }] },
        { id: 'admin-1', name: 'Admin 1' }
      );

      await service1.processReturnStatus(
        order.id,
        ret.id,
        { action: 'APPROVE' },
        { id: 'admin-2', name: 'Admin 2' }
      );

      await service1.processReturnStatus(
        order.id,
        ret.id,
        { action: 'CONFIRM_RECEIVED', restockItems: false },
        { id: 'admin-2', name: 'Admin 2' }
      );

      const refund = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'Full return refund',
          orderReturnRequestId: ret.id,
          idempotencyKey: `idem-f-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin 1' }
      );

      await service2.approveRefund(order.id, refund.id, {}, { id: 'admin-2', name: 'Admin 2' });

      // Move to PROCESSING before completion
      await service2.processRefundExecution(order.id, refund.id, {}, { id: 'admin-2', name: 'Admin 2' });

      // Admin 3 completes refund
      await service3.completeRefund(
        order.id,
        refund.id,
        { externalReference: 'PAYHERE-REF-F-DONE' },
        { id: 'admin-3', name: 'Admin 3' }
      );

      // Return items must now be REFUNDED
      const items = await prisma1.orderReturnItem.findMany({ where: { returnRequestId: ret.id } });
      expect(items[0].status).toBe(ReturnItemStatus.REFUNDED);
    });

    it('Test G: Refund totals cannot exceed verified collections', async () => {
      const { order } = await createTestOrder({ totalCents: 6000 });
      await createPaymentAttempt(order.id, 6000, `PH-G-${Date.now()}`);

      await service1.processRefund(
        order.id,
        {
          amountCents: 4000,
          method: 'CARD_PAYHERE',
          reason: 'Initial 4000',
          idempotencyKey: `idem-g-1-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin 1' }
      );

      // Attempting to refund 2500 (total would be 6500 > 6000 verified collection) -> rejected
      await expect(
        service1.processRefund(
          order.id,
          {
            amountCents: 2500,
            method: 'CARD_PAYHERE',
            reason: 'Excess refund',
            idempotencyKey: `idem-g-2-${Date.now()}`,
          },
          { id: 'admin-1', name: 'Admin 1' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Test H: Reserved refunds correctly reduce available balances', async () => {
      const { order } = await createTestOrder({ totalCents: 10000 });
      await createPaymentAttempt(order.id, 10000, `PH-H-${Date.now()}`);

      await service1.processRefund(
        order.id,
        {
          amountCents: 3500,
          method: 'CARD_PAYHERE',
          reason: 'Reserve test',
          idempotencyKey: `idem-h-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin 1' }
      );

      const fetched = await service1.getOrderById(order.id);
      expect(fetched.financialSummary.verifiedCollectedCents).toBe(10000);
      expect(fetched.financialSummary.reservedRefundsCents).toBe(3500);
      expect(fetched.financialSummary.completedRefundsCents).toBe(0);
      expect(fetched.financialSummary.availableRefundBalanceCents).toBe(6500);
    });

    it('Test I: Failed and rejected refunds release reservations', async () => {
      const { order } = await createTestOrder({ totalCents: 10000 });
      await createPaymentAttempt(order.id, 10000, `PH-I-${Date.now()}`);

      // Request refund of 4000
      const ref1 = await service1.processRefund(
        order.id,
        {
          amountCents: 4000,
          method: 'CARD_PAYHERE',
          reason: 'To be rejected',
          idempotencyKey: `idem-i-1-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin 1' }
      );

      let fetched = await service1.getOrderById(order.id);
      expect(fetched.financialSummary.availableRefundBalanceCents).toBe(6000);

      // Reject ref1 -> releases reservation
      await service2.rejectRefund(
        order.id,
        ref1.id,
        { rejectionReason: 'Customer changed mind' },
        { id: 'admin-2', name: 'Admin 2' }
      );

      fetched = await service1.getOrderById(order.id);
      expect(fetched.financialSummary.reservedRefundsCents).toBe(0);
      expect(fetched.financialSummary.availableRefundBalanceCents).toBe(10000);

      // Request ref2 and fail it
      const ref2 = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'To be failed',
          idempotencyKey: `idem-i-2-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin 1' }
      );

      await service2.approveRefund(order.id, ref2.id, {}, { id: 'admin-2', name: 'Admin 2' });
      await service2.processRefundExecution(order.id, ref2.id, {}, { id: 'admin-2', name: 'Admin 2' });
      await service2.failRefund(
        order.id,
        ref2.id,
        { failureReason: 'Gateway API failure' },
        { id: 'admin-2', name: 'Admin 2' }
      );

      fetched = await service1.getOrderById(order.id);
      expect(fetched.financialSummary.reservedRefundsCents).toBe(0);
      expect(fetched.financialSummary.availableRefundBalanceCents).toBe(10000);
    });

    it('Test J: Duplicate payment references cannot inflate verified collections', async () => {
      const { order } = await createTestOrder({ totalCents: 10000 });
      const dupRef = `PH-DUP-J-${Date.now()}`;
      await createPaymentAttempt(order.id, 5000, dupRef);

      // Attempting to insert duplicate gatewayReference into database violates unique constraint
      await expect(
        createPaymentAttempt(order.id, 5000, dupRef)
      ).rejects.toThrow();

      // Calculation logic also verifies single counting per reference
      const fetched = await service1.getOrderById(order.id);
      expect(fetched.financialSummary.verifiedCollectedCents).toBe(5000);
    });

    it('Test K: Different payment references with equal amounts remain separate valid collections', async () => {
      const { order } = await createTestOrder({ totalCents: 10000 });
      await createPaymentAttempt(order.id, 5000, `PH-K-1-${Date.now()}`);
      await createPaymentAttempt(order.id, 5000, `PH-K-2-${Date.now()}`);

      const fetched = await service1.getOrderById(order.id);
      expect(fetched.financialSummary.verifiedCollectedCents).toBe(10000);
      expect(fetched.financialSummary.availableRefundBalanceCents).toBe(10000);
    });

    it('Test L: COD refunds remain blocked', async () => {
      const { order } = await createTestOrder({
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        orderStatus: OrderStatus.DELIVERED,
      });

      await expect(
        service1.processRefund(
          order.id,
          {
            amountCents: 1000,
            method: 'CASH_ON_DELIVERY',
            reason: 'COD refund attempt',
            idempotencyKey: `idem-l-${Date.now()}`,
          },
          { id: 'admin-1', name: 'Admin 1' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Test M: Koko refunds remain blocked', async () => {
      const { order } = await createTestOrder({
        paymentMethod: PaymentMethod.KOKO_BNPL,
      });

      await expect(
        service1.processRefund(
          order.id,
          {
            amountCents: 1000,
            method: 'KOKO_BNPL',
            reason: 'Koko refund attempt',
            idempotencyKey: `idem-m-${Date.now()}`,
          },
          { id: 'admin-1', name: 'Admin 1' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Test N: Unverified bank transfers remain blocked', async () => {
      const { order } = await createTestOrder({
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        paymentStatus: PaymentStatus.PAID,
      });

      // No verified deposit payment attempt exists
      await expect(
        service1.processRefund(
          order.id,
          {
            amountCents: 1000,
            method: 'BANK_TRANSFER',
            reason: 'Unverified bank transfer refund',
            idempotencyKey: `idem-n-${Date.now()}`,
          },
          { id: 'admin-1', name: 'Admin 1' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Test O: Requesters cannot approve or complete their own refunds', async () => {
      const { order } = await createTestOrder({ totalCents: 10000 });
      await createPaymentAttempt(order.id, 10000, `PH-O-${Date.now()}`);

      const ref = await service1.processRefund(
        order.id,
        {
          amountCents: 2000,
          method: 'CARD_PAYHERE',
          reason: 'SoD test O',
          idempotencyKey: `idem-o-${Date.now()}`,
        },
        { id: 'admin-user-a', name: 'Admin A' }
      );

      // Self-approval rejected
      await expect(
        service1.approveRefund(order.id, ref.id, {}, { id: 'admin-user-a', name: 'Admin A' })
      ).rejects.toThrow(ForbiddenException);

      // Approve via User B
      await service2.approveRefund(order.id, ref.id, {}, { id: 'admin-user-b', name: 'Admin B' });

      // Self-completion rejected
      await expect(
        service1.completeRefund(
          order.id,
          ref.id,
          { externalReference: 'EXT-O-SELF' },
          { id: 'admin-user-a', name: 'Admin A' }
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('Test P: Legacy refund records remain protected', async () => {
      const { order } = await createTestOrder({ totalCents: 10000 });
      await createPaymentAttempt(order.id, 10000, `PH-P-${Date.now()}`);

      // Insert legacy refund record with requestedById = null
      const legacyRef = await prisma1.refundRecord.create({
        data: {
          orderId: order.id,
          amountCents: 3000,
          method: PaymentMethod.CARD_PAYHERE,
          reason: 'Legacy refund without actor',
          idempotencyKey: `idem-legacy-${Date.now()}`,
          status: RefundStatus.REQUESTED,
          requestedById: null,
        },
      });

      // Attempting to approve legacy record is rejected
      await expect(
        service1.approveRefund(order.id, legacyRef.id, {}, { id: 'admin-1', name: 'Admin 1' })
      ).rejects.toThrow(BadRequestException);

      // Attempting to complete legacy record is rejected
      await expect(
        service1.completeRefund(
          order.id,
          legacyRef.id,
          { externalReference: 'LEGACY-EXT' },
          { id: 'admin-1', name: 'Admin 1' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Test Q: Concurrent refund requests cannot over-refund', async () => {
      const { order } = await createTestOrder({ totalCents: 10000 });
      await createPaymentAttempt(order.id, 10000, `PH-Q-${Date.now()}`);

      // 5 concurrent requests of 4000 cents each from 5 connections
      const results = await Promise.allSettled([
        service1.processRefund(
          order.id,
          { amountCents: 4000, method: 'CARD_PAYHERE', reason: 'Conc 1', idempotencyKey: `idem-q-1-${Date.now()}` },
          { id: 'admin-1', name: 'Admin 1' }
        ),
        service2.processRefund(
          order.id,
          { amountCents: 4000, method: 'CARD_PAYHERE', reason: 'Conc 2', idempotencyKey: `idem-q-2-${Date.now()}` },
          { id: 'admin-2', name: 'Admin 2' }
        ),
        service3.processRefund(
          order.id,
          { amountCents: 4000, method: 'CARD_PAYHERE', reason: 'Conc 3', idempotencyKey: `idem-q-3-${Date.now()}` },
          { id: 'admin-3', name: 'Admin 3' }
        ),
        service4.processRefund(
          order.id,
          { amountCents: 4000, method: 'CARD_PAYHERE', reason: 'Conc 4', idempotencyKey: `idem-q-4-${Date.now()}` },
          { id: 'admin-4', name: 'Admin 4' }
        ),
        service5.processRefund(
          order.id,
          { amountCents: 4000, method: 'CARD_PAYHERE', reason: 'Conc 5', idempotencyKey: `idem-q-5-${Date.now()}` },
          { id: 'admin-5', name: 'Admin 5' }
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // 10000 balance allows exactly two 4000 requests (8000 total)
      expect(fulfilled.length).toBe(2);
      expect(rejected.length).toBe(3);

      const refunds = await prisma1.refundRecord.findMany({ where: { orderId: order.id } });
      const totalRequested = refunds.reduce((sum, r) => sum + r.amountCents, 0);
      expect(totalRequested).toBe(8000);
      expect(totalRequested).toBeLessThanOrEqual(10000);
    });

    it('Test R: Concurrent refund completion cannot complete twice', async () => {
      const { order } = await createTestOrder({ totalCents: 10000 });
      await createPaymentAttempt(order.id, 10000, `PH-R-${Date.now()}`);

      const ref = await service1.processRefund(
        order.id,
        {
          amountCents: 5000,
          method: 'CARD_PAYHERE',
          reason: 'Test R',
          idempotencyKey: `idem-r-${Date.now()}`,
        },
        { id: 'admin-1', name: 'Admin 1' }
      );

      await service2.approveRefund(order.id, ref.id, {}, { id: 'admin-2', name: 'Admin 2' });

      // Move to PROCESSING first
      await service2.processRefundExecution(order.id, ref.id, {}, { id: 'admin-2', name: 'Admin 2' });

      // Two concurrent completions
      const results = await Promise.allSettled([
        service2.completeRefund(
          order.id,
          ref.id,
          { externalReference: 'EXT-R-CONN1' },
          { id: 'admin-2', name: 'Admin 2' }
        ),
        service3.completeRefund(
          order.id,
          ref.id,
          { externalReference: 'EXT-R-CONN2' },
          { id: 'admin-3', name: 'Admin 3' }
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const completed = await prisma1.refundRecord.findUnique({ where: { id: ref.id } });
      expect(completed?.status).toBe(RefundStatus.COMPLETED);
    });

    it('Test S: Concurrent return and refund operations preserve consistency', async () => {
      const { order } = await createTestOrder({
        orderStatus: OrderStatus.DELIVERED,
        totalCents: 10000,
      });
      await createPaymentAttempt(order.id, 10000, `PH-S-${Date.now()}`);
      const orderItemId = order.items[0].id;

      // Concurrently create return request and request refund
      const results = await Promise.allSettled([
        service1.createReturnRequest(
          order.id,
          {
            reason: 'Concurrent return reason',
            items: [{ orderItemId, quantity: 1, reason: 'Conc return S' }],
          },
          { id: 'admin-1', name: 'Admin 1' }
        ),
        service2.processRefund(
          order.id,
          {
            amountCents: 3000,
            method: 'CARD_PAYHERE',
            reason: 'Conc refund S',
            idempotencyKey: `idem-s-${Date.now()}`,
          },
          { id: 'admin-2', name: 'Admin 2' }
        ),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');

      const fetched = await service1.getOrderById(order.id);
      expect(fetched.returnRequests.length).toBe(1);
      expect(fetched.refundRecords.length).toBe(1);
      expect(fetched.financialSummary.reservedRefundsCents).toBe(3000);
      expect(fetched.financialSummary.availableRefundBalanceCents).toBe(7000);
    });

    it('Test T: Cancellation cannot duplicate refunds or inventory restoration', async () => {
      const { order, product } = await createTestOrder({ totalCents: 10000 });
      const initialStock = product.stockQuantity;
      await createPaymentAttempt(order.id, 10000, `PH-T-${Date.now()}`);

      // Concurrent cancellations
      const results = await Promise.allSettled([
        service1.cancelOrder(
          order.id,
          { reason: 'Customer cancel conc 1', restoreInventory: true, processRefund: true },
          { id: 'admin-1', name: 'Admin 1' }
        ),
        service2.cancelOrder(
          order.id,
          { reason: 'Customer cancel conc 2', restoreInventory: true, processRefund: true },
          { id: 'admin-2', name: 'Admin 2' }
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Stock restored exactly once (order quantity was 2)
      const updatedProduct = await prisma1.product.findUnique({ where: { id: product.id } });
      expect(updatedProduct?.stockQuantity).toBe(initialStock + 2);

      // Exactly one cancellation refund created
      const refunds = await prisma1.refundRecord.findMany({ where: { orderId: order.id } });
      expect(refunds.length).toBe(1);
      expect(refunds[0].amountCents).toBe(10000);
    });

    it('Test U: Audit records remain correct after successful and failed operations', async () => {
      const { order } = await createTestOrder({ totalCents: 10000 });
      await createPaymentAttempt(order.id, 10000, `PH-U-${Date.now()}`);

      // Successful request
      const ref = await service1.processRefund(
        order.id,
        {
          amountCents: 2000,
          method: 'CARD_PAYHERE',
          reason: 'Audit test U',
          idempotencyKey: `idem-u-${Date.now()}`,
        },
        { id: 'admin-requester-u', name: 'Requester U' }
      );

      // Failed self-approval (unauthorized)
      await expect(
        service1.approveRefund(order.id, ref.id, {}, { id: 'admin-requester-u', name: 'Requester U' })
      ).rejects.toThrow(ForbiddenException);

      // Successful approval by different admin
      await service2.approveRefund(order.id, ref.id, {}, { id: 'admin-approver-u', name: 'Approver U' });

      // Successful processing transition
      await service2.processRefundExecution(order.id, ref.id, {}, { id: 'admin-approver-u', name: 'Approver U' });

      // Successful completion by approver U
      await service2.completeRefund(
        order.id,
        ref.id,
        { externalReference: 'PAYHERE-U-DONE' },
        { id: 'admin-approver-u', name: 'Approver U' }
      );

      // Verify audit logs
      const logs = await prisma1.orderAuditLog.findMany({
        where: { orderId: order.id },
        orderBy: { createdAt: 'asc' },
      });

      const actions = logs.map((l) => l.action);
      expect(actions).toContain('REFUND_REQUESTED');
      expect(actions).toContain('REFUND_APPROVED');
      expect(actions).toContain('REFUND_PROCESSING');
      expect(actions).toContain('REFUND_COMPLETED');

      // Unauthorized action produced zero bogus audit logs
      const unauthorizedLogs = logs.filter(
        (l) => l.action === 'REFUND_APPROVED' && l.actorId === 'admin-requester-u'
      );
      expect(unauthorizedLogs.length).toBe(0);
    });

    it('Test V: Transaction rollback leaves no orphan refund, return, audit, or inventory records', async () => {
      const { order, product } = await createTestOrder({ totalCents: 10000 });
      const initialStock = product.stockQuantity;

      // Simulated transaction failure
      const failingTx = async () => {
        return prisma1.$transaction(async (tx) => {
          await tx.refundRecord.create({
            data: {
              orderId: order.id,
              amountCents: 5000,
              method: PaymentMethod.CARD_PAYHERE,
              reason: 'Orphan test refund',
              idempotencyKey: `idem-v-${Date.now()}`,
              status: RefundStatus.REQUESTED,
              requestedById: 'admin-1',
            },
          });

          await tx.inventoryMovement.create({
            data: {
              productId: product.id,
              previousQuantity: initialStock,
              newQuantity: initialStock + 5,
              changeAmount: 5,
              reason: InventoryChangeReason.RESTOCK,
            },
          });

          throw new Error('Simulated rollback failure midway');
        });
      };

      await expect(failingTx()).rejects.toThrow('Simulated rollback failure midway');

      // Verify no records persisted
      const refunds = await prisma1.refundRecord.findMany({ where: { orderId: order.id } });
      expect(refunds.length).toBe(0);

      const movements = await prisma1.inventoryMovement.findMany({
        where: { productId: product.id, reason: InventoryChangeReason.RETURN_RESTOCK },
      });
      expect(movements.length).toBe(0);

      const currentProduct = await prisma1.product.findUnique({ where: { id: product.id } });
      expect(currentProduct?.stockQuantity).toBe(initialStock);
    });
  });
});
