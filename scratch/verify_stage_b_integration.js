require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');
const crypto = require('crypto');

async function runStageBTests() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log('=== DSL Stationery Stage B PayHere Integration Verification ===\n');

  // Verify Baseline: Protected Product Stock
  const protRes = await pool.query(
    'SELECT id, name, sku, "stockQuantity" FROM "Product" WHERE id = $1',
    ['cmw0j4cro00089kusmwsbv48t']
  );
  console.log(`Protected product stock: ${protRes.rows[0].stockQuantity} (Must be exactly 10)`);
  if (protRes.rows[0].stockQuantity !== 10) {
    throw new Error('CRITICAL: Protected product stock is not 10!');
  }

  // Pick an isolated test product
  const testProdRes = await pool.query(
    'SELECT id, name, "priceCents", "stockQuantity" FROM "Product" WHERE id != $1 AND "isActive" = true AND "stockQuantity" > 5 LIMIT 1',
    ['cmw0j4cro00089kusmwsbv48t']
  );
  const testProd = testProdRes.rows[0];
  console.log(`Using isolated product: ${testProd.id} (${testProd.name}), price: ${testProd.priceCents}, stock: ${testProd.stockQuantity}`);

  // Test 1: Temporarily toggle onlineCardEnabled: true to test payload generation & webhook, then revert
  await pool.query('UPDATE "StoreSettings" SET "onlineCardEnabled" = true WHERE id = $1', ['default']);
  console.log('Temporarily set onlineCardEnabled = true for sandbox verification...');

  try {
    // 1. Create a reservation
    const reserveRes = await fetch('http://localhost:4000/api/v1/checkout/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: testProd.id, quantity: 1 }] }),
    });
    const reserveData = await reserveRes.json();
    const reservationId = reserveData.data.reservationId;
    console.log(`Created reservation: ${reservationId}`);

    // 2. Validate Pre-Pay with CARD_PAYHERE
    const prePayRes = await fetch('http://localhost:4000/api/v1/checkout/validate-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId,
        deliveryAddress: {
          fullName: 'Sandbox Tester',
          phone: '0771234567',
          email: 'sandbox@dslstationery.lk',
          addressLine1: 'No 100, High Level Rd',
          city: 'Nugegoda',
          district: 'Colombo',
        },
        paymentMethod: 'CARD_PAYHERE',
      }),
    });
    const prePayData = await prePayRes.json();
    if (!prePayData.success || !prePayData.data?.payHerePayload) {
      throw new Error(`Pre-pay validation failed: ${JSON.stringify(prePayData)}`);
    }

    const payload = prePayData.data.payHerePayload;
    console.log('\n1 & 2. Verified PayHere Payload generated:');
    console.log(`    merchant_id: ${payload.merchant_id}`);
    console.log(`    order_id: ${payload.order_id}`);
    console.log(`    amount: ${payload.amount} ${payload.currency}`);
    console.log(`    first_name: ${payload.first_name}, last_name: ${payload.last_name}`);
    console.log(`    notify_url: ${payload.notify_url}`);
    console.log(`    return_url: ${payload.return_url}`);
    console.log(`    cancel_url: ${payload.cancel_url}`);
    console.log(`    hash length: ${payload.hash?.length} chars`);

    // Verify hash formula: strtoupper(md5(merchant_id + order_id + amount + currency + strtoupper(md5(secret))))
    const secret = process.env.PAYHERE_MERCHANT_SECRET;
    const hashedSecret = crypto.createHash('md5').update(secret).digest('hex').toUpperCase();
    const expectedHash = crypto
      .createHash('md5')
      .update(`${payload.merchant_id}${payload.order_id}${payload.amount}${payload.currency}${hashedSecret}`)
      .digest('hex')
      .toUpperCase();

    if (payload.hash !== expectedHash) {
      throw new Error(`Hash mismatch! Generated: ${payload.hash}, Expected: ${expectedHash}`);
    }
    console.log('    [PASSED] Backend MD5 signature hash matches official PayHere formula perfectly.\n');

    // 3. Test Invalid Webhook Signature rejection
    console.log('5. Testing Invalid Webhook signature:');
    const badSigRes = await fetch('http://localhost:4000/api/v1/checkout/payhere/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: payload.merchant_id,
        order_id: payload.order_id,
        payment_id: 'sandbox-trans-999',
        payhere_amount: payload.amount,
        payhere_currency: payload.currency,
        status_code: '2',
        md5sig: 'BAD_HASH_ATTACK',
        custom_1: reservationId,
        custom_2: prePayData.data.idempotencyKey,
      }),
    });
    console.log(`    Status: ${badSigRes.status} (Expected 400)`);
    if (badSigRes.status !== 400) {
      throw new Error('Bad signature was not rejected with 400!');
    }
    console.log('    [PASSED] Invalid signature rejected.\n');

    // 4. Test Valid Webhook Success (status 2)
    console.log('6 & 7. Testing Valid Webhook Callback (status 2):');
    const validSig = crypto
      .createHash('md5')
      .update(`${payload.merchant_id}${payload.order_id}${payload.amount}${payload.currency}2${hashedSecret}`)
      .digest('hex')
      .toUpperCase();

    const goodWebhookRes = await fetch('http://localhost:4000/api/v1/checkout/payhere/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: payload.merchant_id,
        order_id: payload.order_id,
        payment_id: 'sandbox-pay-12345',
        payhere_amount: payload.amount,
        payhere_currency: payload.currency,
        status_code: '2',
        md5sig: validSig,
        custom_1: reservationId,
        custom_2: prePayData.data.idempotencyKey,
      }),
    });
    const goodWebhookData = await goodWebhookRes.json();
    console.log(`    Webhook HTTP status: ${goodWebhookRes.status}, response:`, goodWebhookData);
    if (goodWebhookRes.status !== 200 || !goodWebhookData.success) {
      throw new Error(`Valid webhook failed: ${JSON.stringify(goodWebhookData)}`);
    }

    // Verify created Order in DB by orderId returned in webhook response
    const orderRes = await pool.query(
      'SELECT id, "orderNumber", "paymentMethod", "paymentStatus", "orderStatus", "totalCents" FROM "Order" WHERE id = $1',
      [goodWebhookData.data.orderId]
    );
    if (orderRes.rowCount === 0) {
      throw new Error('Order was not created by webhook!');
    }
    const createdOrder = orderRes.rows[0];
    console.log(`    Created Order in DB: ID ${createdOrder.id}, Number ${createdOrder.orderNumber}`);
    console.log(`    Payment Method: ${createdOrder.paymentMethod} (CARD_PAYHERE)`);
    console.log(`    Payment Status: ${createdOrder.paymentStatus} (PAID)`);
    console.log(`    Order Status: ${createdOrder.orderStatus} (CONFIRMED)`);
    if (createdOrder.paymentStatus !== 'PAID' || createdOrder.orderStatus !== 'CONFIRMED') {
      throw new Error('Order paymentStatus is not PAID or orderStatus is not CONFIRMED!');
    }
    console.log('    [PASSED] Webhook transitioned order to PAID and CONFIRMED.\n');

    // 5. Test Webhook Idempotency on duplicate callback
    console.log('8. Testing Duplicate Webhook Idempotency:');
    const dupRes = await fetch('http://localhost:4000/api/v1/checkout/payhere/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: payload.merchant_id,
        order_id: payload.order_id,
        payment_id: 'sandbox-pay-12345',
        payhere_amount: payload.amount,
        payhere_currency: payload.currency,
        status_code: '2',
        md5sig: validSig,
        custom_1: reservationId,
        custom_2: prePayData.data.idempotencyKey,
      }),
    });
    const dupData = await dupRes.json();
    console.log(`    Duplicate status: ${dupRes.status}, message: "${dupData.data?.message}"`);
    if (dupData.data?.message !== 'Payment already processed') {
      throw new Error('Duplicate webhook was not handled idempotently!');
    }
    console.log('    [PASSED] Duplicate webhook successfully recognized and returned idempotent status without duplicate order.\n');

    // 6. Test Requirement 14: Payment notification for Order X cannot affect Order Y
    console.log('9. Testing Cross-Order Protection (Requirement 14):');
    const rogueSig = crypto
      .createHash('md5')
      .update(`${payload.merchant_id}DSL-ROGUE-ORDER${payload.amount}${payload.currency}2${hashedSecret}`)
      .digest('hex')
      .toUpperCase();

    const rogueRes = await fetch('http://localhost:4000/api/v1/checkout/payhere/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: payload.merchant_id,
        order_id: 'DSL-ROGUE-ORDER',
        payment_id: 'sandbox-rogue-pay',
        payhere_amount: payload.amount,
        payhere_currency: payload.currency,
        status_code: '2',
        md5sig: rogueSig,
        custom_1: reservationId,
        custom_2: prePayData.data.idempotencyKey,
      }),
    });
    const rogueData = await rogueRes.json();
    console.log(`    Status: ${rogueRes.status} (Expected 400), Message: "${rogueData.message}"`);
    if (rogueRes.status !== 400 || !rogueData.message?.includes('order reference mismatch')) {
      throw new Error('Cross-order webhook attempt was not rejected with 400 mismatch!');
    }
    console.log('    [PASSED] Cross-order notification strictly rejected.\n');

    // Clean up test order, attempts, and stock
    await pool.query('DELETE FROM "OrderItem" WHERE "orderId" = $1', [createdOrder.id]);
    await pool.query('DELETE FROM "OrderAddressSnapshot" WHERE "orderId" = $1', [createdOrder.id]);
    await pool.query('DELETE FROM "PaymentAttempt" WHERE "reservationId" = $1', [reservationId]);
    await pool.query('DELETE FROM "InventoryMovement" WHERE note LIKE $1', [`%${createdOrder.orderNumber}%`]);
    await pool.query('DELETE FROM "Order" WHERE id = $1', [createdOrder.id]);
    await pool.query('DELETE FROM "StockReservationItem" WHERE "reservationId" = $1', [reservationId]);
    await pool.query('DELETE FROM "StockReservation" WHERE id = $1', [reservationId]);
    await pool.query(
      'UPDATE "Product" SET "stockQuantity" = $1 WHERE id = $2',
      [testProd.stockQuantity, testProd.id]
    );
    console.log('[CLEANED] Sandbox test order, payment attempts, and reservation cleaned up.');

  } finally {
    // REVERT onlineCardEnabled back to false
    await pool.query('UPDATE "StoreSettings" SET "onlineCardEnabled" = false WHERE id = $1', ['default']);
    console.log('[REVERTED] onlineCardEnabled reverted strictly to false.');
  }

  // Final check on protected product
  const finalProt = await pool.query(
    'SELECT "stockQuantity" FROM "Product" WHERE id = $1',
    ['cmw0j4cro00089kusmwsbv48t']
  );
  if (finalProt.rows[0].stockQuantity !== 10) {
    throw new Error('CRITICAL: Protected product stock was altered!');
  }
  console.log(`\nFinal Protected Product Stock: ${finalProt.rows[0].stockQuantity} (strictly 10)`);

  // Final check on onlineCardEnabled
  const finalSettings = await pool.query('SELECT "onlineCardEnabled" FROM "StoreSettings" WHERE id = $1', ['default']);
  if (finalSettings.rows[0].onlineCardEnabled !== false) {
    throw new Error('CRITICAL: onlineCardEnabled is not false!');
  }
  console.log(`Final onlineCardEnabled setting: ${finalSettings.rows[0].onlineCardEnabled} (strictly false)`);

  console.log('\n=== All Stage B Integration Verifications Passed Successfully ===');
  await pool.end();
}

runStageBTests().catch(err => {
  console.error('\nFAILED STAGE B VERIFICATION:', err);
  process.exit(1);
});
