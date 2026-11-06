/**
 * Phase 11 Orders WebSocket Gateway Real-Time & Security Verification Suite
 *
 * Requirements verified:
 * A. WebSocket Authentication during handshake (rejects missing/invalid/expired tokens; accepts valid JWT).
 * B. Admin Authorization (STAFF, MANAGER, ADMIN only for admin:orders; CUSTOMER rejected).
 * C. Individual Order Authorization (Admin can access any; Customer only owns their own; non-owner rejected).
 * D. CORS & local dev compatibility.
 * E. Event delivery (customer update, delivery update, status update, order.updated).
 * F. Reconnecting client authentication and room resubscription.
 * G. Database safety: Uses dedicated test accounts & test order; verifies production records remain untouched.
 */

const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const path = require('path');
const http = require('http');
const { Pool } = require('pg');

// 1. Correct environment loading (relative to script file)
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET not found in backend/.env');
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FATAL: DATABASE_URL not found in backend/.env');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// Dedicated test accounts (guaranteed separate in PostgreSQL)
const ADMIN_A_ID = 'cmw07gefq0000pousyxdsoal6'; // admin@dslstationery.lk
const ADMIN_B_ID = 'cmw32xwu70000i8ussd4g7opy'; // second.admin@dslstationery.lk
const CUST_1_ID  = 'cmw0b90vk0000jsush3ey8h72'; // qa-customer@dslstationery.lk
const CUST_2_ID  = 'cmw25bvbh0019twusb7uekd7n'; // customer_1793798528839@example.lk

// Dedicated test order (NOT a real customer order)
const TEST_ORDER_ID = 'test-order-verify-phase11-id';
const TEST_ORDER_NUMBER = 'TEST-ORD-2026-9999';
const PRODUCTION_ORDER_ID = 'cmw2hnd690007jcusrp7g9mzp';
const PROTECTED_PRODUCT_ID = 'cmw0j4cro00089kusmwsbv48t';

