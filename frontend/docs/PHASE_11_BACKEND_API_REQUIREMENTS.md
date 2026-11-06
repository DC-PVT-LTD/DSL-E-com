# DSL STATIONERY — PHASE 11: ADMIN ORDER MANAGEMENT
# BACKEND API REQUIREMENTS & FRONTEND INTEGRATION SPECIFICATION

**Author:** Antigravity Frontend Development Agent  
**Date:** November 2026  
**Status:** ACTIVE COORDINATION CONTRACT  
**Target Backend Workspace:** `backend/` (NestJS REST API v1)  
**Target Frontend Workspace:** `frontend/` (Next.js 16+ App Router, React 19, TypeScript)

---

## 1. Executive Summary & Integration Context

The DSL Stationery Admin Portal requires a comprehensive, production-grade **Order Fulfillment and Lifecycle Management** interface (Phase 11). This document defines the exact integration contract between frontend components and backend endpoints:
1. **Existing Backend APIs** verified in `backend/src/modules/orders/orders.controller.ts`.
2. **Missing Backend APIs and Query Enhancements** required by Phase 11 features.
3. **Frontend Component Dependency Mapping** detailing which screens, modals, and actions depend on each endpoint.
4. **Error handling, validation rules, and lifecycle transition matrix**.

---

## 2. Status of Backend APIs for Phase 11

| Feature | HTTP Method & Endpoint | Status in Backend | Notes |
| :--- | :--- | :--- | :--- |
| **Orders List** | `GET /api/v1/orders` | **Partially Available** | Supports `page`, `limit`, `status`, `search`. Missing: `paymentStatus`, `sortBy`, `sortOrder`, `startDate`/`endDate` Prisma filter. |
| **Orders Statistics** | `GET /api/v1/admin/orders/stats` | **MISSING** | Required for Orders Dashboard summary metrics (Total, Pending, Processing, Shipped, Delivered, Cancelled). |
| **Order Details** | `GET /api/v1/orders/:id` | **Available** | Returns full order, address snapshot, item snapshots, payment attempts, and customer notes. |
| **Status Transition** | `PATCH /api/v1/orders/:id/status` | **Available** | Supports `{ status, trackingNumber, notes }`. Restores inventory upon cancellation. |
| **Update Customer** | `PATCH /api/v1/admin/orders/:id/customer` | **MISSING** | Required for "Edit Customer" button & modal on Order Details page. |
| **Update Delivery** | `PATCH /api/v1/admin/orders/:id/delivery` | **MISSING** | Required for "Edit Delivery Details" button & modal on Order Details page. |
| **Update Order Items** | `PATCH /api/v1/admin/orders/:id/items` | **MISSING** | Required for "Edit Items", adding/removing items, adjusting quantities on non-terminal orders. |
| **Order Return Requests** | `GET /api/v1/admin/orders/:id/returns` | **MISSING** | Required for Return Management section on Order Details page. |
| **Approve / Reject Return**| `PATCH /api/v1/admin/orders/:id/returns/:returnId` | **MISSING** | Required for Approve Return and Reject Return actions with rejection reason. |
| **Audit History Log** | `GET /api/v1/admin/orders/:id/audit-history` | **MISSING** | Required for Audit History timeline table on Order Details page. |
| **Admin Internal Notes** | `POST /api/v1/admin/orders/:id/notes` | **MISSING** | Required for internal staff notes separated from customer-facing notes. |

---

## 3. Detailed Specifications for Missing Backend APIs

