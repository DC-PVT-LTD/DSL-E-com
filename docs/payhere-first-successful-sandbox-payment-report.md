# DSL Stationery — PayHere Sandbox First Successful Payment Verification Report

**Document Date:** November 14, 2026  
**Status:** Transaction Verified & Confirmed  
**Payment Reference / Gateway ID:** `320032688533`  
**Order Number:** `DSL-2026-731398`  
**Total Amount:** LKR 13,000.00  

---

## 1. Executive Summary: PayHere Approval vs. Backend Confirmation

This transaction marks the **first end-to-end successful PayHere Sandbox payment** for DSL Stationery.

It is critical to distinguish between **PayHere Gateway Approval** and **Authoritative Backend Order Confirmation**:

| Stage | Subsystem | Evidence | Result |
| :--- | :--- | :--- | :--- |
| **Stage 1: Gateway Approval** | PayHere Sandbox (`sandbox.payhere.lk`) | Popup displayed "Payment Approved", Payment ID `320032688533` | The payment was approved by PayHere simulator. (Client-side display alone does NOT confirm the order). |
| **Stage 2: Server-to-Server Webhook** | Cloudflare Tunnel -> NestJS Backend | `POST /api/v1/checkout/payhere/webhook` (200 OK, 344ms) | PayHere's server asynchronously delivered signed notification to backend. |
| **Stage 3: Cryptographic Verification** | Backend `CheckoutService` | `PayHere webhook verified for order DSL-1794637065477, status=2` | Server validated MD5 signature using Merchant Secret, verified Merchant ID `1239105`, amount `13000.00`, and currency `LKR`. |
| **Stage 4: Authoritative Order Creation** | PostgreSQL Database Transaction | Order `DSL-2026-731398` created, `paymentStatus: PAID`, `orderStatus: CONFIRMED` | **Only upon valid webhook verification** was the order created, payment marked `SUCCEEDED`, and stock permanently allocated. |
| **Stage 5: Customer Notification** | `NotificationsService` via Nodemailer | Email dispatched to `admin@dslstationery.lk` | Order confirmation email was sent with itemized summary. |

---

## 2. Webhook & Backend Log Verification

Backend logs from daemon process (`task-6062.log`) confirm the exact sequence:

1. **Pre-Payment Initialization (`11:47:45 AM`):**
   ```
   [Nest] 23564 - 11/14/2026, 11:47:45 AM LOG [HTTP] POST /api/v1/checkout/validate-pay 200 - 235ms [IP: ::1]
   ```
   - Created in-flight `PaymentAttempt` `cmwg0km4n001p6kusml717t0g` with idempotency key `pay-cmwg0k98m001n6kusfzlk77m1-1794637065477`.
   - Assigned gateway order ID: `DSL-1794637065477`.

2. **Server-to-Server Webhook Delivery & Verification (`11:48:12 AM`):**
   ```
   [Nest] 23564 - 11/14/2026, 11:48:12 AM LOG [CheckoutService] PayHere webhook verified for order DSL-1794637065477, status=2
   [Nest] 23564 - 11/14/2026, 11:48:13 AM LOG [HTTP] POST /api/v1/checkout/payhere/webhook 200 - 344ms [IP: ::1] [UA: PayHere-HttpClient/5.6.99]
   ```
   - PayHere delivered the notification via `User-Agent: PayHere-HttpClient/5.6.99`.
   - Backend calculated MD5 hash from `merchant_id + order_id + payhere_amount + payhere_currency + status_code + md5(merchant_secret)`.
   - Signature matched perfectly. Webhook returned HTTP 200 to acknowledge delivery.

3. **Inventory & Order Event Dispatch (`11:48:13 AM`):**
   ```
   [Nest] 23564 - 11/14/2026, 11:48:13 AM LOG [InventoryGateway] [WS Broadcast] Product prod-dsl-107: Physical=90, Reserved=0, Available=90
   [Nest] 23564 - 11/14/2026, 11:48:13 AM LOG [NotificationsService] [ORDER NOTIFICATION] Order DSL-2026-731398 confirmed for System Administrator (admin@dslstationery.lk). Total: LKR 13000.00. Payment: CARD_PAYHERE (PAID)
   [Nest] 23564 - 11/14/2026, 11:48:13 AM LOG [NotificationsService] [PAYMENT NOTIFICATION] Payment SUCCESS for admin@dslstationery.lk (Amount: LKR 13000.00, Ref: 320032688533, Reason: None)
   [Nest] 23564 - 11/14/2026, 11:48:17 AM LOG [NotificationsService] [EMAIL DISPATCHED] To: admin@dslstationery.lk | Subject: "Order #DSL-2026-731398 Confirmation - DSL Stationery"
   ```

---

## 3. Database State Audit (PostgreSQL)

Direct SQL queries on PostgreSQL verify the exact records:

