# Phase 11 — Admin Order Management API & Frontend Integration Guide

This document defines the authoritative API contract and integration requirements for Phase 11 (Admin Order Management & Real-Time Fulfillment) in the DSL Stationery E-Commerce application.

---

## 1. Authentication & Role Authorization

All Admin Order Management endpoints are protected by:
- `JwtAuthGuard`: Enforces a valid, signed JWT access token in the `Authorization: Bearer <token>` header or `dsl_access_token` HTTP-only cookie.
- `RolesGuard`: Restricts access strictly to administrative personnel (`ADMIN`, `MANAGER`, `STAFF`).
- Customer endpoints (`GET /api/v1/orders/:id`) enforce ownership checks (matching `userId` or `customerEmail`).

---

## 2. API Specifications

### 2.1 Aggregated Dashboard Statistics
- **Method & Endpoint:** `GET /api/v1/admin/orders/stats`
- **Headers:** `Authorization: Bearer <token>`
- **Response Structure (200 OK):**
```json
{
  "success": true,
  "data": {
    "total": 50,
    "pending": 5,
    "confirmed": 12,
    "processing": 15,
    "packed": 6,
    "shipped": 7,
    "delivered": 3,
    "cancelled": 2,
    "totalRevenueCents": 24500000
  },
  "message": "Order statistics retrieved successfully"
}
```

---

### 2.2 Order Listing & Search Filtering
- **Method & Endpoint:** `GET /api/v1/admin/orders`
- **Query Parameters:**
  - `page` (number, default: 1)
  - `limit` (number, default: 20)
  - `status` (string: `all`, `PENDING`, `CONFIRMED`, `PROCESSING`, `PACKED`, `SHIPPED`, `DELIVERED`, `CANCELLED`)
  - `paymentStatus` (string: `all`, `PENDING`, `PAID`, `FAILED`, `REFUNDED`)
  - `search` (string: searches `orderNumber`, `customerName`, `customerEmail`, `customerPhone`)
  - `startDate` (ISO string or YYYY-MM-DD)
  - `endDate` (ISO string or YYYY-MM-DD)
  - `sortBy` (`createdAt` | `totalCents` | `orderNumber`, default: `createdAt`)
  - `sortOrder` (`asc` | `desc`, default: `desc`)