### API 1: Order Dashboard Statistics
- **Feature:** Orders Dashboard summary cards.
- **Frontend Consumer:** `AdminOrdersPage` (`src/app/admin/orders/page.tsx`), `OrderStatsOverview` component.
- **HTTP Method:** `GET`
- **Expected Endpoint:** `/api/v1/admin/orders/stats` (or `/api/v1/orders/stats`)
- **Query Parameters:** None (or optional `startDate`, `endDate`).
- **Expected Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": {
    "total": 128,
    "pending": 14,
    "confirmed": 22,
    "processing": 35,
    "shipped": 28,
    "delivered": 24,
    "cancelled": 5,
    "totalRevenueCents": 18450000
  },
  "message": "Order statistics retrieved successfully"
}
```
- **Error Responses:**
  - `401 Unauthorized`: Missing or invalid administrator JWT token.
  - `403 Forbidden`: Authenticated user is not `ADMIN`, `MANAGER`, or `STAFF`.

---

### API 2: Query Filter & Sorting Enhancements on `GET /api/v1/orders`
- **Feature:** Search, Combined Filters, Server-side Sorting & Date Range.
- **Frontend Consumer:** Orders Listing Page (`/admin/orders`), `OrderFilterToolbar`, Server Pagination Controls.
- **HTTP Method:** `GET`
- **Endpoint:** `/api/v1/orders`
- **Required Additional Query Parameters:**
  - `paymentStatus`: Optional enum string (`PENDING`, `PAID`, `FAILED`, `REFUNDED`).
  - `sortBy`: Optional enum (`createdAt`, `totalCents`, `orderNumber`). Default `createdAt`.
  - `sortOrder`: Optional enum (`asc`, `desc`). Default `desc`.
  - `startDate`: ISO date string (e.g. `2026-11-01`). Currently declared in DTO but not applied in `orders.service.ts` query filter.
  - `endDate`: ISO date string (e.g. `2026-11-30`). Currently declared in DTO but not applied in `orders.service.ts` query filter.
- **Expected Request Example:**
```text
GET /api/v1/orders?page=1&limit=20&status=PROCESSING&paymentStatus=PAID&sortBy=totalCents&sortOrder=desc&startDate=2026-11-01&endDate=2026-11-05&search=Colombo
```
- **Expected Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "cm3a1b2c3d4e5f6g7h8i9j0k",
      "orderNumber": "DSL-2026-4891",
      "customerName": "Kamal Perera",
      "customerEmail": "kamal.perera@example.lk",
      "customerPhone": "+94 77 123 4567",
      "subtotalCents": 420000,
      "discountCents": 30000,
      "deliveryCents": 35000,
      "totalCents": 425000,
      "paymentMethod": "CARD_PAYHERE",
      "paymentStatus": "PAID",
      "orderStatus": "PROCESSING",
      "trackingNumber": "DSL-EXP-82910",
      "createdAt": "2026-11-04T10:15:30.000Z",
      "items": [
        {
          "id": "item-1",
          "productId": "prod-1",
          "productName": "Atlas CR 80pg Single Ruled Exercise Book",
          "sku": "ATL-CR-80-SR",
          "unitPriceCents": 18000,
          "quantity": 2,
          "totalPriceCents": 360000
        }
      ],
      "addressSnapshot": {
        "fullName": "Kamal Perera",
        "phone": "+94 77 123 4567",
        "addressLine1": "123 Galle Road",
        "city": "Colombo 03",
        "district": "Colombo",
        "postalCode": "00300"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

### API 3: Update Customer Information
- **Feature:** Edit Customer Information.
- **Frontend Consumer:** Order Details Page (`/admin/orders/[id]`), "Edit Customer" button, `EditCustomerModal` dialog.
- **HTTP Method:** `PATCH`
- **Expected Endpoint:** `/api/v1/admin/orders/:id/customer` (or `/api/v1/orders/:id/customer`)
- **Request Body (JSON):**
```json
{
  "customerName": "Kamal Ananda Perera",
  "customerEmail": "kamal.ananda@example.lk",
  "customerPhone": "+94 77 987 6543"
}
```
- **Validation Rules:**
  - `customerName`: string, min 2, max 100 characters.
  - `customerEmail`: valid RFC-compliant email address.
  - `customerPhone`: string, min 9, max 20 characters, matching SL phone patterns.
- **Expected Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "cm3a1b2c3d4e5f6g7h8i9j0k",
    "customerName": "Kamal Ananda Perera",
    "customerEmail": "kamal.ananda@example.lk",
    "customerPhone": "+94 77 987 6543",
    "updatedAt": "2026-11-05T07:30:00.000Z"
  },
  "message": "Customer information updated successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Validation failure.
  - `404 Not Found`: Order ID does not exist.
  - `422 Unprocessable Entity`: Cannot edit customer for cancelled or terminal orders.

---

### API 4: Update Delivery Information
- **Feature:** Edit Delivery Details.
- **Frontend Consumer:** Order Details Page (`/admin/orders/[id]`), "Edit Delivery Details" button, `EditDeliveryModal` dialog.
- **HTTP Method:** `PATCH`
- **Expected Endpoint:** `/api/v1/admin/orders/:id/delivery` (or `/api/v1/orders/:id/delivery`)
- **Request Body (JSON):**
```json
{
  "fullName": "Kamal Ananda Perera",
  "phone": "+94 77 987 6543",
  "addressLine1": "450 R.A. De Mel Mawatha",
  "addressLine2": "Level 4, Office Suite 12",
  "city": "Colombo 03",
  "district": "Colombo",
  "postalCode": "00300",
  "deliveryNotes": "Leave with security at main reception if unavailable"
}
```
- **Validation Rules:**
  - `district`: Must match one of 25 valid Sri Lankan districts.
  - `addressLine1`, `city`: Non-empty strings.
- **Expected Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "addr-snapshot-id",
    "orderId": "cm3a1b2c3d4e5f6g7h8i9j0k",
    "fullName": "Kamal Ananda Perera",
    "phone": "+94 77 987 6543",
    "addressLine1": "450 R.A. De Mel Mawatha",
    "addressLine2": "Level 4, Office Suite 12",
    "city": "Colombo 03",
    "district": "Colombo",
    "postalCode": "00300",
    "deliveryNotes": "Leave with security at main reception if unavailable"
  },
  "message": "Delivery details updated successfully"
}
```
- **Error Responses:**
  - `422 Unprocessable Entity`: Order has already been shipped or delivered.

---