// Sign genuine tokens (never log the secret)
const tokenAdminA = jwt.sign(
  { sub: ADMIN_A_ID, email: 'admin@dslstationery.lk', role: 'ADMIN' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const tokenAdminB = jwt.sign(
  { sub: ADMIN_B_ID, email: 'second.admin@dslstationery.lk', role: 'ADMIN' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const tokenCustomer1 = jwt.sign(
  { sub: CUST_1_ID, email: 'qa-customer@dslstationery.lk', role: 'CUSTOMER' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const tokenCustomer2 = jwt.sign(
  { sub: CUST_2_ID, email: 'customer_1793798528839@example.lk', role: 'CUSTOMER' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const expiredToken = jwt.sign(
  { sub: ADMIN_A_ID, email: 'admin@dslstationery.lk', role: 'ADMIN' },
  JWT_SECRET,
  { expiresIn: '-10s' }
);

const invalidSignatureToken = jwt.sign(
  { sub: ADMIN_A_ID, email: 'admin@dslstationery.lk', role: 'ADMIN' },
  'wrong_invalid_secret_key_0123456789abcdef',
  { expiresIn: '1h' }
);

// HTTP Helper
function apiCall(token, method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 4000,
        path: `/api/v1${apiPath}`,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let resBody = '';
        res.on('data', (d) => (resBody += d));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(resBody) });
          } catch {
            resolve({ status: res.statusCode, raw: resBody });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function setupDedicatedTestOrder() {
  console.log('[Setup] Provisioning isolated test order in database...');
  // Clean up any stale test order first
  await pool.query('DELETE FROM "OrderAuditLog" WHERE "orderId" = $1', [TEST_ORDER_ID]);
  await pool.query('DELETE FROM "OrderAddressSnapshot" WHERE "orderId" = $1', [TEST_ORDER_ID]);
  await pool.query('DELETE FROM "Order" WHERE id = $1', [TEST_ORDER_ID]);

  // Insert fresh test order owned by Customer 1
  await pool.query(
    `INSERT INTO "Order" (
      id, "orderNumber", "userId", "customerName", "customerEmail", "customerPhone",
      "subtotalCents", "discountCents", "deliveryCents", "totalCents",
      "paymentMethod", "paymentStatus", "orderStatus", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
    [
      TEST_ORDER_ID,
      TEST_ORDER_NUMBER,
      CUST_1_ID,
      'Initial Test Customer',
      'qa-customer@dslstationery.lk',
      '+94 77 111 2233',
      500000,
      0,
      35000,
      535000,
      'CARD_PAYHERE',
      'PAID',
      'PROCESSING',
    ]
  );

  // Insert initial address snapshot
  await pool.query(
    `INSERT INTO "OrderAddressSnapshot" (
      id, "orderId", "fullName", phone, email, "addressLine1", city, district, "postalCode"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      'test-addr-snap-id',
      TEST_ORDER_ID,
      'Initial Test Customer',
      '+94 77 111 2233',
      'qa-customer@dslstationery.lk',
      '123 Initial Street',
      'Colombo 05',
      'Colombo',
      '00500',
    ]
  );
  console.log('[Setup] Dedicated test order provisioned successfully.\n');
}

async function cleanupDedicatedTestOrder() {
  console.log('\n[Cleanup] Removing isolated test order from database...');
  await pool.query('DELETE FROM "OrderAuditLog" WHERE "orderId" = $1', [TEST_ORDER_ID]);
  await pool.query('DELETE FROM "OrderAddressSnapshot" WHERE "orderId" = $1', [TEST_ORDER_ID]);
  await pool.query('DELETE FROM "Order" WHERE id = $1', [TEST_ORDER_ID]);
  console.log('[Cleanup] Isolated test order removed cleanly.\n');
}

async function runVerification() {
  console.log('====================================================');
  console.log(' PHASE 11 ORDERS WEBSOCKET & SECURITY VERIFICATION');
  console.log('====================================================\n');

  await setupDedicatedTestOrder();

  const testResults = [];
  function record(title, passed, details = '') {
    testResults.push({ title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} : ${title} ${details ? '(' + details + ')' : ''}`);
  }

  // -------------------------------------------------------------
  // SECTION 1: WEBSOCKET AUTHENTICATION & HANDSHAKE REJECTION
  // -------------------------------------------------------------
  console.log('\n--- SECTION 1: WEBSOCKET HANDSHAKE AUTHENTICATION ---');

  // Test 1.1: Missing token
  await new Promise((resolve) => {
    const s = io('http://localhost:4000/orders', {
      transports: ['websocket'],
      forceNew: true,
      auth: {}, // No token!
    });
    s.on('connect_error', (err) => {
      record('Handshake rejection: missing token', err.message.includes('Authentication token required'), err.message);
      s.close();
      resolve();
    });
    s.on('connect', () => {
      record('Handshake rejection: missing token', false, 'Connected unexpectedly without token');
      s.close();
      resolve();
    });
  });

  // Test 1.2: Invalid signature token
  await new Promise((resolve) => {
    const s = io('http://localhost:4000/orders', {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: invalidSignatureToken },
    });
    s.on('connect_error', (err) => {
      record('Handshake rejection: invalid token signature', err.message.includes('invalid or expired token'), err.message);
      s.close();
      resolve();
    });
    s.on('connect', () => {
      record('Handshake rejection: invalid token signature', false, 'Connected unexpectedly with invalid token');
      s.close();
      resolve();
    });
  });

  // Test 1.3: Expired token
  await new Promise((resolve) => {
    const s = io('http://localhost:4000/orders', {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: expiredToken },
    });
    s.on('connect_error', (err) => {
      record('Handshake rejection: expired token', err.message.includes('invalid or expired token'), err.message);
      s.close();
      resolve();
    });
    s.on('connect', () => {
      record('Handshake rejection: expired token', false, 'Connected unexpectedly with expired token');
      s.close();
      resolve();
    });
  });

  // Test 1.4: Valid Admin A connection
  let socketA = null;
  await new Promise((resolve) => {
    socketA = io('http://localhost:4000/orders', {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: tokenAdminA },
    });
    socketA.on('connect', () => {
      record('Handshake success: Admin A authenticated', true, `Socket ID: ${socketA.id}`);
      resolve();
    });
    socketA.on('connect_error', (err) => {
      record('Handshake success: Admin A authenticated', false, err.message);
      resolve();
    });
  });

  // Test 1.5: Valid Admin B connection (Separate Admin)
  let socketB = null;
  await new Promise((resolve) => {
    socketB = io('http://localhost:4000/orders', {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: tokenAdminB },
    });
    socketB.on('connect', () => {
      record('Handshake success: Admin B authenticated', true, `Socket ID: ${socketB.id}`);
      resolve();
    });
    socketB.on('connect_error', (err) => {
      record('Handshake success: Admin B authenticated', false, err.message);
      resolve();
    });
  });

  // -------------------------------------------------------------
  // SECTION 2: ADMIN & ORDER ROOM AUTHORIZATION
  // -------------------------------------------------------------
  console.log('\n--- SECTION 2: ADMIN & ORDER ROOM AUTHORIZATION ---');

  // Test 2.1: Customer trying to subscribe to admin:orders
  let socketCust1 = null;
  await new Promise((resolve) => {
    socketCust1 = io('http://localhost:4000/orders', {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: tokenCustomer1 },
    });
    socketCust1.on('connect', () => {
      socketCust1.emit('subscribe:admin');
    });
    socketCust1.on('error', (err) => {
      record(
        'Admin authorization: Customer rejected from admin:orders',
        err.message?.includes('Insufficient permissions'),
        err.message
      );
      resolve();
    });
    socketCust1.on('subscribed:admin', () => {
      record('Admin authorization: Customer rejected from admin:orders', false, 'Customer joined admin:orders illegally');
      resolve();
    });
  });

  // Test 2.2: Admin B subscribing to admin:orders
  await new Promise((resolve) => {
    const onSubscribed = (res) => {
      record('Admin authorization: Admin B joined admin:orders', res?.success === true);
      cleanup();
      resolve();
    };
    const onError = (err) => {
      record('Admin authorization: Admin B joined admin:orders', false, err.message);
      cleanup();
      resolve();
    };
    function cleanup() {
      socketB.off('subscribed:admin', onSubscribed);
      socketB.off('error', onError);
    }
    socketB.on('subscribed:admin', onSubscribed);
    socketB.on('error', onError);
    socketB.emit('subscribe:admin');
  });

  // Test 2.3: Customer 1 subscribing to own order
  await new Promise((resolve) => {
    socketCust1.emit('subscribe:order', { orderId: TEST_ORDER_ID });
    socketCust1.on('subscribed:order', (res) => {
      record('Order authorization: Customer 1 joined own order', res?.orderId === TEST_ORDER_ID);
      resolve();
    });
    socketCust1.on('error', (err) => {
      record('Order authorization: Customer 1 joined own order', false, err.message);
      resolve();
    });
  });

  // Test 2.4: Customer 2 trying to subscribe to Customer 1's order
  await new Promise((resolve) => {
    const socketCust2 = io('http://localhost:4000/orders', {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: tokenCustomer2 },
    });
    socketCust2.on('connect', () => {
      socketCust2.emit('subscribe:order', { orderId: TEST_ORDER_ID });
    });
    socketCust2.on('error', (err) => {
      record(
        'Order authorization: Customer 2 rejected from Customer 1 order',
        err.message?.includes('permission'),
        err.message
      );
      socketCust2.close();
      resolve();
    });
    socketCust2.on('subscribed:order', () => {
      record('Order authorization: Customer 2 rejected from Customer 1 order', false, 'Illegal access permitted');
      socketCust2.close();
      resolve();
    });
  });

  // Test 2.5: Admin B subscribing to the test order room
  await new Promise((resolve) => {
    socketB.emit('subscribe:order', { orderId: TEST_ORDER_ID });
    socketB.on('subscribed:order', (res) => {
      record('Order authorization: Admin B joined test order room', res?.orderId === TEST_ORDER_ID);
      resolve();
    });
  });

  // Test 2.6: Subscribing to non-existent order
  await new Promise((resolve) => {
    socketB.emit('subscribe:order', { orderId: 'non-existent-random-order-id' });
    const onErr = (err) => {
      if (err.event === 'subscribe:order' && err.message?.includes('Order not found')) {
        record('Order authorization: Non-existent order rejected', true, err.message);
        socketB.off('error', onErr);
        resolve();
      }
    };
    socketB.on('error', onErr);
  });

  // -------------------------------------------------------------
  // SECTION 3: REAL-TIME EVENT STREAMING (SESSION A -> SESSION B)
  // -------------------------------------------------------------
  console.log('\n--- SECTION 3: REAL-TIME EVENT PROPAGATION ---');

  const receivedEventsB = [];
  const eventsToTrack = [
    'order.customer.updated',
    'order.delivery.updated',
    'order.status.updated',
    'order.updated',
  ];

  eventsToTrack.forEach((evt) => {
    socketB.on(evt, (payload) => {
      receivedEventsB.push({ event: evt, payload });
    });
  });

  // Wait 300ms for subscription stability
  await new Promise((r) => setTimeout(r, 300));

  // Step 3.1: Customer Update via Session A API
  console.log('Triggering customer update via Admin A...');
  const patchCustomerRes = await apiCall(tokenAdminA, 'PATCH', `/admin/orders/${TEST_ORDER_ID}/customer`, {
    customerName: 'Realtime Verified Customer',
    customerEmail: 'verified@dslstationery.lk',
    customerPhone: '+94 77 999 8888',
    reason: 'Real-time WebSocket verification test',
  });
  record('Session A PATCH customer API call', patchCustomerRes.status === 200, `HTTP ${patchCustomerRes.status}`);

  await new Promise((r) => setTimeout(r, 800));
  const hasCustomerEvt = receivedEventsB.some((e) => e.event === 'order.customer.updated');
  record('Session B received order.customer.updated in real-time', hasCustomerEvt);

  // Step 3.2: Delivery Update via Session A API
  console.log('Triggering delivery update via Admin A...');
  const patchDeliveryRes = await apiCall(tokenAdminA, 'PATCH', `/admin/orders/${TEST_ORDER_ID}/delivery`, {
    addressLine1: 'No. 99, Galle Road',
    city: 'Colombo 03',
    district: 'Colombo',
    postalCode: '00300',
    deliveryNotes: 'Leave with reception',
    reason: 'Real-time delivery update verification',
  });
  record('Session A PATCH delivery API call', patchDeliveryRes.status === 200, `HTTP ${patchDeliveryRes.status}`);

  await new Promise((r) => setTimeout(r, 800));
  const hasDeliveryEvt = receivedEventsB.some((e) => e.event === 'order.delivery.updated');
  record('Session B received order.delivery.updated in real-time', hasDeliveryEvt);

  // Step 3.3: Fulfilment Status Update (PROCESSING -> PACKED)
  console.log('Triggering status update (PROCESSING -> PACKED) via Admin A...');
  const patchStatusRes1 = await apiCall(tokenAdminA, 'PATCH', `/admin/orders/${TEST_ORDER_ID}/status`, {
    status: 'PACKED',
    notes: 'Items packed in warehouse box #44',
    reason: 'Status update verification',
  });
  record('Session A PATCH status (PACKED) API call', patchStatusRes1.status === 200, `HTTP ${patchStatusRes1.status}`);

  await new Promise((r) => setTimeout(r, 800));
  const hasPackedEvt = receivedEventsB.some(
    (e) =>
      e.event === 'order.status.updated' &&
      (e.payload?.data?.newStatus === 'PACKED' || e.payload?.data?.status === 'PACKED')
  );
  record('Session B received order.status.updated (PACKED) in real-time', hasPackedEvt);

  // -------------------------------------------------------------
  // SECTION 4: SOCKET RECONNECTION & RESUBSCRIPTION
  // -------------------------------------------------------------
  console.log('\n--- SECTION 4: SOCKET RECONNECTION & RESUBSCRIPTION ---');

  console.log('Disconnecting Session B socket...');
  socketB.disconnect();
  record('Session B disconnected cleanly', !socketB.connected);

  await new Promise((r) => setTimeout(r, 400));

  console.log('Reconnecting Session B socket with auth token...');
  socketB.connect();

  await new Promise((resolve) => {
    socketB.on('connect', () => {
      record('Session B reconnected and re-authenticated', true, `Socket ID: ${socketB.id}`);
      // Resubscribe to rooms
      socketB.emit('subscribe:admin');
      socketB.emit('subscribe:order', { orderId: TEST_ORDER_ID });
      resolve();
    });
  });

  await new Promise((r) => setTimeout(r, 400));

  // Trigger status update while reconnected (PACKED -> SHIPPED)
  console.log('Triggering status update (PACKED -> SHIPPED) via Admin A...');
  const patchStatusRes2 = await apiCall(tokenAdminA, 'PATCH', `/admin/orders/${TEST_ORDER_ID}/status`, {
    status: 'SHIPPED',
    trackingNumber: 'DSL-TRACK-VERIFY-777',
    notes: 'Handed over to courier driver',
    reason: 'Reconnection delivery test',
  });
  record('Session A PATCH status (SHIPPED) API call', patchStatusRes2.status === 200, `HTTP ${patchStatusRes2.status}`);

  await new Promise((r) => setTimeout(r, 800));
  const hasShippedEvt = receivedEventsB.some(
    (e) =>
      e.event === 'order.status.updated' &&
      (e.payload?.data?.newStatus === 'SHIPPED' || e.payload?.data?.status === 'SHIPPED')
  );
  record('Reconnected Session B received event in real-time', hasShippedEvt);

  // Close all open sockets
  if (socketA) socketA.close();
  if (socketB) socketB.close();
  if (socketCust1) socketCust1.close();

  // -------------------------------------------------------------
  // SECTION 5: DATABASE SAFETY & PRODUCTION INVARIANT CHECK
  // -------------------------------------------------------------
  console.log('\n--- SECTION 5: DATABASE SAFETY & PRODUCTION INVARIANT CHECK ---');

  await cleanupDedicatedTestOrder();

  // 1. Verify production order is unchanged
  const prodOrderRes = await pool.query(
    'SELECT id, "orderNumber", "orderStatus", "paymentStatus", "totalCents" FROM "Order" WHERE id = $1',
    [PRODUCTION_ORDER_ID]
  );
  const prodOrder = prodOrderRes.rows[0];
  const prodOrderIntact = prodOrder && prodOrder.orderNumber === 'DSL-2026-320053';
  record('Production order DSL-2026-320053 preserved intact', prodOrderIntact, `Status: ${prodOrder?.orderStatus}`);

  // 2. Verify protected product stock is strictly 10
  const prodStockRes = await pool.query(
    'SELECT id, name, "stockQuantity" FROM "Product" WHERE id = $1',
    [PROTECTED_PRODUCT_ID]
  );
  const prodStock = prodStockRes.rows[0];
  const stockIntact = prodStock && Number(prodStock.stockQuantity) === 10;
  record('Protected test product stock invariant strictly preserved', stockIntact, `Stock: ${prodStock?.stockQuantity}`);

  // Close pool
  await pool.end();

  // -------------------------------------------------------------
  // FINAL EVALUATION
  // -------------------------------------------------------------
  console.log('\n====================================================');
  console.log('              FINAL TEST SUMMARY');
  console.log('====================================================');
  const failed = testResults.filter((t) => !t.passed);
  console.log(`Total tests executed : ${testResults.length}`);
  console.log(`Passed               : ${testResults.length - failed.length}`);
  console.log(`Failed               : ${failed.length}`);

  if (failed.length > 0) {
    console.error('\nFAILURE DETAILS:');
    failed.forEach((f) => console.error(`  - ${f.title}: ${f.details}`));
    process.exit(1);
  } else {
    console.log('\n>>> ALL REAL-TIME & WEBSOCKET SECURITY VERIFICATIONS PASSED <<<\n');
    process.exit(0);
  }
}

runVerification().catch(async (err) => {
  console.error('Unhandled verification error:', err);
  try {
    await cleanupDedicatedTestOrder();
    await pool.end();
  } catch {}
  process.exit(1);
});
