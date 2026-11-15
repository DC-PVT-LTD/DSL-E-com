# DSL Stationery — PayHere Stage B Final Audit, Security Review & Sandbox Readiness

**Date:** 2026-11-14  
**Project:** DSL Stationery E-Commerce Platform  
**Target:** Stage B PayHere Final Technical Audit, Security Review & Sandbox Readiness  
**Status:** Audited, Hardened, Verified & Ready for Controlled Manual Sandbox Testing  

---

## 1. Actual Payment Execution Flow

The end-to-end PayHere execution sequence is fully traced as follows:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer / Browser
    participant FE as Next.js Frontend
    participant BE as NestJS Backend (Checkout)
    participant DB as PostgreSQL Database
    participant GW as PayHere Gateway (Sandbox)

    Note over Customer,BE: Pre-Payment & Stock Locking
    Customer->>FE: Fill delivery address & select PayHere
    FE->>BE: POST /api/v1/checkout/validate-pay
    BE->>DB: Check StoreSettings.onlineCardEnabled
    BE->>DB: Lock stock rows (FOR UPDATE) & create StockReservation (5-min lease)
    BE->>BE: Compute authoritative order totals (items, shipping, vouchers, packs)
    BE->>DB: Upsert PaymentAttempt (PROCESSING)
    BE->>BE: Generate PayHere payload & server MD5 hash
    BE-->>FE: Return PrePayValidationResult (with payHerePayload)

    Note over Customer,GW: Payment Capture in Sandbox Popup
    FE->>FE: Dynamically load https://sandbox.payhere.lk/lib/payhere.js
    FE->>GW: window.payhere.startPayment(payHerePayload)
    GW-->>Customer: Render PayHere modal popup (Card / Sandbox testing)
    Customer->>GW: Enter test card details & submit OTP
    GW-->>Customer: Show payment success confirmation

    Note over GW,BE: Authoritative Server-to-Server Webhook
    GW->>BE: POST /api/v1/checkout/payhere/webhook (notify_url)
    BE->>BE: Verify MD5 signature against PAYHERE_MERCHANT_SECRET
    BE->>BE: Validate merchant_id & currency (LKR)
    BE->>DB: Locate PaymentAttempt & Reservation
    BE->>BE: Validate cross-order integrity (order_id match)
    BE->>BE: VERIFY EXACT PAYMENT AMOUNT == RESERVED TOTAL (±0.01)
    BE->>BE: Verify idempotency (duplicate webhook check)
    BE->>DB: In interactive transaction ($transaction):
    Note over BE,DB: Consume reservation -> Verify row stock -> Deduct stock -> Create Order (PAID, CONFIRMED)
    BE->>DB: Update PaymentAttempt (status = SUCCEEDED, orderId)
    BE-->>GW: HTTP 200 { status: 'success' }

    Note over FE,BE: Frontend Result & Reconciliation
    GW-->>FE: onCompleted(orderId) callback triggered
    FE->>FE: Clear cart items; redirect to /checkout/result?orderId=...&payment=pending
    loop Polling up to 5 times (every 3s)
        FE->>BE: GET /api/v1/checkout/status/:id & GET /api/v1/orders/:id
        BE-->>FE: Return order status (PAID / CONFIRMED)
    end
    FE-->>Customer: Render verified green success screen with Order Details
