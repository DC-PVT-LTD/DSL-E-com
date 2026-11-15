# DSL Stationery — PayHere Sandbox Payment Decline Investigation Report

**Document Date:** November 14, 2026  
**Status:** Investigation Completed  
**Incident:** PayHere Sandbox popup opened successfully, but the transaction was declined with `Decline Message: Unknown card`.  

---

## 1. Executive Summary & Root Cause

The PayHere Sandbox checkout popup loaded and rendered correctly on `localhost:3000`. This confirms that the earlier JavaScript SDK loader fixes were completely successful.

However, when submitting card details, the PayHere Sandbox gateway rejected the payment with:
```
Decline Message: Unknown card
```

### Exact Root Cause
The decline originated **inside PayHere's hosted Sandbox engine**, not from DSL Stationery's application code.

In the PayHere Sandbox environment:
1. PayHere operates an isolated simulator that **only recognizes a specific set of official PayHere Sandbox test card numbers**.
2. PayHere Sandbox **does not accept**:
   - Generic test cards from other payment gateways (such as Stripe's `4242 4242 4242 4242`).
   - Real, live credit or debit cards (Visa/Mastercard/Amex).
   - Random or arbitrary 16-digit card numbers.
3. Whenever an unrecognized card number is entered into the PayHere Sandbox form, the PayHere simulator immediately triggers:
   `Decline Message: Unknown card`.

---

## 2. Official PayHere Sandbox Test Cards & Instructions

Authoritative PayHere developer documentation specifies the following test card credentials for sandbox simulations:

### A. Successful Test Cards (Use for Successful Checkout)

| Card Network | Card Number | Expiry Date | CVV / CVC | OTP (if prompted) | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Visa** | `4916 2175 0161 1292` | Any future date (e.g. `12/28`) | Any 3 digits (e.g. `123`) | `123456` or click Submit | **Approved (Status 2)** |
| **Mastercard** | `5307 7321 2553 1191` | Any future date (e.g. `12/28`) | Any 3 digits (e.g. `123`) | `123456` or click Submit | **Approved (Status 2)** |
| **American Express** | `3467 8100 5510 225` | Any future date (e.g. `12/28`) | Any 4 digits (e.g. `1234`) | `123456` or click Submit | **Approved (Status 2)** |

*Cardholder Name:* Any name (e.g. `Test Customer`).

---

### B. Simulated Decline Cards (For Testing Failure Responses)

| Scenario | Visa | Mastercard | American Express |
| :--- | :--- | :--- | :--- |
| **Insufficient Funds** | `4024 0071 9434 9121` | `5459 0514 3377 7487` | `3707 8771 1978 928` |
| **Limit Exceeded** | `4929 1197 9936 5646` | `5491 1822 4317 8283` | `3407 0181 1823 469` |
| **Do Not Honor** | `4929 7689 0083 7248` | `5388 1721 3736 7973` | `3746 6417 5202 812` |
| **Network Error** | `4024 0071 2086 9333` | `5237 9805 6518 5003` | `3734 3350 0205 887` |

---

## 3. Backend Logs & Webhook Audit

Backend log inspection (`task-6062.log`) confirms the exact timeline of events:

1. **Pre-Payment Initialization:**
   ```
   [Nest] LOG [HTTP] POST /api/v1/checkout/validate-pay 200 - 92ms [IP: ::1]
   ```
   - Generated PayHere payment payload with `orderId: "DSL-1794635356060"`.
   - Correctly included `sandbox: true`, Merchant ID `1239105`, and valid HMAC MD5 hash.
   - Stored in-flight `PaymentAttempt` (`cmwfzjz4t001g6kus62r39wl1`) with status `PROCESSING`.

2. **PayHere Server-to-Server Webhook Received:**
   ```
   [Nest] LOG [CheckoutService] PayHere webhook verified for order DSL-1794635356060, status=-2
   ```
   - When the user entered the card and received "Unknown card", PayHere's server sent an asynchronous HTTP notification to our Cloudflare webhook endpoint.
   - Status code was `-2` (Declined / Failed / Canceled).
   - This proves that **Cloudflare tunnel connectivity and PayHere server-to-server webhook delivery are fully functional**.

3. **Defensive Webhook Order Guard:**
   - In the database, earlier checkout attempts from the same browser session existed under the same `StockReservation`.
   - The webhook query matched the reservation record, and our defensive security guard ensured that a failed notification for order `DSL-1794635356060` was prevented from modifying or touching any earlier attempt.

---

## 4. Database & State Audit

A read-only database query verified:

| Table / Entity | Target / ID | Verified State | Notes |
| :--- | :--- | :--- | :--- |
| **`Order`** | All records | Exactly 1 record (`DSL-2026-320053`) | **Zero new orders were created.** Protected against premature creation on payment decline. |
| **`PaymentAttempt`** | `cmwfzjz4t001g6kus62r39wl1` | `status: "PROCESSING"` | Unconfirmed attempt was **not** marked `PAID`. |
| **`StockReservation`** | `cmwfyam4w00156kusho4cp9dl` | `status: "PAYMENT_PENDING"` | Stock was held safely while customer was in gateway. |
| **Protected Product** | `cmw0j4cro00089kusmwsbv48t` | `stockQuantity: 10` | Stock remains strictly **10** (completely intact). |
| **StoreSettings** | `default` | `onlineCardEnabled: true` | Card payments remain enabled for sandbox testing. |

---

## 5. Summary & Next Steps for the User

1. **The Gateway Integration is Fully Functional:**
   - The PayHere JavaScript popup loads and functions properly.
   - Cloudflare tunnel receives PayHere's server-to-server webhook callbacks.
   - Premature order creation is prevented on declined transactions.
2. **How to Complete a Successful Sandbox Transaction:**
   When you are ready to test a successful card payment, open the PayHere popup and enter:
   - **Card Number:** `4916 2175 0161 1292` (Visa) or `5307 7321 2553 1191` (Mastercard)
   - **Expiry Date:** Any future date (e.g. `12/28`)
   - **CVV:** Any 3 digits (e.g. `123`)
   - **OTP (if prompted):** `123456`