### API 5: Update Order Items & Recalculate Totals
- **Feature:** Order Items Modification (Add product, remove product, adjust quantities).
- **Frontend Consumer:** Order Details Page (`/admin/orders/[id]`), "Edit Items" button, quantity controls, product addition selector.
- **HTTP Method:** `PATCH`
- **Expected Endpoint:** `/api/v1/admin/orders/:id/items`
- **Request Body (JSON):**
```json
{
  "items": [
    {
      "productId": "prod-1",
      "variantId": null,
      "quantity": 3
    },
    {
      "productId": "prod-2",
      "variantId": "var-blue",
      "quantity": 5
    }
  ],
  "reason": "Customer called to add 2 additional pens before fulfillment"
}
```
- **Business Logic & Validation:**
  - Order must be in `PENDING` or `CONFIRMED` status.
  - Re-validate stock availability against `Product.stockQuantity`.
  - Recalculate `subtotalCents`, delivery fee (free above threshold Rs. 5,000 / 500,000 cents), and `totalCents`.
  - Record audit log entry.
- **Expected Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "cm3a1b2c3d4e5f6g7h8i9j0k",
    "subtotalCents": 520000,
    "discountCents": 30000,
    "deliveryCents": 0,
    "totalCents": 490000,
    "items": [ ...updated items array... ]
  },
  "message": "Order items updated and totals recalculated"
}
```

---

### API 6: Return Requests Management
- **Feature:** Order Return Management.
- **Frontend Consumer:** Order Details Page (`/admin/orders/[id]`), "Return Requests" section, "Approve Return", "Reject Return", "Confirm Returned Products".
- **HTTP Endpoints:**
  - `GET /api/v1/admin/orders/:id/returns` — List returns for this order.
  - `PATCH /api/v1/admin/orders/:id/returns/:returnId/status` — Approve, reject, or mark received.
- **Approve Request Body:**
```json
{
  "action": "APPROVE",
  "note": "Return approved within 7-day policy window"
}
```
- **Reject Request Body:**
```json
{
  "action": "REJECT",
  "rejectionReason": "Item opened and packaging damaged beyond returnable standard"
}
```
- **Confirm Received Request Body:**
```json
{
  "action": "CONFIRM_RECEIVED",
  "restockInventory": true,
  "note": "Items inspected and returned to warehouse shelf"
}
```

---

### API 7: Order Audit History
- **Feature:** Audit History timeline.
- **Frontend Consumer:** Order Details Page (`/admin/orders/[id]`), "Audit History" card.
- **HTTP Method:** `GET`
- **Expected Endpoint:** `/api/v1/admin/orders/:id/audit-history` (or `/api/v1/audit-logs?entityType=order&entityId=:id`)
- **Expected Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "audit-1",
      "adminName": "Administrator (admin@dsl.lk)",
      "action": "STATUS_UPDATE",
      "fieldChanged": "orderStatus",
      "previousValue": "CONFIRMED",
      "newValue": "PROCESSING",
      "reason": "Items picked and moving to packing station",
      "createdAt": "2026-11-05T06:00:00.000Z"
    }
  ]
}
```

---

### API 8: Internal Admin Notes
- **Feature:** Internal Admin Notes (Staff-only, separated from customer-visible notes).
- **Frontend Consumer:** Order Details Page (`/admin/orders/[id]`), "Internal Admin Notes" section.
- **HTTP Method:** `POST`
- **Expected Endpoint:** `/api/v1/admin/orders/:id/notes`
- **Request Body (JSON):**
```json
{
  "note": "Customer requested delivery after 3 PM due to office hours.",
  "isInternal": true
}
```
- **Expected Response (HTTP 201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "note-1",
    "authorName": "Admin User",
    "note": "Customer requested delivery after 3 PM due to office hours.",
    "isInternal": true,
    "createdAt": "2026-11-05T07:10:00.000Z"
  },
  "message": "Admin note saved"
}
```

---

## 4. Frontend Fallback and Non-Breaking Integration Protocol

While the backend developer implements the missing endpoints in the backend window:
1. **Never Invent / Fake API Responses:** When an un-implemented endpoint is invoked by user action, display an informative modal/toast: `"Backend API [PATCH /api/v1/admin/orders/:id/...] is awaiting completion in Phase 11. Request logged."`.
2. **Never Simulate Payments or Refunds:** Payment details will display genuine records from `order.paymentAttempts` and `order.paymentStatus`. Refund actions will only trigger real backend endpoints when supported.
3. **Stat Computation Fallback:** In the absence of `/api/v1/admin/orders/stats`, the frontend calculates live dashboard metric counters dynamically from `GET /api/v1/orders` without blocking the UI.
4. **Lifecycle State Machine:** The frontend strictly enforces the backend's `PERMITTED_STATUS_TRANSITIONS`:
   - `PENDING` $\rightarrow$ `CONFIRMED`, `CANCELLED`
   - `CONFIRMED` $\rightarrow$ `PROCESSING`, `CANCELLED`
   - `PROCESSING` $\rightarrow$ `SHIPPED`, `CANCELLED`
   - `SHIPPED` $\rightarrow$ `DELIVERED`, `CANCELLED`
   - `DELIVERED` $\rightarrow$ Terminal (No transitions)
   - `CANCELLED` $\rightarrow$ Terminal (No transitions)
