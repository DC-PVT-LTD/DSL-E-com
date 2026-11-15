const { Pool } = require('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/backend/node_modules/pg');
const { PrismaPg } = require('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/backend/node_modules/@prisma/adapter-pg');
const { PrismaClient, OrderStatus, PaymentStatus, PaymentMethod, ReturnStatus, ReturnItemStatus, InventoryChangeReason, RefundStatus, PaymentAttemptStatus } = require('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/backend/src/generated/prisma');
const jwt = require('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/backend/node_modules/jsonwebtoken');

const testDbUrl = "postgresql://postgres:yehara123@A@localhost:5432/dsl_stationery_test?schema=public";
const pool = new Pool({ connectionString: testDbUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const fs = require('fs');
const envContent = fs.readFileSync('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/backend/.env', 'utf8');
const jwtMatch = envContent.match(/JWT_SECRET=["']?([a-f0-9]+)["']?/i);
const JWT_SECRET = jwtMatch ? jwtMatch[1] : "a9cd9238f31cac2e503e9e863ac589487d7f134f46027159007862a31c5f798503ac3d695f47ca1bdcc99344b133930f1230fb7ea1223ffd9ce47ed99377dc8d";

function generateAdminToken(user) {
  return jwt.sign(
    { sub: user.id, id: user.id, email: user.email, role: user.role, name: `${user.firstName} ${user.lastName}` },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

async function runQA() {
  console.log("================================================================================");
  console.log("DSL STATIONERY — STAGE 2 FINAL MANUAL QA AUDIT SUITE");
  console.log("Target Database: dsl_stationery_test");
  console.log("Time:", new Date().toISOString());
  console.log("================================================================================\n");

  const results = [];

  // Setup Admin Users
  let admin1 = await prisma.user.findFirst({ where: { email: 'qa-admin1@dsl.lk' } });
  if (!admin1) {
    admin1 = await prisma.user.create({
      data: {
        email: 'qa-admin1@dsl.lk',
        passwordHash: 'dummy-hash',
        name: 'Alice Requester',
        role: 'ADMIN',
        isActive: true,
      }
    });
  }

  let admin2 = await prisma.user.findFirst({ where: { email: 'qa-admin2@dsl.lk' } });
  if (!admin2) {
    admin2 = await prisma.user.create({
      data: {
        email: 'qa-admin2@dsl.lk',
        passwordHash: 'dummy-hash',
        name: 'Bob Approver',
        role: 'ADMIN',
        isActive: true,
      }
    });
  }

  const tokenAdmin1 = generateAdminToken(admin1);
  const tokenAdmin2 = generateAdminToken(admin2);

  // Setup Product & Category & Brand
  let cat = await prisma.category.findFirst({ where: { slug: 'qa-test-cat' } });
  if (!cat) {
    cat = await prisma.category.create({
      data: { name: 'QA Test Category', slug: 'qa-test-cat', description: 'QA Category' }
    });
  }

  let brand = await prisma.brand.findFirst({ where: { slug: 'qa-test-brand' } });
  if (!brand) {
    brand = await prisma.brand.create({
      data: { name: 'QA Test Brand', slug: 'qa-test-brand', description: 'QA Brand', originCountry: 'LK' }
    });
  }

  const prodA = await prisma.product.create({
    data: {
      name: `QA Item A ${Date.now()}`,
      slug: `qa-item-a-${Date.now()}`,
      sku: `SKU-QA-A-${Date.now()}`,
      description: 'QA Test Product A',
      shortDescription: 'QA desc',
      categoryId: cat.id,
      brandId: brand.id,
      priceCents: 5000,
      stockQuantity: 50,
      isActive: true,
    }
  });

  const apiBase = 'http://localhost:4000/api/v1';

  async function apiCall(endpoint, method = 'GET', body = null, token = tokenAdmin1) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${apiBase}${endpoint}`, opts);
    let raw;
    try {
      raw = await res.json();
    } catch {
      raw = null;
    }
    const data = (raw && typeof raw === 'object' && 'data' in raw && raw.data !== undefined) ? raw.data : raw;
    return { status: res.status, data, raw };
  }

  console.log("--- 1. Testing Admin Order Details & Financial Summary ---");
  // Create Order 1 with 10,000 cents paid via PayHere
  const order1 = await prisma.order.create({
    data: {
      orderNumber: `DSL-QA-ORD1-${Date.now().toString().slice(-4)}`,
      orderStatus: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.CARD_PAYHERE,
      customerName: 'QA Buyer One',
      customerEmail: 'buyer1@qa.dsl.lk',
      customerPhone: '+94771111111',
      totalCents: 10000,
      subtotalCents: 10000,
      items: {
        create: [{
          productId: prodA.id,
          productName: prodA.name,
          sku: prodA.sku,
          quantity: 2,
          unitPriceCents: 5000,
          totalPriceCents: 10000,
        }]
      }
    },
    include: { items: true }
  });

  // Create payment attempt for order 1
  const resv1 = await prisma.stockReservation.create({
    data: { sessionId: `sess-qa-1-${Date.now()}`, status: 'ACTIVE', expiresAt: new Date(Date.now() + 3600000) }
  });
  await prisma.paymentAttempt.create({
    data: {
      reservationId: resv1.id,
      orderId: order1.id,
      amountCents: 10000,
      currency: 'LKR',
      paymentMethod: PaymentMethod.CARD_PAYHERE,
      status: PaymentAttemptStatus.SUCCEEDED,
      gatewayReference: `PH-QA-GW-1-${Date.now()}`,
      idempotencyKey: `idem-qa-1-${Date.now()}`
    }
  });

  const getOrd1 = await apiCall(`/admin/orders/${order1.id}`, 'GET');
  console.log("Order 1 Fetch Status:", getOrd1.status);
  const ord1Payload = getOrd1.data?.data || getOrd1.data;
  console.log("Order 1 Financial Summary:", JSON.stringify(ord1Payload?.financialSummary, null, 2));
  results.push({
    test: "1. Admin order details and financial summary",
    pass: getOrd1.status === 200 &&
          ord1Payload?.financialSummary?.verifiedCollectedCents === 10000 &&
          ord1Payload?.financialSummary?.availableRefundBalanceCents === 10000 &&
          ord1Payload?.financialSummary?.reservedRefundsCents === 0 &&
          ord1Payload?.financialSummary?.completedRefundsCents === 0
  });

  console.log("\n--- 2. Testing Refund Creation & Segregation of Duties ---");
  // Admin 1 requests refund of 4000
  const reqRef = await apiCall(`/admin/orders/${order1.id}/refund`, 'POST', {
    amountCents: 4000,
    method: 'CARD_PAYHERE',
    reason: 'QA Refund Request by Admin 1',
    idempotencyKey: `idem-qa-ref-1-${Date.now()}`
  }, tokenAdmin1);
  console.log("Refund Request Status:", reqRef.status);
  const refundId = reqRef.data?.id;

  // Verify financial summary after request (balance reserved)
  const getOrd1AfterReq = await apiCall(`/admin/orders/${order1.id}`, 'GET');
  console.log("After Request Financial Summary:", JSON.stringify(getOrd1AfterReq.data.financialSummary, null, 2));

  // Admin 1 attempts self-approval -> must be 403 Forbidden
  const selfApprove = await apiCall(`/admin/orders/${order1.id}/refunds/${refundId}/approve`, 'POST', {}, tokenAdmin1);
  console.log("Self-Approval Attempt Status (Expected 403):", selfApprove.status, selfApprove.data?.message);

  // Admin 2 approves refund -> must succeed 200
  const admin2Approve = await apiCall(`/admin/orders/${order1.id}/refunds/${refundId}/approve`, 'POST', {}, tokenAdmin2);
  console.log("Admin 2 Approval Status (Expected 200):", admin2Approve.status);

  // Admin 1 attempts self-completion -> must be 403 Forbidden
  const selfComplete = await apiCall(`/admin/orders/${order1.id}/refunds/${refundId}/complete`, 'POST', {
    externalReference: 'EXT-QA-SELF'
  }, tokenAdmin1);
  console.log("Self-Completion Attempt Status (Expected 403):", selfComplete.status, selfComplete.data?.message);

  // Admin 2 moves to PROCESSING
  const processExec = await apiCall(`/admin/orders/${order1.id}/refunds/${refundId}/process`, 'POST', {}, tokenAdmin2);
  console.log("Process Execution Status (Expected 200):", processExec.status);

  // Admin 2 completes refund with external reference
  const admin2Complete = await apiCall(`/admin/orders/${order1.id}/refunds/${refundId}/complete`, 'POST', {
    externalReference: `PAYHERE-QA-COMPLETED-${Date.now()}`
  }, tokenAdmin2);
  console.log("Admin 2 Complete Status (Expected 200):", admin2Complete.status);

  // Verify financial summary after completion
  const getOrd1AfterComp = await apiCall(`/admin/orders/${order1.id}`, 'GET');
  const ord1AfterCompPayload = getOrd1AfterComp.data?.data || getOrd1AfterComp.data;
  console.log("After Completion Financial Summary:", JSON.stringify(ord1AfterCompPayload?.financialSummary, null, 2));

  results.push({
    test: "2. Refund creation, SoD enforcement, and complete lifecycle",
    pass: (reqRef.status === 200 || reqRef.status === 201) &&
          selfApprove.status === 403 &&
          admin2Approve.status === 200 &&
          selfComplete.status === 403 &&
          processExec.status === 200 &&
          admin2Complete.status === 200 &&
          ord1AfterCompPayload?.financialSummary?.completedRefundsCents === 4000 &&
          ord1AfterCompPayload?.financialSummary?.availableRefundBalanceCents === 6000
  });

  console.log("\n--- 3. Testing Refund Rejection, Failure & Reservation Release ---");
  // Request 3000 -> Reject
  const reqRef2 = await apiCall(`/admin/orders/${order1.id}/refund`, 'POST', {
    amountCents: 3000,
    method: 'CARD_PAYHERE',
    reason: 'To be rejected',
    idempotencyKey: `idem-qa-ref-2-${Date.now()}`
  }, tokenAdmin1);
  const ref2Id = reqRef2.data?.id;

  const rejectRef2 = await apiCall(`/admin/orders/${order1.id}/refunds/${ref2Id}/reject`, 'POST', {
    rejectionReason: 'Rejected per customer policy'
  }, tokenAdmin2);
  console.log("Reject Status:", rejectRef2.status);

  const getOrd1AfterReject = await apiCall(`/admin/orders/${order1.id}`, 'GET');
  console.log("After Rejection Available Balance (Expected 6000):", getOrd1AfterReject.data.financialSummary.availableRefundBalanceCents);

  // Request 2000 -> Approve -> Move to Processing -> Fail
  const reqRef3 = await apiCall(`/admin/orders/${order1.id}/refund`, 'POST', {
    amountCents: 2000,
    method: 'CARD_PAYHERE',
    reason: 'To be failed',
    idempotencyKey: `idem-qa-ref-3-${Date.now()}`
  }, tokenAdmin1);
  const ref3Id = reqRef3.data?.id;

  await apiCall(`/admin/orders/${order1.id}/refunds/${ref3Id}/approve`, 'POST', {}, tokenAdmin2);
  await apiCall(`/admin/orders/${order1.id}/refunds/${ref3Id}/process`, 'POST', {}, tokenAdmin2);
  const failRef3 = await apiCall(`/admin/orders/${order1.id}/refunds/${ref3Id}/fail`, 'POST', {
    failureReason: 'Payment gateway rejected refund request'
  }, tokenAdmin2);
  console.log("Fail Status:", failRef3.status);

  const getOrd1AfterFail = await apiCall(`/admin/orders/${order1.id}`, 'GET');
  console.log("After Failure Available Balance (Expected 6000):", getOrd1AfterFail.data.financialSummary.availableRefundBalanceCents);

  results.push({
    test: "3. Refund rejection and failure release balance reservation",
    pass: rejectRef2.status === 200 &&
          failRef3.status === 200 &&
          getOrd1AfterFail.data.financialSummary.availableRefundBalanceCents === 6000 &&
          getOrd1AfterFail.data.financialSummary.reservedRefundsCents === 0
  });

  console.log("\n--- 4. Testing Return Lifecycle & Linked Refund Item Progression ---");
  // Create Order 2 (DELIVERED, 2 units of prodA)
  const order2 = await prisma.order.create({
    data: {
      orderNumber: `DSL-QA-RET2-${Date.now().toString().slice(-4)}`,
      orderStatus: OrderStatus.DELIVERED,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.CARD_PAYHERE,
      customerName: 'QA Return Buyer',
      customerEmail: 'retbuyer@qa.dsl.lk',
      customerPhone: '+94772222222',
      totalCents: 10000,
      subtotalCents: 10000,
      items: {
        create: [{
          productId: prodA.id,
          productName: prodA.name,
          sku: prodA.sku,
          quantity: 2,
          unitPriceCents: 5000,
          totalPriceCents: 10000,
        }]
      }
    },
    include: { items: true }
  });

  const resv2 = await prisma.stockReservation.create({
    data: { sessionId: `sess-qa-2-${Date.now()}`, status: 'ACTIVE', expiresAt: new Date(Date.now() + 3600000) }
  });
  await prisma.paymentAttempt.create({
    data: {
      reservationId: resv2.id,
      orderId: order2.id,
      amountCents: 10000,
      currency: 'LKR',
      paymentMethod: PaymentMethod.CARD_PAYHERE,
      status: PaymentAttemptStatus.SUCCEEDED,
      gatewayReference: `PH-QA-GW-2-${Date.now()}`,
      idempotencyKey: `idem-qa-2-${Date.now()}`
    }
  });

  const initialStock = (await prisma.product.findUnique({ where: { id: prodA.id } })).stockQuantity;
  console.log("Initial Stock for ProdA before return restock:", initialStock);

  // Create Return for 1 item
  const createRet = await apiCall(`/admin/orders/${order2.id}/returns`, 'POST', {
    reason: 'Customer requested return: Defective item',
    items: [{
      orderItemId: order2.items[0].id,
      quantity: 1,
      reason: 'Defective item on delivery'
    }]
  }, tokenAdmin1);
  console.log("Create Return Status:", createRet.status);
  const returnId = createRet.data?.id;

  // Approve Return
  const approveRet = await apiCall(`/admin/orders/${order2.id}/returns/${returnId}/status`, 'PATCH', {
    action: 'APPROVE'
  }, tokenAdmin2);
  console.log("Approve Return Status:", approveRet.status);

  // Confirm Received with Restock
  const receiveRet = await apiCall(`/admin/orders/${order2.id}/returns/${returnId}/status`, 'PATCH', {
    action: 'CONFIRM_RECEIVED',
    restockItems: true
  }, tokenAdmin2);
  console.log("Confirm Received Status:", receiveRet.status);

  // Verify stock incremented by 1
  const stockAfterRestock = (await prisma.product.findUnique({ where: { id: prodA.id } })).stockQuantity;
  console.log("Stock after restock (Expected initial + 1):", stockAfterRestock, "Expected:", initialStock + 1);

  // Verify inventory movement record created
  const lastMovement = await prisma.inventoryMovement.findFirst({
    where: { productId: prodA.id },
    orderBy: { createdAt: 'desc' }
  });
  console.log("Inventory Movement Record:", lastMovement?.reason, "Change:", lastMovement?.changeAmount, "Prev:", lastMovement?.previousQuantity, "New:", lastMovement?.newQuantity);

  // Verify return items status is RECEIVED
  const returnItemsBeforeRefund = await prisma.orderReturnItem.findMany({ where: { returnRequestId: returnId } });
  console.log("Return Item Status before Refund (Expected RECEIVED):", returnItemsBeforeRefund[0]?.status);

  // Issue return-linked refund for 5000
  const reqRetRefund = await apiCall(`/admin/orders/${order2.id}/refund`, 'POST', {
    amountCents: 5000,
    method: 'CARD_PAYHERE',
    reason: 'Return linked refund for defective unit',
    orderReturnRequestId: returnId,
    idempotencyKey: `idem-qa-ret-ref-${Date.now()}`
  }, tokenAdmin1);
  console.log("Return Linked Refund Request Status:", reqRetRefund.status);
  const retRefundId = reqRetRefund.data?.id;

  // Verify return items status STILL RECEIVED while refund is REQUESTED/APPROVED
  await apiCall(`/admin/orders/${order2.id}/refunds/${retRefundId}/approve`, 'POST', {}, tokenAdmin2);
  await apiCall(`/admin/orders/${order2.id}/refunds/${retRefundId}/process`, 'POST', {}, tokenAdmin2);
  const returnItemsDuringRefund = await prisma.orderReturnItem.findMany({ where: { returnRequestId: returnId } });
  console.log("Return Item Status during Refund Processing (Expected RECEIVED):", returnItemsDuringRefund[0]?.status);

  // Complete refund -> return items MUST transition to REFUNDED
  const completeRetRefund = await apiCall(`/admin/orders/${order2.id}/refunds/${retRefundId}/complete`, 'POST', {
    externalReference: `PAYHERE-QA-RET-COMP-${Date.now()}`
  }, tokenAdmin2);
  console.log("Complete Return Refund Status:", completeRetRefund.status);

  const returnItemsAfterRefund = await prisma.orderReturnItem.findMany({ where: { returnRequestId: returnId } });
  console.log("Return Item Status AFTER Refund Complete (Expected REFUNDED):", returnItemsAfterRefund[0]?.status);

  results.push({
    test: "4. Return workflow, inventory restock, and progression to REFUNDED",
    pass: createRet.status === 201 &&
          approveRet.status === 200 &&
          receiveRet.status === 200 &&
          stockAfterRestock === initialStock + 1 &&
          lastMovement?.reason === InventoryChangeReason.RESTOCK &&
          returnItemsBeforeRefund[0]?.status === ReturnItemStatus.RECEIVED &&
          returnItemsDuringRefund[0]?.status === ReturnItemStatus.RECEIVED &&
          completeRetRefund.status === 200 &&
          returnItemsAfterRefund[0]?.status === ReturnItemStatus.REFUNDED
  });

  console.log("\n--- 5. Testing Blocked Payment Methods (COD, Koko, Unverified Bank) ---");
  // COD Order
  const codOrder = await prisma.order.create({
    data: {
      orderNumber: `DSL-QA-COD-${Date.now().toString().slice(-4)}`,
      orderStatus: OrderStatus.DELIVERED,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      customerName: 'QA COD Buyer',
      customerEmail: 'cod@qa.dsl.lk',
      customerPhone: '+94773333333',
      totalCents: 5000,
      subtotalCents: 5000,
      items: { create: [{ productId: prodA.id, productName: prodA.name, sku: prodA.sku, quantity: 1, unitPriceCents: 5000, totalPriceCents: 5000 }] }
    }
  });
  const codRefund = await apiCall(`/admin/orders/${codOrder.id}/refund`, 'POST', {
    amountCents: 2000,
    method: 'CASH_ON_DELIVERY',
    reason: 'COD refund attempt',
    idempotencyKey: `idem-cod-${Date.now()}`
  }, tokenAdmin1);
  console.log("COD Refund Attempt Status (Expected 400):", codRefund.status, codRefund.data?.message);

  // Koko BNPL Order
  const kokoOrder = await prisma.order.create({
    data: {
      orderNumber: `DSL-QA-KOKO-${Date.now().toString().slice(-4)}`,
      orderStatus: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.KOKO_BNPL,
      customerName: 'QA Koko Buyer',
      customerEmail: 'koko@qa.dsl.lk',
      customerPhone: '+94774444444',
      totalCents: 5000,
      subtotalCents: 5000,
      items: { create: [{ productId: prodA.id, productName: prodA.name, sku: prodA.sku, quantity: 1, unitPriceCents: 5000, totalPriceCents: 5000 }] }
    }
  });
  const kokoRefund = await apiCall(`/admin/orders/${kokoOrder.id}/refund`, 'POST', {
    amountCents: 2000,
    method: 'KOKO_BNPL',
    reason: 'Koko refund attempt',
    idempotencyKey: `idem-koko-${Date.now()}`
  }, tokenAdmin1);
  console.log("Koko Refund Attempt Status (Expected 400):", kokoRefund.status, kokoRefund.data?.message);

  // Unverified Bank Transfer Order
  const bankOrder = await prisma.order.create({
    data: {
      orderNumber: `DSL-QA-BANK-${Date.now().toString().slice(-4)}`,
      orderStatus: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      customerName: 'QA Bank Buyer',
      customerEmail: 'bank@qa.dsl.lk',
      customerPhone: '+94775555555',
      totalCents: 5000,
      subtotalCents: 5000,
      items: { create: [{ productId: prodA.id, productName: prodA.name, sku: prodA.sku, quantity: 1, unitPriceCents: 5000, totalPriceCents: 5000 }] }
    }
  });
  const bankRefund = await apiCall(`/admin/orders/${bankOrder.id}/refund`, 'POST', {
    amountCents: 2000,
    method: 'BANK_TRANSFER',
    reason: 'Bank transfer refund without deposit',
    idempotencyKey: `idem-bank-${Date.now()}`
  }, tokenAdmin1);
  console.log("Unverified Bank Transfer Refund Status (Expected 400):", bankRefund.status, bankRefund.data?.message);

  results.push({
    test: "5. Blocked payment methods (COD, Koko, Unverified Bank Transfer)",
    pass: codRefund.status === 400 &&
          kokoRefund.status === 400 &&
          bankRefund.status === 400
  });

  console.log("\n--- 6. Testing Financial Reconciliation API & Discrepancies ---");
  // Create an order with discrepancy: PAID_WITHOUT_COLLECTION
  const discOrder1 = await prisma.order.create({
    data: {
      orderNumber: `DSL-QA-DISC1-${Date.now().toString().slice(-4)}`,
      orderStatus: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.CARD_PAYHERE,
      customerName: 'QA Disc Buyer',
      customerEmail: 'disc1@qa.dsl.lk',
      customerPhone: '+94776666666',
      totalCents: 8000,
      subtotalCents: 8000,
      items: { create: [{ productId: prodA.id, productName: prodA.name, sku: prodA.sku, quantity: 1, unitPriceCents: 8000, totalPriceCents: 8000 }] }
    }
  });

  const reconSummary = await apiCall('/admin/orders/reconciliation/summary', 'GET');
  console.log("Reconciliation Summary:", JSON.stringify(reconSummary.data, null, 2));

  const reconList = await apiCall('/admin/orders/reconciliation?hasDiscrepancy=true', 'GET');
  console.log("Reconciliation Discrepancy Items Count:", reconList.data?.total || reconList.data?.items?.length);
  const foundDisc1 = reconList.data?.items?.find(it => it.orderId === discOrder1.id);
  console.log("Discrepancy for discOrder1:", foundDisc1?.discrepancies);

  results.push({
    test: "6. Financial reconciliation engine and discrepancy detection",
    pass: reconSummary.status === 200 &&
          reconList.status === 200 &&
          (reconSummary.data?.totalOrders >= 4) &&
          foundDisc1?.discrepancies?.some(d => d.includes('PAID_WITHOUT_COLLECTION'))
  });

  console.log("\n--- 7. Testing Direct API Authorization Guards ---");
  // Call without token -> 401 Unauthorized
  const noAuth = await apiCall(`/admin/orders/${order1.id}/refund`, 'POST', {
    amountCents: 1000,
    method: 'CARD_PAYHERE',
    reason: 'No auth test'
  }, null);
  console.log("No Token Status (Expected 401):", noAuth.status);

  // Call with Customer token -> 403 Forbidden
  let custUser = await prisma.user.findFirst({ where: { email: 'qa-customer@dsl.lk' } });
  if (!custUser) {
    custUser = await prisma.user.create({
      data: {
        email: 'qa-customer@dsl.lk',
        passwordHash: 'dummy',
        name: 'Charlie Customer',
        role: 'CUSTOMER',
        isActive: true
      }
    });
  }
  const custToken = generateAdminToken(custUser);
  const custAttempt = await apiCall(`/admin/orders/${order1.id}/refund`, 'POST', {
    amountCents: 1000,
    method: 'CARD_PAYHERE',
    reason: 'Customer attempt'
  }, custToken);
  console.log("Customer Token Status (Expected 403):", custAttempt.status);

  results.push({
    test: "7. Backend direct API authorization guards",
    pass: noAuth.status === 401 && custAttempt.status === 403
  });

  console.log("\n================================================================================");
  console.log("QA SUITE EXECUTION SUMMARY:");
  results.forEach((r, idx) => {
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.test}`);
  });
  const allPass = results.every(r => r.pass);
  console.log(`\nOVERALL STATUS: ${allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log("================================================================================\n");

  await prisma.$disconnect();
  await pool.end();

  return { allPass, results, order1Id: order1.id, order2Id: order2.id };
}

runQA().catch(err => {
  console.error("QA Execution Error:", err);
  process.exit(1);
});