- **Response Structure (200 OK):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "cmw0...",
        "orderNumber": "DSL-2026-320053",
        "customerName": "Kamal Perera",
        "customerEmail": "kamal@example.com",
        "customerPhone": "0771234567",
        "subtotalCents": 75000,
        "discountCents": 0,
        "deliveryCents": 35000,
        "totalCents": 110000,
        "paymentMethod": "CARD_PAYHERE",
        "paymentStatus": "PAID",
        "orderStatus": "CONFIRMED",
        "trackingNumber": "DSL-EXP-48910",
        "createdAt": "2026-11-05T08:00:00.000Z",
        "items": [...],
        "addressSnapshot": { ... }
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "message": "Orders list retrieved successfully"
}
```

---

### 2.3 Single Order Details
- **Method & Endpoint:** `GET /api/v1/admin/orders/:id`
- **URL Parameters:** `:id` (UUID/cuid or Order Number `DSL-2026-XXXX`)
- **Response Structure (200 OK):**
  Returns complete order details including:
  - `items`: Each with product image, SKU, unit price, quantity, variant name, and live stock.
  - `addressSnapshot`: Immutable delivery address snapshot at order creation.
  - `paymentAttempts`: PayHere transactions, gateway references, failure reasons.
  - `auditLogs`: Chronological timeline of all changes made by administrators.
  - `orderNotes`: Internal administrative notes.
  - `returnRequests`: Associated return items, reasons, decisions.
  - `refundRecords`: Official recorded refunds.

---

### 2.4 Update Fulfillment Status
- **Method & Endpoint:** `PATCH /api/v1/admin/orders/:id/status`
- **Request Body:**
```json
{
  "status": "PACKED",
  "trackingNumber": "DSL-EXP-99214",
  "notes": "Ready for courier pickup",
  "reason": "Items packed by warehouse staff"
}
```
- **State Machine Permitted Transitions:**
  - `PENDING` -> `[CONFIRMED, CANCELLED]`
  - `CONFIRMED` -> `[PROCESSING, CANCELLED]`
  - `PROCESSING` -> `[PACKED, CANCELLED]`
  - `PACKED` -> `[SHIPPED, CANCELLED]`
  - `SHIPPED` -> `[DELIVERED, CANCELLED]`
  - `DELIVERED` -> `[]`
  - `CANCELLED` -> `[]`
- **Side Effects:**
  - Emits real-time WebSocket event `order.status.updated` and `order.updated`.
  - Records an `OrderAuditLog` entry.
  - Dispatches an order status email/notification to customer.
  - If transitioning to `CANCELLED`, automatically restores physical stock and emits `inventory:updated`.

---

### 2.5 Update Customer Contact Information
- **Method & Endpoint:** `PATCH /api/v1/admin/orders/:id/customer`
- **Request Body:**
```json
{
  "customerName": "Sunil Shantha",
  "customerEmail": "sunil.updated@example.lk",
  "customerPhone": "+94 77 987 6543",
  "reason": "Customer called hotline to fix typo in phone number"
}
```
- **Side Effects:**
  - Updates only the order snapshot. Does not overwrite customer account table.
  - Creates an audit log entry.
  - Emits real-time event `order.customer.updated`.

---

### 2.6 Update Delivery Information
- **Method & Endpoint:** `PATCH /api/v1/admin/orders/:id/delivery`
- **Request Body:**
```json
{
  "addressLine1": "No. 45, Flower Road",
  "addressLine2": "Apartment 3B",
  "city": "Colombo 07",
  "district": "Colombo",
  "postalCode": "00700",
  "deliveryNotes": "Deliver after 5 PM",
  "reason": "Customer updated delivery apartment number"
}
```

---

### 2.7 Modify Order Items & Recalculate Totals
- **Method & Endpoint:** `PATCH /api/v1/admin/orders/:id/items`
- **Request Body:**
```json
{
  "items": [
    { "productId": "cmw0...", "variantId": null, "quantity": 3 }
  ],
  "reason": "Customer requested 1 additional notebook before packaging"
}
```
- **Validation Rules:**
  - Disallowed if order status is `SHIPPED`, `DELIVERED`, or `CANCELLED`.
  - Validates physical stock availability before allowing quantity increases.
  - Adjusts stock transactionally and creates `InventoryMovement` records.
  - Recalculates subtotal, delivery fee (respects free delivery threshold), and grand total.

---

### 2.8 Cancel Order
- **Method & Endpoint:** `POST /api/v1/admin/orders/:id/cancel`
- **Request Body:**
```json
{
  "reason": "Customer requested cancellation before dispatch",
  "restoreInventory": true,
  "processRefund": true
}
```
- **Validation:**
  - Rejects if order is already `CANCELLED` or `DELIVERED`.
  - Transactionally restores product stock if `restoreInventory` is true.
  - If `processRefund` is true and order was `PAID`, sets payment status to `REFUNDED` and creates a `RefundRecord`.

---

### 2.9 Return Management
- **List Returns:** `GET /api/v1/admin/orders/:id/returns`
- **Create Return:** `POST /api/v1/admin/orders/:id/returns`
```json
{
  "reason": "Defective product received",
  "items": [
    { "orderItemId": "cmw...", "quantity": 1, "reason": "Pen dry on arrival" }
  ]
}
```
- **Process Return:** `PATCH /api/v1/admin/orders/:id/returns/:returnId/status`
```json
{
  "action": "CONFIRM_RECEIVED", // "APPROVE" | "REJECT" | "CONFIRM_RECEIVED"
  "rejectionReason": null,
  "restockItems": true
}
```

---

### 2.10 Refund Recording
- **Method & Endpoint:** `POST /api/v1/admin/orders/:id/refund`
- **Request Body:**
```json
{
  "amountCents": 110000,
  "method": "MANUAL_BANK_TRANSFER",
  "reference": "TXN-BOC-994821",
  "reason": "Bank transfer refund issued to customer account"
}
```

---

### 2.11 Audit History & Admin Notes
- **Audit History:** `GET /api/v1/admin/orders/:id/audit-history`
- **Add Note:** `POST /api/v1/admin/orders/:id/notes`
```json
{
  "note": "Verified payment slip via WhatsApp; courier notified.",
  "isInternal": true
}
```

---

## 3. Real-Time WebSockets Architecture

- **Namespace:** `/orders`
- **Rooms:**
  - `admin:orders`: Subscribed by staff administrators for all order changes.
  - `order:{orderId}`: Subscribed by order details view for live updates.
- **Client Subscription:**
```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000/orders', {
  transports: ['websocket'],
  withCredentials: true,
});

socket.emit('subscribe:admin');
socket.emit('subscribe:order', { orderId: 'cmw...' });

socket.on('order.status.updated', (payload) => {
  console.log('Status updated in real-time:', payload);
});
```
- **Events Dispatched:**
  1. `order.created`
  2. `order.updated`
  3. `order.status.updated`
  4. `order.customer.updated`
  5. `order.delivery.updated`
  6. `order.items.updated`
  7. `order.payment.updated`
  8. `order.cancelled`
  9. `order.return.updated`
  10. `order.refund.updated`

