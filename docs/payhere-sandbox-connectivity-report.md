# DSL Stationery — PayHere Sandbox Connectivity & First Transaction Preparation Report

**Date:** 2026-11-14  
**Project:** DSL Stationery E-Commerce Platform  
**Target:** PayHere Sandbox Connectivity Verification & First Transaction Preparation  
**Status:** Connectivity Established, Verified, and Ready for Controlled Manual Testing  

---

## 1. Exact Webhook Controller Route

Inspection of the NestJS application revealed the following routing architecture:
* **Global API Prefix:** `api/v1` (configured in `backend/src/main.ts` line 20 via `app.setGlobalPrefix('api/v1')`).
* **Controller Route Prefix:** `checkout` (configured in `backend/src/modules/checkout/checkout.controller.ts` line 33 via `@Controller('checkout')`).
* **Primary Webhook Method:** `@Post(['payhere/webhook', 'payhere/notify'])` (configured in `checkout.controller.ts` line 194).
* **Exact Internal Paths Registered:**
  1. `/api/v1/checkout/payhere/webhook` (Primary)
  2. `/api/v1/checkout/payhere/notify` (Alias)

Both paths are actively registered, allowing external notifications to reach the handler regardless of which URL convention is configured.

---

## 2. Correct Notification URL

* **Cloudflare Tunnel Domain:** `https://participants-furniture-ethics-threats.trycloudflare.com`
* **Full Public Webhook URL:**
  ```
  https://participants-furniture-ethics-threats.trycloudflare.com/api/v1/checkout/payhere/webhook
  ```
* **Environment Variable Configured:**
  * `PAYHERE_NOTIFY_URL` in `backend/.env` is set to the full public HTTPS URL.
  * `BACKEND_URL` in `backend/.env` is set to `https://participants-furniture-ethics-threats.trycloudflare.com/api/v1`.

---

## 3. Local Backend & Frontend Connectivity

| Service | Port | Endpoint Checked | Status | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Backend (NestJS)** | `4000` | `GET /api/v1/health` | **Healthy (HTTP 200)** | Database connected (latency: 31ms, products: 94, categories: 21) |
| **Backend (Settings)**| `4000` | `GET /api/v1/checkout/settings` | **Healthy (HTTP 200)** | `onlineCardEnabled: false`, `codEnabled: true`, `bankTransferEnabled: true` |
| **Frontend (Next.js)** | `3000` | `GET /` | **Healthy (HTTP 200)** | Storefront homepage rendered and responsive |

---

## 4. Cloudflare Tunnel Status

* **Binary:** `cloudflared` version 2026.11.0 (verified via `npx -y cloudflared --version`).
* **Tunnel Type:** Ephemeral Quick Tunnel (`trycloudflare.com`).
* **Command Executed:**
  ```bash
  npx -y cloudflared tunnel --url http://localhost:4000
  ```
* **Process Status:** Running as background daemon (Task ID `task-6024`).
* **Assigned Public URL:** `https://participants-furniture-ethics-threats.trycloudflare.com`
* **Transport Protocol:** QUIC / HTTP/2 with automated TLS termination.

---

## 5. Public Webhook Accessibility Verification

Live external requests sent through the Cloudflare Tunnel confirmed end-to-end connectivity from the public internet directly into the local NestJS server:

1. **Public Health Check:**
   ```bash
   curl.exe -s https://participants-furniture-ethics-threats.trycloudflare.com/api/v1/health
   # Returns: {"status":"healthy","service":"dsl-stationery-backend", ...}
   ```
2. **Public Webhook Endpoint (Payload Validation):**
   ```bash
   curl.exe -s -X POST https://participants-furniture-ethics-threats.trycloudflare.com/api/v1/checkout/payhere/webhook -d "merchant_id=123"
   # Returns: {"statusCode":400,"error":"BAD_REQUEST","message":"Validation failed", ... details: [{"field":"md5sig"}]}
   ```
3. **Public Notify Alias Endpoint:**
   ```bash
   curl.exe -s -X POST https://participants-furniture-ethics-threats.trycloudflare.com/api/v1/checkout/payhere/notify -d "merchant_id=123"
   # Returns: {"statusCode":400,"error":"BAD_REQUEST","message":"Validation failed", ... details: [{"field":"md5sig"}]}
   ```

Both `application/x-www-form-urlencoded` and `application/json` payloads are parsed and validated over HTTPS through the tunnel.

---

## 6. PayHere Sandbox Configuration Status

* **Sandbox Mode:** Active (`sandbox: true` in payload, `PAYHERE_SANDBOX=true`).
* **Merchant ID:** Configured in `backend/.env` (masked for security: `123****`).
* **Merchant Secret:** Configured in `backend/.env` (masked base64 secret).
* **Return URL:** `http://localhost:3000/checkout/result?orderId=${orderId}&payment=success`.
* **Cancel URL:** `http://localhost:3000/checkout?payment=cancelled`.
* **Notify URL:** `https://participants-furniture-ethics-threats.trycloudflare.com/api/v1/checkout/payhere/webhook`.
* **SDK URL:** `https://sandbox.payhere.lk/lib/payhere.js` (dynamically loaded via `frontend/src/lib/payhere.ts`).

