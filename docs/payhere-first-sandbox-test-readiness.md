# DSL Stationery — PayHere First Sandbox Test Readiness Report

**Date:** 2026-11-14  
**Project:** DSL Stationery E-Commerce Platform  
**Target:** Enable PayHere Sandbox for One Controlled Test  
**Status:** PayHere Enabled, Verified, and Waiting for Your Manual Test Execution  

---

## 1. Safety Checks Completed

Prior to modifying the setting, all safety checks were performed and passed:

* **Sandbox Flag:** `PAYHERE_SANDBOX=true` confirmed in `backend/.env`.
* **Merchant ID:** Configured as `1239105`, matching the active PayHere Sandbox integration.
* **Credentials Security:** Verified in-memory; zero tokens, secrets, or keys printed or exposed.
* **Cloudflare Tunnel:** Active and running as a background daemon (Task ID `task-6024`).
* **Notification Webhook Connectivity:** Verified accessible from the public internet:  
  `https://participants-furniture-ethics-threats.trycloudflare.com/api/v1/checkout/payhere/webhook`
* **Protected Product Stock:** Product `cmw0j4cro00089kusmwsbv48t` confirmed at exactly **`10`** units.
* **StoreSettings Record ID:** Confirmed single singleton record with ID `'default'`.

---

## 2. Database Setting Changed and Verified

The local PostgreSQL database `StoreSettings` record was updated:

```sql
UPDATE "StoreSettings" SET "onlineCardEnabled" = true WHERE id = 'default';
```

### Verified Record State (Read Back from PostgreSQL):
```json
{
  "id": "default",
  "onlineCardEnabled": true,
  "codEnabled": true,
  "bankTransferEnabled": true,
  "flatDeliveryFeeCents": 35000,
  "freeDeliveryThresholdCents": 500000,
  "hotlinePhone": "+94 114 963 069",
  "whatsappNumber": "+94 772 355 530",
  "contactEmail": "info@dsltrading.com"
}
```

* Only `onlineCardEnabled` was modified (`false` $\to$ `true`).
* All other payment settings, delivery rates, and contact details remain unchanged.
* HTTP endpoint `GET /api/v1/checkout/settings` returns:
  `{"success":true,"data":{"onlineCardEnabled":true,"codEnabled":true,"bankTransferEnabled":true,...}}`

---

## 3. Checkout Readiness & Security Verification

* **Frontend Visibility:** The checkout page at `http://localhost:3000/checkout` queries `/checkout/settings` on mount and now displays the **Online Payment (PayHere)** card option with the PayHere logo and radio button.
* **COD Availability:** **Cash on Delivery (COD)** remains fully available and functional.
* **Stage A Security Enforcement:** A direct client request submitting `paymentMethod: 'CARD_PAYHERE'` to `POST /api/v1/checkout/pay` was tested and immediately rejected:
  * **HTTP Status:** `400 Bad Request`
  * **Message:** `"Direct card payment confirmation is not permitted. Card payments must be processed and verified through the payment gateway callback."`
* **Webhook Signature & Fulfill Isolation:** Only an authentic PayHere webhook callback with a verified MD5 signature matching `PAYHERE_MERCHANT_SECRET` can confirm payment and mark an order as `PAID`.
* **Zero Automatic Orders:** No orders were created, no test payments were submitted, and no inventory was deducted.

---

## 4. Manual Test Instructions for You

You can now perform your manual PayHere Sandbox transaction:

1. **Open Storefront in Browser:**
   * Go to `http://localhost:3000/shop`
   * Add any standard stationery item to the cart (e.g. *Atlas Gel Pen*).
2. **Proceed to Checkout:**
   * Navigate to `http://localhost:3000/checkout`.
   * Enter your delivery information.
   * Under **Payment Method**, select **Online Payment (PayHere)** (now visible).
   * Click **Place Order**.
3. **Pay in Sandbox Modal:**
   * The official PayHere Sandbox popup window will open.
   * Enter official PayHere Sandbox test card credentials:
     * **Card Number:** `4111 1111 1111 1111` (Visa) or `5200 0000 0000 0000` (Mastercard)
     * **Expiry Date:** Any future date (e.g. `12/28`)
     * **CVV:** `123`
     * **OTP / 3DS:** Enter `123456`
   * Click **Pay**.
4. **Observe the Result:**
   * The popup closes and redirects to `/checkout/result?orderId=...&payment=pending`.
   * Within 3–6 seconds, PayHere delivers the webhook callback to the Cloudflare Tunnel URL.
   * The result screen updates to green verified confirmation (**"Order Placed Successfully! Payment Verified"**).
5. **After Testing:**
   * Inform me when your test is finished so `onlineCardEnabled` can be reverted back to `false`.

---

## 5. Blockers & Risks

* **Blockers:** None. All backend routes, the frontend UI, the Cloudflare HTTPS tunnel, and the database settings are live and healthy.
* **Protected Product Stock:** Remains strictly **`10`**.