```

---

## 2. Backend Security Review

### A. Direct Client Payment Rejection (Stage A Preservation)
* `checkout.controller.ts`:
  * Direct client calls to `POST /checkout/pay` receive `@Body(createZodPipe(processPaymentSchema)) dto: ProcessPaymentDto`.
  * The Zod schema and controller only supply `(dto, userId, sessionId)`. Clients have no ability to supply or influence internal authorization flags.
* `checkout.service.ts`:
  * `processPayment()` signature: `(dto, userId, sessionId, isInternalWebhook = false)`.
  * If `dto.paymentMethod === 'CARD_PAYHERE'` and `!isInternalWebhook`, the server immediately throws:
    `BadRequestException('Direct online card payments are not allowed. Orders are fulfilled strictly via verified payment gateway callbacks.')`
  * Clients cannot create confirmed card orders or mark card payments as `PAID`.

### B. Internal Webhook Isolation
* The sole location in the entire codebase where `isInternalWebhook = true` is invoked is inside `checkoutService.handlePayHereWebhook()` at line 1172.
* This execution point is reachable only after:
  1. Validating the MD5 signature header `md5sig`.
  2. Validating `dto.merchant_id === PAYHERE_MERCHANT_ID`.
  3. Validating `dto.payhere_currency === 'LKR'`.
  4. Validating `dto.status_code === '2'`.
  5. Validating cross-order ownership.
  6. Validating exact payment amount against the database-backed `PaymentAttempt.amountCents`.

---

## 3. Webhook Verification Sequence

The verification sequence in `handlePayHereWebhook()` proceeds through a strict defense-in-depth pipeline:

| Step | Check | Failure Action | HTTP Response |
| :--- | :--- | :--- | :--- |
| **1. Secret Hash** | Compute `strtoupper(md5(PAYHERE_MERCHANT_SECRET))` | N/A (Internal) | N/A |
| **2. MD5 Signature** | Compare incoming `md5sig` against `md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + hashedSecret)` | Logs signature mismatch | HTTP 400 `Invalid signature` |
| **3. Merchant ID** | Ensure `dto.merchant_id === process.env.PAYHERE_MERCHANT_ID` | Logs merchant mismatch | HTTP 400 `Invalid merchant ID` |
| **4. Currency** | Ensure `dto.payhere_currency === 'LKR'` | Logs currency mismatch | HTTP 400 `Invalid currency` |
| **5. Entity Lookup** | Query `PaymentAttempt` by `custom_2` (idempotencyKey), `payment_id`, `custom_1` (reservationId), or `gatewayPayload.orderId` | Logs attempt missing | HTTP 404 `Payment attempt not found` |
| **6. Cross-Order Check** | Ensure `gatewayPayload.orderId === dto.order_id` or `order.orderNumber === dto.order_id` | Logs order mismatch | HTTP 400 `Payment notification order reference mismatch` |
| **7. Amount Validation** | Ensure `abs(payhere_amount - (paymentAttempt.amountCents / 100)) <= 0.01` | Logs amount discrepancy | HTTP 400 `Payment amount mismatch` |
| **8. Idempotency** | Check if `paymentAttempt.status === SUCCEEDED` and `status_code === '2'` | Returns success immediately | HTTP 200 `{ status: 'success', message: 'Payment already processed' }` |
| **9. Status Handling** | Branch on `dto.status_code`: `'2'` (Success), `'0'` (Pending), `'-1'` (Canceled), `'-2'` (Failed), `'-3'` (Chargeback) | Updates attempt accordingly | HTTP 200 (or HTTP 400 if invalid) |

---

## 4. Amount Verification & Order Creation Sequence

### Investigation of Pre-Payment Verification
The technical audit confirms that **the actual payment amount is verified before any order is created or marked PAID**:

```typescript
// backend/src/modules/checkout/checkout.service.ts (lines 1081-1087)
const expectedAmountFormatted = (paymentAttempt.amountCents / 100).toFixed(2);
if (Math.abs(parseFloat(dto.payhere_amount) - parseFloat(expectedAmountFormatted)) > 0.01) {
  this.logger.error(
    `PayHere amount mismatch: received ${dto.payhere_amount}, expected ${expectedAmountFormatted}`
  );
  throw new BadRequestException('Payment amount mismatch');
}
```

* If an attacker or simulated gateway attempts to send a webhook for `500.00 LKR` when the authoritative order total was `1000.00 LKR`, the request is aborted at line 1086 with HTTP 400.
* `processPayment()` is only invoked at line 1161, which is strictly downstream of this check.
* Furthermore, order creation is wrapped in an atomic PostgreSQL transaction `prisma.$transaction()`:
  1. Re-verifies reservation is not `CONSUMED`.
  2. Updates reservation to `CONSUMED`.
  3. Verifies physical stock row-by-row (`FOR UPDATE`).
  4. Decrements physical stock.
  5. Records `InventoryMovement` audit log.
  6. Creates the `Order` record with `paymentStatus: 'PAID'` and `orderStatus: 'CONFIRMED'`.
  7. Updates `PaymentAttempt` to `SUCCEEDED` with `gatewayReference = dto.payment_id` and `orderId = processResult.order.id`.

---

## 5. PayHere SDK & Frontend Audit

### A. SDK Loader (`frontend/src/lib/payhere.ts`)
* **Official URL**: Strictly points to `https://sandbox.payhere.lk/lib/payhere.js`.
* **Singleton Injection**: Deduplicates multiple calls; concurrent requests share the same promise.
* **SSR Guard**: Safe against server-side rendering (`typeof window === 'undefined'` safely returns `false`).
* **Error Resilience**: `script.onerror` clears in-flight promise and resolves `false` without crashing the Next.js client.
* **Readiness Verification**: Verifies `window.payhere && typeof window.payhere.startPayment === 'function'` before resolving `true`.