### Manual Merchant Portal Verification (Action for You in Sandbox Portal)
Log into your [PayHere Sandbox Merchant Portal](https://sandbox.payhere.lk):
1. Navigate to **Integrations / Domain Whitelist**:
   * Verify whether domain whitelisting is enabled. By default, PayHere Sandbox allows notifications to any public HTTPS domain without restrictions. If domain whitelisting is enforced in your account, ensure `trycloudflare.com` is allowed.
2. Under **Account Settings / Credentials**:
   * Confirm that your Sandbox Merchant ID matches the ID configured in `backend/.env`.

---

## 7. Configuration Corrections Applied

1. **Route Dual-Mapping:**
   * Updated `checkout.controller.ts` line 194 to `@Post(['payhere/webhook', 'payhere/notify'])`. Both `/payhere/webhook` and `/payhere/notify` are now accepted.
2. **Dynamic Notification URL Priority:**
   * Updated `checkout.service.ts` line 536 to prioritize `process.env.PAYHERE_NOTIFY_URL` before falling back to `${BACKEND_URL}/checkout/payhere/webhook`.
3. **Environment Update:**
   * Updated `backend/.env` with the active Cloudflare Tunnel URL and restarted the backend service.

---

## 8. Checkout Readiness Checklist

| Requirement | Verified Behavior | Status |
| :--- | :--- | :--- |
| **1. Online Card Setting** | `StoreSettings.onlineCardEnabled` is `false` in PostgreSQL | **Verified** |
| **2. PayHere Hidden When Disabled** | Frontend hides PayHere option when setting is false; defaults to COD | **Verified** |
| **3. PayHere Available When Enabled** | Option renders with PayHere badge when setting is true | **Verified** |
| **4. COD Functional** | Cash on Delivery checkout works and creates orders | **Verified** |
| **5. Direct Card Bypass Blocked** | Client requests submitting `CARD_PAYHERE` rejected with HTTP 400 | **Verified** |
| **6. Webhook Signature Active** | MD5 signature verified against merchant secret; tampering rejected | **Verified** |
| **7. Pre-Order Amount Check** | Payment amount verified against reserved total before order creation | **Verified** |
| **8. Duplicate Idempotency** | Duplicate success webhooks return HTTP 200 without duplicate orders | **Verified** |
| **9. Cross-Order Protection** | Notifications referencing other orders rejected with HTTP 400 | **Verified** |
| **10. Failure Safety** | Cancelled or failed payments never mark orders PAID | **Verified** |

---

## 9. Manual Sandbox Payment Procedure (Ready for Your Execution)

When you are ready to perform the first live Sandbox transaction:

### Step 1: Temporarily Enable Card Payments in the Database
*(Requires your approval)*
Run this SQL query in PostgreSQL:
```sql
UPDATE "StoreSettings" SET "onlineCardEnabled" = true WHERE id = 'default';
```

### Step 2: Perform the Checkout in Browser
1. In your browser, open `http://localhost:3000/shop`.
2. Add any standard product to the cart (e.g. *Atlas Gel Pen*).
3. Open `http://localhost:3000/checkout`.
4. Fill in test customer details (Name, Phone: `+94771234567`, Email: your email).
5. Select **Online Payment (PayHere)**.
6. Click **Place Order**.
7. The official PayHere Sandbox modal will open.

### Step 3: Complete Payment with Official PayHere Test Card
In the PayHere popup:
* **Card Number:** `4111 1111 1111 1111` (Visa) or `5200 0000 0000 0000` (Mastercard)
* **Expiry Date:** Any future date (e.g. `12/28`)
* **CVV:** `123`
* **OTP / 3DS:** Enter `123456` when prompted.
* Click **Pay**.

### Step 4: Verify Order Outcome
1. The popup closes with a success message.
2. The browser automatically navigates to `/checkout/result?orderId=...&payment=pending`.
3. PayHere sends an asynchronous HTTPS POST webhook through the Cloudflare Tunnel to your backend.
4. The backend verifies the signature, amount, and stock, creates the order with `paymentStatus: 'PAID'`, and returns HTTP 200.
5. The result page polls, confirms the status change, and turns green: **"Thank you for choosing DSL Stationery! Your payment has been authoritatively verified."**

### Step 5: Verify in Database & Revert Setting
1. Query PostgreSQL:
   ```sql
   SELECT "orderNumber", "paymentStatus", "orderStatus", "totalCents" FROM "Order" ORDER BY "createdAt" DESC LIMIT 1;
   ```
   *Expected:* `paymentStatus: 'PAID'`, `orderStatus: 'CONFIRMED'`.
2. Immediately disable card payments again:
   ```sql
   UPDATE "StoreSettings" SET "onlineCardEnabled" = false WHERE id = 'default';
   ```

---

## 10. Status Categorization Summary

| Category | Status | Details |
| :--- | :--- | :--- |
| **Verified Connectivity** | **Completed** | Backend port 4000, Frontend port 3000, and Cloudflare Tunnel HTTPS live. |
| **Configuration Ready** | **Completed** | `PAYHERE_NOTIFY_URL` set, route aliases mapped, MD5 formula verified. |
| **Requires Manual Merchant-Portal Action** | **Optional Check** | Verify merchant ID matches sandbox account and domain whitelist is clear. |
| **Requires Your Approval** | **Pending** | Temporarily toggling `onlineCardEnabled = true` to perform the test. |
| **Actual Sandbox Transaction Completed** | **Pending** | Awaiting manual test in browser with test card. |

---

## 11. Safety Invariants Confirmed

* **`StoreSettings.onlineCardEnabled`**: Strictly **`false`** in the database.
* **Protected Product `cmw0j4cro00089kusmwsbv48t`**: Stock remains strictly **`10`**.
* **Zero Real Money / Zero Customer Data Risk**: All credentials point strictly to PayHere Sandbox.

