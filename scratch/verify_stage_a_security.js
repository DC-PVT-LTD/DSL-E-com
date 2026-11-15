require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

async function runTests() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log('=== DSL Stationery Stage A Security Verification ===\n');

  // Check 10: Protected Product Stock
  const protRes = await pool.query(
    'SELECT id, name, sku, "stockQuantity" FROM "Product" WHERE id = $1',
    ['cmw0j4cro00089kusmwsbv48t']
  );
  const protProd = protRes.rows[0];
  console.log('10. Protected product verification:');
  console.log(`    ID: ${protProd.id}, Name: ${protProd.name}, Stock: ${protProd.stockQuantity}`);
  if (protProd.stockQuantity !== 10) {
    throw new Error(`CRITICAL: Protected product stock is ${protProd.stockQuantity}, expected 10!`);
  }
  console.log('    [PASSED] Protected product stock is strictly 10.\n');

  // Verify StoreSettings in DB
  const setRes = await pool.query('SELECT * FROM "StoreSettings" WHERE id = $1', ['default']);
  const dbSettings = setRes.rows[0];
  console.log('StoreSettings status:');
  console.log(`    onlineCardEnabled: ${dbSettings.onlineCardEnabled}`);
  console.log(`    codEnabled: ${dbSettings.codEnabled}`);
  console.log(`    bankTransferEnabled: ${dbSettings.bankTransferEnabled}`);
  if (dbSettings.onlineCardEnabled !== false) {
    throw new Error('CRITICAL: onlineCardEnabled must remain false!');
  }
  console.log('    [PASSED] onlineCardEnabled is false.\n');

  // 1 & 2: Test Card Payment Validation Rejection
  console.log('1 & 2. Testing validate-pay with CARD_PAYHERE when onlineCardEnabled=false:');
  
  // Pick an isolated test product (NOT the protected product)
  const testProdRes = await pool.query(
    'SELECT id, name, "stockQuantity" FROM "Product" WHERE id != $1 AND "isActive" = true AND "stockQuantity" > 5 LIMIT 1',
    ['cmw0j4cro00089kusmwsbv48t']
  );
  const testProd = testProdRes.rows[0];
  console.log(`    Using isolated test product: ${testProd.id} (${testProd.name}), stock: ${testProd.stockQuantity}`);

  // Create temporary stock reservation
  const reservePayload = {
    items: [{ productId: testProd.id, quantity: 1 }],
  };
  const reserveRes = await fetch('http://localhost:4000/api/v1/checkout/reserve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reservePayload),
  });
  const reserveData = await reserveRes.json();
  const reservationId = reserveData.data.reservationId;
  console.log(`    Created temp reservation: ${reservationId}`);

  // Count payment attempts before validation
  const countAttemptsBefore = await pool.query(
    'SELECT count(*) FROM "PaymentAttempt" WHERE "reservationId" = $1',
    [reservationId]
  );

  // Attempt validate-pay with CARD_PAYHERE
  const valCardRes = await fetch('http://localhost:4000/api/v1/checkout/validate-pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reservationId,
      deliveryAddress: {
        fullName: 'Security Test Customer',
        phone: '0771234567',
        email: 'security@dslstationery.lk',
        addressLine1: 'No 1, Galle Road',
        city: 'Colombo',
        district: 'Colombo',
      },
      paymentMethod: 'CARD_PAYHERE',
    }),
  });
  const valCardData = await valCardRes.json();
  console.log(`    HTTP status: ${valCardRes.status}, Error message: "${valCardData.message}"`);
  if (valCardRes.status !== 400 || !valCardData.message?.toLowerCase().includes('card payment is currently disabled')) {
    throw new Error('Test 1 Failed: validate-pay did not reject CARD_PAYHERE with 400!');
  }
  console.log('    [PASSED] Test 1: CARD_PAYHERE validation rejected with HTTP 400.');

  // Check that no payment attempt was created
  const countAttemptsAfter = await pool.query(
    'SELECT count(*) FROM "PaymentAttempt" WHERE "reservationId" = $1',
    [reservationId]
  );
  if (parseInt(countAttemptsAfter.rows[0].count) !== parseInt(countAttemptsBefore.rows[0].count)) {
    throw new Error('Test 2 Failed: Payment attempt was created for rejected card validation!');
  }

  // Check reservation status was not modified to PAYMENT_PENDING
  const checkResStatus = await pool.query(
    'SELECT status FROM "StockReservation" WHERE id = $1',
    [reservationId]
  );
  if (checkResStatus.rows[0].status === 'PAYMENT_PENDING') {
    throw new Error('Test 2 Failed: Reservation status was changed to PAYMENT_PENDING!');
  }
  console.log('    [PASSED] Test 2: Rejected card validation did not reserve stock or create payment attempt.\n');

  // 3. Test Direct CARD_PAYHERE call to /checkout/pay
  console.log('3. Testing direct CARD_PAYHERE call to /checkout/pay:');
  const directPayRes = await fetch('http://localhost:4000/api/v1/checkout/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reservationId,
      deliveryAddress: {
        fullName: 'Attacker Attempting Free Goods',
        phone: '0779998888',
        email: 'attacker@example.com',
        addressLine1: 'Fake Street',
        city: 'Colombo',
        district: 'Colombo',
      },
      paymentMethod: 'CARD_PAYHERE',
      idempotencyKey: `direct-card-attack-${Date.now()}`,
    }),
  });
  const directPayData = await directPayRes.json();
  console.log(`    HTTP status: ${directPayRes.status}, Error message: "${directPayData.message}"`);
  if (directPayRes.status !== 400 || !directPayData.message?.includes('Direct card payment confirmation is not permitted')) {
    throw new Error('Test 3 Failed: Direct CARD_PAYHERE was not rejected by /checkout/pay!');
  }
  console.log('    [PASSED] Test 3: Direct CARD_PAYHERE calls to /checkout/pay are completely blocked.\n');

  // 4. Test COD checkout still works
  console.log('4. Testing COD checkout flow:');
  const valCodRes = await fetch('http://localhost:4000/api/v1/checkout/validate-pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reservationId,
      deliveryAddress: {
        fullName: 'Valid COD Customer',
        phone: '0771234567',
        email: 'cod-customer@dslstationery.lk',
        addressLine1: 'No 45, Temple Road',
        city: 'Nugegoda',
        district: 'Colombo',
      },
      paymentMethod: 'CASH_ON_DELIVERY',
    }),
  });
  const valCodData = await valCodRes.json();
  if (valCodRes.status !== 200 || !valCodData.data?.isValid) {
    throw new Error(`COD validation failed: ${valCodData.message}`);
  }
  console.log('    COD validate-pay succeeded.');

  const codIdempKey = `cod-test-${Date.now()}`;
  const payCodRes = await fetch('http://localhost:4000/api/v1/checkout/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reservationId,
      deliveryAddress: {
        fullName: 'Valid COD Customer',
        phone: '0771234567',
        email: 'cod-customer@dslstationery.lk',
        addressLine1: 'No 45, Temple Road',
        city: 'Nugegoda',
        district: 'Colombo',
      },
      paymentMethod: 'CASH_ON_DELIVERY',
      idempotencyKey: codIdempKey,
    }),
  });
  const payCodData = await payCodRes.json();
  if (payCodRes.status !== 200 || !payCodData.data?.order) {
    throw new Error(`COD processPayment failed: ${payCodData.message}`);
  }
  const codOrder = payCodData.data.order;
  console.log(`    Created COD Order Number: ${codOrder.orderNumber}`);
  console.log(`    Payment Status: ${codOrder.paymentStatus} (Must be PENDING for COD)`);
  console.log(`    Order Status: ${codOrder.orderStatus} (CONFIRMED)`);
  if (codOrder.paymentStatus !== 'PENDING' || codOrder.orderStatus !== 'CONFIRMED') {
    throw new Error('Test 4 Failed: COD Order did not have correct statuses!');
  }
  console.log('    [PASSED] Test 4: COD checkout works correctly and preserves PENDING payment status.\n');

  // Clean up created test COD order and restore test stock to leave DB clean
  await pool.query('DELETE FROM "OrderItem" WHERE "orderId" = $1', [codOrder.id]);
  await pool.query('DELETE FROM "OrderAddressSnapshot" WHERE "orderId" = $1', [codOrder.id]);
  await pool.query('DELETE FROM "PaymentAttempt" WHERE "idempotencyKey" = $1', [codIdempKey]);
  await pool.query('DELETE FROM "InventoryMovement" WHERE note LIKE $1', [`%${codOrder.orderNumber}%`]);
  await pool.query('DELETE FROM "Order" WHERE id = $1', [codOrder.id]);
  await pool.query('DELETE FROM "StockReservationItem" WHERE "reservationId" = $1', [reservationId]);
  await pool.query('DELETE FROM "StockReservation" WHERE id = $1', [reservationId]);
  await pool.query(
    'UPDATE "Product" SET "stockQuantity" = $1 WHERE id = $2',
    [testProd.stockQuantity, testProd.id]
  );
  console.log('    [CLEANED] Isolated test order and reservation cleaned up; test product stock restored.\n');

  // Verify protected product again after tests
  const finalProtRes = await pool.query(
    'SELECT "stockQuantity" FROM "Product" WHERE id = $1',
    ['cmw0j4cro00089kusmwsbv48t']
  );
  if (finalProtRes.rows[0].stockQuantity !== 10) {
    throw new Error('CRITICAL: Protected product stock altered!');
  }
  console.log('10. Final Verification: Protected product stock remains strictly 10.\n');

  console.log('=== All Live Backend API & DB Security Tests Passed Successfully ===');
  await pool.end();
}

runTests().catch(err => {
  console.error('\nFAILED WITH ERROR:', err);
  process.exit(1);
});