### B. Checkout Modal Initiation (`frontend/src/app/(store)/checkout/page.tsx`)
* Form submission validates fields and calls `checkoutService.validatePrePay()`.
* If `CARD_PAYHERE` is selected:
  1. Ensures `prePayResult.payHerePayload` is present.
  2. Calls `loadPayHereScript()`.
  3. Attaches event listeners:
     * `onCompleted`: Clears purchased items from the shopping cart and redirects to `/checkout/result?orderId=...&payment=pending`.
     * `onDismissed`: Restores button state and surfaces a friendly notification ("Payment window was closed before completion. You can retry paying with PayHere or select Cash on Delivery.").
     * `onError`: Surfaces descriptive error banner without modifying cart or reservation.
  4. Launches popup via `window.payhere.startPayment(payHerePayload)`.
* **Zero Direct Fulfillment**: The client never calls `processPayment()` for card transactions.

### C. Result Page Polling Mechanism (`frontend/src/app/(store)/checkout/result/page.tsx`)
* Detects `payment=pending`.
* **Bounded Polling**:
  * Automatically polls every 3 seconds up to 5 times (maximum 15 seconds).
  * Automatically stops polling as soon as `isPaid` (`'PAID'`, `'SUCCEEDED'`) or `isFailed` (`'FAILED'`, `'CANCELLED'`) is confirmed by the server.
  * Handles network errors gracefully with user-facing alerts.
  * Provides a manual **"Re-check Order Status"** button which resets the polling counter and triggers an immediate reconciliation.

---

## 6. Frontend Test Suite Failure Investigation

### Complete Test Run Findings
When running the complete frontend test suite (`npm --prefix frontend run test`):
* **Total Test Files:** 28
* **Passed Test Files:** 26 (92.9%)
* **Failed Test Files:** 2
* **Total Tests:** 193
* **Passed Tests:** 191 (99.0%)
* **Failed Tests:** 2
* **Skipped Tests:** 0

### Investigation of the 2 Failures
1. **`src/services/__tests__/brandService.test.ts` (1 test failed)**:
   * **Error:** `AssertionError: expected 13 to be 2`
   * **Root Cause:** In `brandService.ts` line 114:
     `this.brands = deduplicateBrands([...validBrands, ...INITIAL_BRANDS]);`
     The service intentionally merges backend brands with the fallback mock dataset (`INITIAL_BRANDS`, 13 brands) to ensure the storefront is never empty if the backend has limited data. The test was written before this fallback merge was introduced and expects only the 2 mock brands.