### A. Payment Attempt Record
| Field | Value | Verification |
| :--- | :--- | :--- |
| `id` | `cmwg0km4n001p6kusml717t0g` | Unique cuid |
| `status` | `SUCCEEDED` | **PASS** — Transitioned from `PROCESSING` to `SUCCEEDED` |
| `amountCents` | `1300000` | **PASS** — Exactly LKR 13,000.00 |
| `currency` | `LKR` | **PASS** |
| `paymentMethod` | `CARD_PAYHERE` | **PASS** |
| `gatewayReference` | `320032688533` | **PASS** — Matches PayHere Payment ID exactly |
| `idempotencyKey` | `pay-cmwg0k98m001n6kusfzlk77m1-1794637065477` | **PASS** |
| `orderId` | `cmwg0l7is001r6kus44a30x5e` | **PASS** — Linked directly to the created Order |
| `reservationId` | `cmwg0k98m001n6kusfzlk77m1` | **PASS** — Linked to consumed stock reservation |

### B. Created Order Record
| Field | Value | Verification |
| :--- | :--- | :--- |
| `id` | `cmwg0l7is001r6kus44a30x5e` | Unique cuid |
| `orderNumber` | `DSL-2026-731398` | Canonical order identifier |
| `paymentStatus` | `PAID` | **PASS** — Authoritatively confirmed |
| `orderStatus` | `CONFIRMED` | **PASS** — Ready for fulfillment |
| `paymentMethod` | `CARD_PAYHERE` | **PASS** |
| `totalCents` | `1300000` | **PASS** — Exactly LKR 13,000.00 |
| `subtotalCents` | `1300000` | **PASS** |
| `deliveryCents` | `0` | **PASS** — Free delivery applied (orders >= Rs. 5,000) |
| `discountCents` | `0` | **PASS** |
| `customerName` | `System Administrator` | **PASS** |
| `customerEmail` | `admin@dslstationery.lk` | **PASS** |
| `customerPhone` | `0710518229` | **PASS** |

### C. Order Items
| Product ID | Product Name | SKU | Unit Price | Qty | Total Price |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `prod-dsl-107` | MI 513WT COLORS - CALCULATOR | `DSL-PROD-107-171` | LKR 1,300.00 (`130000` cents) | 10 | LKR 13,000.00 (`1300000` cents) |

---

## 4. Stock Allocation & Inventory Integrity Audit

1. **Stock Reservation (`StockReservation`):**
   - Record ID: `cmwg0k98m001n6kusfzlk77m1`
   - Initial status: `PAYMENT_PENDING`
   - Final status: `CONSUMED`
   - Linked Order ID: `cmwg0l7is001r6kus44a30x5e`
   - Stock was cleanly transitioned from temporary reservation to permanent order deduction.

2. **Purchased Product Inventory (`prod-dsl-107`):**
   - Stock before checkout: **100 units**
   - Purchased quantity: **10 units**
   - Current physical stock: **90 units** (verified in database)
   - Real-time inventory broadcast dispatched via WebSocket to connected clients.

3. **Protected Product Invariant (`cmw0j4cro00089kusmwsbv48t`):**
   - Name: `Double Submission Test Product`
   - Stock quantity: **10** (strictly unchanged and untouched)

---

## 5. Duplicate Protection & Non-Duplication Audit

- **Order Duplication Check:**
  - Total orders in database: Exactly **2** (historical order `DSL-2026-320053` from Nov 4, and new order `DSL-2026-731398`).
  - Exactly **1 order** was created for this payment.
- **Payment Attempt Duplication Check:**
  - Exactly **1 payment attempt** succeeded (`cmwg0km4n001p6kusml717t0g`) with reference `320032688533`.
  - Zero duplicate payment records exist.
- **Idempotency Protection:**
  - Idempotency key `pay-cmwg0k98m001n6kusfzlk77m1-1794637065477` prevents multiple submissions or re-deliveries from creating additional orders.

---

## 6. Authoritative Reconciliation Status Endpoint

Queried `GET /api/v1/checkout/status/DSL-2026-731398`:
```json
{
  "success": true,
  "data": {
    "orderId": "cmwg0l7is001r6kus44a30x5e",
    "orderNumber": "DSL-2026-731398",
    "orderStatus": "CONFIRMED",
    "paymentStatus": "PAID",
    "isConfirmed": true,
    "paymentAttempt": {
      "id": "cmwg0km4n001p6kusml717t0g",
      "amountCents": 1300000,
      "currency": "LKR",
      "paymentMethod": "CARD_PAYHERE",
      "status": "SUCCEEDED",
      "gatewayReference": "320032688533"
    }
  },
  "message": "Payment status retrieved successfully"
}
```

---

## 7. Final Safety Action: Card Payments Disabled

As requested, card payments were immediately toggled off following verification to ensure the store cannot accept further card payments until explicitly re-enabled:

- Query executed on `StoreSettings`:
  ```sql
  UPDATE "StoreSettings" SET "onlineCardEnabled" = false WHERE id = 'default';
  ```
- **Read-Back Confirmation:**
  | Setting | Value |
  | :--- | :--- |
  | `onlineCardEnabled` | `false` (verified strictly `false`) |
  | `codEnabled` | `true` (Cash on Delivery remains active) |
  | `bankTransferEnabled` | `true` (Bank Transfer remains active) |

