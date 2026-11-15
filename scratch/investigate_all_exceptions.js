const { Pool } = require('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/backend/node_modules/pg');
const { PrismaPg } = require('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/backend/node_modules/@prisma/adapter-pg');
const { PrismaClient, PaymentStatus, PaymentMethod, ReturnItemStatus, RefundStatus, PaymentAttemptStatus } = require('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/backend/src/generated/prisma');
const fs = require('fs');

const envContent = fs.readFileSync('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/backend/.env', 'utf8');
const match = envContent.match(/TEST_DATABASE_URL=["']?([^"'\r\n]+)["']?/);
const testDbUrl = match[1];

if (!testDbUrl.includes('_test')) {
  console.error("FATAL ERROR: Target database does not contain _test! ABORTING.");
  process.exit(1);
}

console.log("SAFETY CHECK PASSED: Verified target database is:", testDbUrl.replace(/:[^:@]+@/, ':****@'));

const pool = new Pool({ connectionString: testDbUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const orders = await prisma.order.findMany({
    include: {
      paymentAttempts: {
        where: { status: PaymentAttemptStatus.SUCCEEDED },
        orderBy: { createdAt: 'desc' },
      },
      refundRecords: {
        include: {
          orderReturnRequest: {
            select: { id: true, returnNumber: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      returnRequests: {
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Total orders in dsl_stationery_test: ${orders.length}`);

  const exceptionOrders = [];

  for (const order of orders) {
    let verifiedCollectedCents = 0;
    const paymentReferences = [];
    const paymentRefCounts = new Map();

    for (const pa of order.paymentAttempts) {
      if (pa.gatewayReference) {
        paymentRefCounts.set(pa.gatewayReference, (paymentRefCounts.get(pa.gatewayReference) || 0) + 1);
      }
    }

    if (
      order.paymentMethod === PaymentMethod.CARD_PAYHERE ||
      order.paymentMethod === PaymentMethod.BANK_TRANSFER
    ) {
      const seenRefs = new Set();
      for (const pa of order.paymentAttempts) {
        if (pa.gatewayReference) {
          paymentReferences.push(pa.gatewayReference);
          if (!seenRefs.has(pa.gatewayReference)) {
            seenRefs.add(pa.gatewayReference);
            verifiedCollectedCents += pa.amountCents;
          }
        }
      }
    }

    let completedRefundsCents = 0;
    let reservedRefundsCents = 0;
    const refundReferences = [];
    const refundRefCounts = new Map();
    let hasCompletedWithoutEvidence = false;

    for (const ref of order.refundRecords) {
      if (ref.status === RefundStatus.COMPLETED) {
        completedRefundsCents += ref.amountCents;
        if (ref.externalReference) {
          refundReferences.push(ref.externalReference);
          refundRefCounts.set(ref.externalReference, (refundRefCounts.get(ref.externalReference) || 0) + 1);
        } else {
          hasCompletedWithoutEvidence = true;
        }
      } else if (
        ref.status === RefundStatus.REQUESTED ||
        ref.status === RefundStatus.APPROVED ||
        ref.status === RefundStatus.PROCESSING
      ) {
        reservedRefundsCents += ref.amountCents;
      }
    }

    const refundCeilingCents = Math.min(order.totalCents, verifiedCollectedCents);
    const availableRefundBalanceCents = Math.max(
      0,
      refundCeilingCents - completedRefundsCents - reservedRefundsCents
    );

    const discrepancies = [];
    if (completedRefundsCents + reservedRefundsCents > verifiedCollectedCents) {
      discrepancies.push('REFUNDS_EXCEED_COLLECTIONS: Total refunds exceed verified collected funds');
    }
    if (order.paymentStatus === PaymentStatus.PAID && verifiedCollectedCents === 0) {
      discrepancies.push('PAID_WITHOUT_COLLECTION: Order marked PAID without verified collection evidence');
    }
    for (const [ref, count] of paymentRefCounts.entries()) {
      if (count > 1) {
        discrepancies.push(`DUPLICATE_PAYMENT_REF: Payment reference "${ref}" appears ${count} times`);
      }
    }
    for (const [ref, count] of refundRefCounts.entries()) {
      if (count > 1) {
        discrepancies.push(`DUPLICATE_REFUND_REF: Refund reference "${ref}" appears ${count} times`);
      }
    }
    if (hasCompletedWithoutEvidence) {
      discrepancies.push('COMPLETED_WITHOUT_EVIDENCE: Refund marked COMPLETED without external transaction reference');
    }
    const hasReturnMismatch = order.returnRequests.some((rr) =>
      rr.items.some((it) => it.status === ReturnItemStatus.REFUNDED) &&
      !order.refundRecords.some((rf) => rf.orderReturnRequestId === rr.id && rf.status === RefundStatus.COMPLETED)
    );
    if (hasReturnMismatch) {
      discrepancies.push('RETURN_REFUND_MISMATCH: Return item marked REFUNDED without completed linked refund');
    }

    if (discrepancies.length > 0) {
      exceptionOrders.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        totalCents: order.totalCents,
        verifiedCollectedCents,
        completedRefundsCents,
        reservedRefundsCents,
        availableRefundBalanceCents,
        paymentAttemptsCount: order.paymentAttempts.length,
        paymentReferences,
        refundRecordsCount: order.refundRecords.length,
        refundReferences,
        returnRequestsCount: order.returnRequests.length,
        discrepancies
      });
    }
  }

  console.log(`\nFound ${exceptionOrders.length} orders with discrepancies:`);
  console.log(JSON.stringify(exceptionOrders, null, 2));

  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => {
  console.error("Error inspecting exceptions:", err);
  process.exit(1);
});