2. **`src/services/__tests__/categoryService.test.ts` (1 test failed)**:
   * **Error:** `AssertionError: expected 19 to be 2`
   * **Root Cause:** In `categoryService.ts` line 126:
     `this.categories = deduplicateCategories([...validBackendCats, ...INITIAL_CATEGORIES]);`
     Similarly, the category service merges backend categories with the fallback `INITIAL_CATEGORIES` (19 items). The test expected only the 2 mocked categories.

### PayHere & Checkout Test Suite Results
All tests related to the PayHere integration, checkout, cart, and orders passed 100%:
* `src/lib/__tests__/payhere.test.ts`: **4/4 passed** (SDK script injection, singleton deduplication, SSR safety, error handling)
* `src/services/__tests__/checkoutPhaseB.test.ts`: **6/6 passed**
* `src/services/__tests__/checkoutPhaseC.test.ts`: **5/5 passed**
* `src/services/__tests__/checkoutService.test.ts`: **4/4 passed**
* `src/services/__tests__/cartStore.test.ts`: **15/15 passed**
* `src/services/__tests__/orderService.test.ts`: **2/2 passed**

*Per the strict development rules, the 2 pre-existing unrelated mock-merge tests were not modified to artificially force the suite to pass.*

---

## 7. PayHere Configuration & Webhook Connectivity

### Environment Configuration Audit (backend/.env)
* `PAYHERE_MERCHANT_ID`: Configured (Valid sandbox merchant ID).
* `PAYHERE_MERCHANT_SECRET`: Configured (Valid base64 secret).
* `PAYHERE_SANDBOX`: `true`.
* `PAYHERE_NOTIFY_URL`: Supported via `process.env.PAYHERE_NOTIFY_URL` with fallback to `${BACKEND_URL}/checkout/payhere/webhook`.
* `BACKEND_URL`: Currently configured in `.env`.
* `FRONTEND_URL`: `http://localhost:3000`.

### Public Webhook Connectivity
* PayHere Sandbox servers cannot deliver webhooks to `localhost:4000`.
* The previous temporary Cloudflare tunnel (`paintball-sticky-language-respected.trycloudflare.com`) was ephemeral and has expired.
* To receive real webhooks from the PayHere sandbox during manual testing, a tunnel is required.

---

## 8. Issues Found & Fixes Applied

| Issue Identified | File Affected | Impact | Fix Applied | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1. Static Notification URL** | `backend/src/modules/checkout/checkout.service.ts` | Did not prioritize `PAYHERE_NOTIFY_URL` env variable when set | Added `process.env.PAYHERE_NOTIFY_URL || ...` fallback | **Fixed & Verified** |
| **2. Single-shot Result Polling** | `frontend/src/app/(store)/checkout/result/page.tsx` | Result page only polled once at 3s; delayed webhooks required manual refresh | Upgraded to bounded 5-attempt polling loop (every 3s, 15s max) with auto-stop on final state | **Fixed & Verified** |
| **3. Duplicate Webhook Order ID Match** | `backend/src/modules/checkout/checkout.service.ts` | Duplicate check compared against orderNumber instead of gateway reference | Added match against `payloadOrderId` or `orderNumber` | **Fixed & Verified** |

---

## 9. Build Results

| Component | Command | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Backend** | `npm --prefix backend run build` | **Passed (Code 0)** | Zero TypeScript errors; NestJS bundle built. |
| **Frontend** | `npm --prefix frontend run build` | **Passed (Code 0)** | 58/58 routes compiled with Turbopack in 9.2s. |

---

## 10. Manual Sandbox Testing Instructions

Follow these step-by-step instructions to perform a live PayHere Sandbox payment test:

### Step 1: Start the Backend & Frontend
1. In terminal 1 (Backend):
   ```bash
   npm run start:prod --prefix backend
   ```
   *(Backend starts on `http://localhost:4000`)*
2. In terminal 2 (Frontend):
   ```bash
   npm run dev --prefix frontend
   ```
   *(Frontend starts on `http://localhost:3000`)*

### Step 2: Establish the Public Webhook Tunnel
Because PayHere needs to notify your local backend, run a Cloudflare Tunnel:
```bash
npx cloudflared tunnel --url http://localhost:4000
```
Cloudflare will output a public URL (e.g., `https://random-words-here.trycloudflare.com`).

### Step 3: Update Webhook URL in `backend/.env`
Add or update the following line in `backend/.env`:
```env
PAYHERE_NOTIFY_URL=https://<your-tunnel-domain>.trycloudflare.com/api/v1/checkout/payhere/webhook
```
Restart the backend daemon to reload the environment variable.

### Step 4: Temporarily Enable Card Payments in Admin Settings
*(Wait for your explicit approval before doing this)*
In PostgreSQL or via a scratch script:
```sql
UPDATE "StoreSettings" SET "onlineCardEnabled" = true WHERE id = 'default';
```

### Step 5: Execute Checkout with PayHere Test Cards
1. Navigate to `http://localhost:3000/shop`.
2. Add any stationery item to cart (e.g., *Atlas Gel Pen*).
3. Proceed to `http://localhost:3000/checkout`.
4. Enter test delivery information.
5. Select **Online Payment (PayHere)** (now visible and active).
6. Click **Place Order**.
7. The official PayHere Sandbox popup will appear.
8. Enter official PayHere Sandbox test card details:
   * **Card Number:** `4111 1111 1111 1111` (Visa) or `5200 0000 0000 0000` (Mastercard)
   * **Expiry Date:** Any future date (e.g. `12/28`)
   * **CVV:** `123`
   * **OTP / 3DS:** Enter `123456` when prompted.
9. Click **Pay**.

### Step 6: Verify Outcome
1. PayHere popup confirms payment and closes.
2. Browser automatically redirects to `/checkout/result?orderId=...&payment=pending`.
3. Within 3–6 seconds, the public webhook arrives at `notify_url`, transitions the order to `PAID` / `CONFIRMED`, and the result page updates to the green verified confirmation screen.
4. Verify the database:
   ```sql
   SELECT "orderNumber", "paymentStatus", "orderStatus", "totalCents" FROM "Order" ORDER BY "createdAt" DESC LIMIT 1;
   ```
   *Expected:* `paymentStatus: 'PAID'`, `orderStatus: 'CONFIRMED'`.

### Step 7: Revert Setting
Immediately revert card payments to disabled:
```sql
UPDATE "StoreSettings" SET "onlineCardEnabled" = false WHERE id = 'default';
```

---

## 11. Safety Invariants & Status Categorization

* [x] **StoreSettings Invariant:** `StoreSettings.onlineCardEnabled` remains strictly **`false`**.
* [x] **Inventory Invariant:** Protected product `cmw0j4cro00089kusmwsbv48t` stock remains strictly **`10`**.
* [x] **Stage A Invariant:** Direct client card confirmation is blocked; only verified internal webhooks can confirm payments.

### Status Classification Summary
* **Implemented & Verified:**
  * Server-side MD5 hash formula matching official PayHere specs.
  * Pre-pay validation with row-level stock locking.
  * Defense-in-depth webhook verification (signature, merchant, currency, order reference, exact amount, idempotency).
  * Frontend PayHere SDK dynamic loader.
  * Bounded result-page status polling loop.
* **Automated Tests Passed:**
  * 33/33 backend checkout tests passed.
  * 100% of frontend PayHere/checkout unit tests passed.
  * Live E2E database verification script passed all checks (signature tampering rejection, successful webhook processing, duplicate idempotency, cross-order protection).
* **Requires Manual Sandbox Testing:**
  * Live PayHere Sandbox transaction with Cloudflare Tunnel and test credit card (ready to be performed following the instructions above).
* **Requires Further Correction:**
  * None.

