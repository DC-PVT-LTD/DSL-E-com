# DSL Stationery Admin — Phase 1: Order Operations & Returns Audit Report

**Document Reference:** `docs/admin-phase-1-order-returns-audit.md`  
**Execution Context:** DSL Admin Panel Upgrade — Phase 1: Make Order Operations Dependable  
**Date:** November 14, 2026  
**Status:** Under Review (Inspection Only — No Code or Database Modifications Executed)

---

## Executive Summary

As part of the DSL Admin Panel upgrade, an end-to-end audit was conducted across the existing order management, status transition, return request, refund processing, inventory movement, and audit logging subsystems. 

The audit confirms:
1. **Critical API Contract Mismatch on Returns:** The frontend sends `{ action, reason }` during return operations, whereas the backend schema expects `{ action, rejectionReason?, restockItems? }`. As a result, staff rejection reasons are discarded by the API validation pipe, and restocking decisions cannot be controlled from the UI.
2. **Severe Operational Risk on Inventory Restocking:** The backend return receipt endpoint (`PATCH /admin/orders/:id/returns/:returnId/status` with `action: 'CONFIRM_RECEIVED'`) lacks state-machine validation and idempotency protection. If invoked multiple times on an already completed return, physical and variant stock is repeatedly incremented without bounds.
3. **Financial Safety Deficiencies in Refunds:** The refund endpoint validates only single transaction amounts against the order total, failing to check cumulative refunds or whether the order was ever paid (e.g., unpaid COD or pending payments can be refunded). Furthermore, any refund unconditionally sets the payment status to `REFUNDED` rather than distinguishing partial refunds.
4. **RBAC Guard Disconnect:** The `AdminOrdersController` relies entirely on legacy coarse-grained enum roles (`STAFF`, `MANAGER`, `ADMIN`) via `RolesGuard`, bypassing the dynamic granular `PermissionsGuard`. Consequently, any staff or manager account can approve returns, issue refunds, or cancel orders regardless of their assigned permissions.
5. **Masking of Failures in Frontend Services:** The frontend `orderService.ts` contains silent `try/catch` fallbacks that swallow 404/500 errors (returning empty lists or local cache mutations), which obscures genuine backend faults and creates illusions of successful updates.

---

## 1. Existing Architecture & System Inventory

### 1.1 Architecture Diagram

```
+--------------------------------------------------------------------------------------------------+
|                                    Next.js 16 Admin Client                                       |
|  - Orders Dashboard: /admin/orders (URL params: status, paymentStatus, page, limit, search, etc.) |
|  - Order Detail View: /admin/orders/[id]                                                         |
|  - Modals: StatusTransitionModal, CancelOrderModal, EditCustomerModal, EditDeliveryModal,        |
|            EditItemsModal, ReturnManagementCard, AuditHistoryCard, AdminNotesCard                |
+---------------------------------------------------------+----------------------------------------+
                                                          | HTTP REST (Cookies / Bearer Auth)
                                                          | WebSocket (/orders namespace)
                                                          v
+--------------------------------------------------------------------------------------------------+
|                                      NestJS 11 Backend API                                       |
|  - AdminOrdersController (/api/v1/admin/orders) [Guards: JwtAuthGuard, RolesGuard]               |
|  - AdminOrdersService (Business logic, financial recalculations, stock restoration)              |
|  - OrdersGateway (Socket.IO events: order.status.updated, order.return.updated, etc.)            |
|  - Legacy OrdersController (/api/v1/orders) [Duplicate PATCH /orders/:id/status endpoint]        |
+---------------------------------------------------------+----------------------------------------+
                                                          | Prisma 7 Client (Adapter-PG)
                                                          v
+--------------------------------------------------------------------------------------------------+
|                                    PostgreSQL 18.4 Database                                      |
|  Tables: orders, order_items, order_return_requests, order_return_items, refund_records,         |
|          inventory_movements, order_audit_logs, order_notes, roles, permissions                  |
+--------------------------------------------------------------------------------------------------+
```

### 1.2 Component & Endpoint Mapping

| Administrative Feature | Frontend Component / Service Call | Backend Controller & Endpoint | HTTP Method | Database Entities Mutated |
| :--- | :--- | :--- | :--- | :--- |
| **Order Listing & Filters** | `OrderTable.tsx`, `OrderFilterToolbar.tsx`<br>`orderService.fetchOrders()` | `AdminOrdersController.getOrders`<br>`/api/v1/admin/orders` | `GET` | Read-only (`Order`, `OrderItem`, `OrderAddressSnapshot`) |
| **Fulfillment Metrics** | `OrderStatsCards.tsx`<br>`orderService.fetchOrderStats()` | `AdminOrdersController.getOrderStats`<br>`/api/v1/admin/orders/stats` | `GET` | Read-only aggregate (`Order`) |
| **Order Detail View** | `app/admin/orders/[id]/page.tsx`<br>`orderService.fetchOrderById()` | `AdminOrdersController.getOrderById`<br>`/api/v1/admin/orders/:id` | `GET` | Read-only (`Order`, `OrderItem`, `OrderReturnRequest`, `RefundRecord`, `OrderAuditLog`, `OrderNote`) |
| **Status Transition** | `StatusTransitionModal.tsx`<br>`orderService.transitionStatusApi()` | `AdminOrdersController.updateStatus`<br>`/api/v1/admin/orders/:id/status` | `PATCH` | `Order`, `InventoryMovement` (if CANCELLED), `OrderAuditLog` |
| **Order Cancellation** | `CancelOrderModal.tsx`<br>`orderService.cancelOrderApi()` | `AdminOrdersController.cancelOrder`<br>`/api/v1/admin/orders/:id/cancel` | `POST` | `Order`, `Product`, `ProductVariant`, `InventoryMovement`, `RefundRecord` (optional), `OrderAuditLog` |
| **Return Listing** | `ReturnManagementCard.tsx`<br>`orderService.fetchOrderReturns()` | `AdminOrdersController.getOrderReturns`<br>`/api/v1/admin/orders/:id/returns` | `GET` | Read-only (`OrderReturnRequest`, `OrderReturnItem`) |
| **Return Initiation** | `orderService.createReturnApi()` *(Customer portal or Admin script)* | `AdminOrdersController.createReturnRequest`<br>`/api/v1/admin/orders/:id/returns` | `POST` | `OrderReturnRequest`, `OrderReturnItem`, `OrderAuditLog` |
| **Return Action (Approve / Reject / Restock)** | `ReturnManagementCard.tsx`<br>`orderService.processReturnAction()` | `AdminOrdersController.processReturnStatus`<br>`/api/v1/admin/orders/:id/returns/:returnId/status` | `PATCH` | `OrderReturnRequest`, `OrderReturnItem`, `Product`, `ProductVariant`, `InventoryMovement`, `OrderAuditLog` |
| **Refund Recording** | `orderService.processRefundApi()` *(UI action currently only inside Cancel modal)* | `AdminOrdersController.processRefund`<br>`/api/v1/admin/orders/:id/refund` | `POST` | `RefundRecord`, `Order`, `OrderAuditLog` |
| **Customer Info Edit** | `EditCustomerModal.tsx`<br>`orderService.updateCustomerInfo()` | `AdminOrdersController.updateCustomerInfo`<br>`/api/v1/admin/orders/:id/customer` | `PATCH` | `Order`, `OrderAuditLog` |
| **Delivery Address Edit** | `EditDeliveryModal.tsx`<br>`orderService.updateDeliveryInfo()` | `AdminOrdersController.updateDeliveryInfo`<br>`/api/v1/admin/orders/:id/delivery` | `PATCH` | `OrderAddressSnapshot`, `OrderAuditLog` |
| **Item Adjustment** | `EditItemsModal.tsx`<br>`orderService.updateOrderItems()` | `AdminOrdersController.updateOrderItems`<br>`/api/v1/admin/orders/:id/items` | `PATCH` | `OrderItem`, `Product`, `ProductVariant`, `InventoryMovement`, `Order`, `OrderAuditLog` |
| **Audit Trail** | `AuditHistoryCard.tsx`<br>`orderService.fetchOrderAuditHistory()` | `AdminOrdersController.getAuditHistory`<br>`/api/v1/admin/orders/:id/audit-history` | `GET` | Read-only (`OrderAuditLog`) |
| **Admin Notes** | `AdminNotesCard.tsx`<br>`orderService.addAdminNote()` | `AdminOrdersController.addAdminNote`<br>`/api/v1/admin/orders/:id/notes` | `POST` | `OrderNote`, `OrderAuditLog` |

---

## 2. Confirmed API Contract Mismatch Investigation

### 2.1 The Return Action Contract Failure

#### Frontend Implementation (`frontend/src/services/orderService.ts` lines 669–688):
```typescript
public async processReturnAction(
  orderId: string,
  returnId: string,
  action: 'APPROVE' | 'REJECT' | 'CONFIRM_RECEIVED',
  reason?: string
): Promise<{ success: boolean; error?: string; isBackendPending?: boolean }> {
  try {
    await apiClient.patch(`/admin/orders/${orderId}/returns/${returnId}/status`, {
      action,
      reason, // <-- ISSUE: Sends 'reason' instead of 'rejectionReason'
    });
    return { success: true };
  } catch (err: any) { ... }
}
```

#### Calling UI (`frontend/src/components/admin/orders/ReturnManagementCard.tsx` lines 195–199):
```typescript
onClick={() => handleAction(ret.id, 'REJECT', rejectionReason)}
// Passes rejectionReason into the 4th argument, which gets serialized as { action: 'REJECT', reason: rejectionReason }
```

#### Backend Zod Validation Schema (`backend/src/modules/orders/dto/admin-orders.dto.ts` lines 85–89):
```typescript
export const adminProcessReturnSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'CONFIRM_RECEIVED']),
  rejectionReason: z.string().optional(),
  restockItems: z.boolean().default(true),
});
```

#### Backend Handler (`backend/src/modules/orders/admin-orders.service.ts` lines 1136–1152):
```typescript
await tx.orderReturnItem.updateMany({
  where: { returnRequestId: returnReq.id },
  data: {
    status: itemStatus,
    rejectionReason: dto.action === 'REJECT' ? dto.rejectionReason : null,
    receivedAt: dto.action === 'CONFIRM_RECEIVED' ? new Date() : null,
  },
});

const res = await tx.orderReturnRequest.update({
  where: { id: returnReq.id },
  data: {
    status: targetStatus,
    rejectionReason: dto.action === 'REJECT' ? dto.rejectionReason : returnReq.rejectionReason,
  },
  include: { items: true },
});
```

### 2.2 Direct Impact of Mismatch
1. **Rejection Reason Discarded:** When an administrator rejects a return and enters a reason (e.g., *"Product damaged due to customer misuse"*), the payload `{ action: 'REJECT', reason: '...' }` is validated by `adminProcessReturnSchema`. Zod strips unknown fields (`reason`), leaving `dto.rejectionReason` as `undefined`. As a consequence:
   - `orderReturnRequest.rejectionReason` remains `null`.
   - `orderReturnItem.rejectionReason` remains `null`.
   - The customer notification dispatched via `notificationsService.sendReturnStatusUpdate` receives `rejectionReason: undefined`.
2. **Missing Restocking Discretion:** During `CONFIRM_RECEIVED`, the frontend never sends `restockItems`. The backend Zod schema defaults `restockItems: true`. If returned merchandise is broken or soiled and staff explicitly wishes to accept the return without restocking to available inventory, the UI provides no toggle, forcing an automated restock.

### 2.3 Correct API Payload Specifications

| Action | Target Return Status | Required Payload Structure | Description |
| :--- | :--- | :--- | :--- |
| **Approve Return** | `APPROVED` | `{"action": "APPROVE"}` | Marks return as approved for customer shipment/drop-off. |
| **Reject Return** | `REJECTED` | `{"action": "REJECT", "rejectionReason": "Non-returnable item / packaging broken"}` | Rejects return and persists staff reason for record and customer notification. |
| **Confirm Receipt (Restock)** | `COMPLETED` | `{"action": "CONFIRM_RECEIVED", "restockItems": true}` | Acknowledges package receipt, stamps `receivedAt`, increments physical & variant stock, records `InventoryMovement`. |
| **Confirm Receipt (Damaged / No Restock)** | `COMPLETED` | `{"action": "CONFIRM_RECEIVED", "restockItems": false}` | Acknowledges package receipt and stamps `receivedAt` without incrementing stock or creating restocking inventory movements. |

---

## 3. Operational Safety & Risk Assessment

### 3.1 Can Restocking Happen Twice? — YES (CRITICAL RISK)
In `backend/src/modules/orders/admin-orders.service.ts` (`processReturnStatus`, lines 1081–1134):
- The method looks up `returnReq` by ID and orderId.
- **There is no check whether `returnReq.status === ReturnStatus.COMPLETED` or whether `item.receivedAt` is already set.**
- If an admin clicks "Confirm Products Received & Restock" a second time, or if a network retry / duplicate request occurs:
  ```typescript
  if (dto.restockItems) {
    for (const item of returnReq.items) {
      await tx.product.update({
        where: { id: orderItem.productId },
        data: { stockQuantity: { increment: item.quantity } },
      });
      if (orderItem.variantId) {
        await tx.productVariant.update({
          where: { id: orderItem.variantId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }
      // InventoryMovement created again...
    }
  }
  ```
- **Consequence:** Physical inventory and variant inventory are incremented every time the endpoint is called. A double-click will inflate store inventory by double the returned quantity.

### 3.2 Are Duplicate Return Actions Prevented? — NO
- `AdminOrdersService.processReturnStatus` has no state-transition validation matrix:
  - An already `REJECTED` return can be transitioned to `APPROVED` or `COMPLETED`.
  - An already `COMPLETED` return can be transitioned back to `REJECTED`.
  - A `PENDING` return can bypass `APPROVED` directly to `COMPLETED`.
- In `createReturnRequest` (`admin-orders.service.ts` line 1005):
  - There is no check verifying that the order is `DELIVERED`. A return can be submitted for an order in `PENDING` or `CANCELLED` status.
  - There is no check whether the return item quantity exceeds the ordered quantity (`it.quantity > matched.quantity`).
  - There is no check whether an item was already returned in a previous return request for the same order.

### 3.3 Can Refund Amounts Exceed the Amount Actually Paid? — YES (CRITICAL RISK)
In `backend/src/modules/orders/admin-orders.service.ts` (`processRefund`, lines 1208–1212):
```typescript
if (dto.amountCents > order.totalCents) {
  throw new BadRequestException(
    `Refund amount (Rs. ${(dto.amountCents / 100).toFixed(2)}) cannot exceed order grand total (Rs. ${(order.totalCents / 100).toFixed(2)})`
  );
}
```
Three severe vulnerabilities exist here:
1. **Unpaid Orders Can Be Refunded:** The check compares against `order.totalCents`, but does NOT verify that `order.paymentStatus === PaymentStatus.PAID`. A Cash on Delivery (COD) order that was never delivered or paid, or a card order whose payment failed/remained pending, can have a refund recorded against it.
2. **Multiple Partial Refunds Exceed Order Value:** The service does not sum prior `RefundRecord` entries for the order. If an order total is Rs. 1,000:
   - Admin records Refund 1: Rs. 600 (Allowed: 600 <= 1000).
   - Admin records Refund 2: Rs. 600 (Allowed: 600 <= 1000).
   - Cumulative refunds = Rs. 1,200 (exceeds order total by Rs. 200).
3. **Premature Status Update:** Any refund (even Rs. 10 on a Rs. 10,000 order) immediately updates `order.paymentStatus = PaymentStatus.REFUNDED`. The system has no `PARTIALLY_REFUNDED` status in the Prisma enum `PaymentStatus`, obliterating the audit state of remaining balances.
4. **Order Cancellation Double Refund:** In `cancelOrder` (line 919): If an order is cancelled with `processRefund: true`, it creates a `RefundRecord` for `order.totalCents`. If staff had already issued a partial refund earlier, cancelling the order will refund the full amount again.

### 3.4 Are Manually Recorded Refunds Distinguished from Provider Refunds? — NO
- In `schema.prisma`, `RefundRecord` stores:
  `{ id, orderId, amountCents, method, reference, reason, processedBy, createdAt }`
- `method` is an arbitrary string typed by staff or generated via `CANCELLATION_REFUND`.
- **PayHere Automated Refunds Are Not Supported:** The PayHere integration does not execute automated refund API calls. All refunds recorded in the admin panel are strictly accounting entries.
- The UI and database do not distinguish between:
  - An automated gateway reversal.
  - A manual commercial bank transfer.
  - Store credit.
  - Cash payout.

### 3.5 Does Each Action Create an Audit Event? — PARTIAL
- `AdminOrdersService` creates `orderAuditLog` entries for status changes, customer edits, delivery edits, item modifications, cancellations, return decisions, refunds, and notes.
- **Vulnerability:** The legacy `OrdersService.updateStatus` (`PATCH /api/v1/orders/:id/status`) DOES NOT create an `orderAuditLog`. Furthermore, `frontend/src/services/orderService.ts` (lines 482–488) contains a fallback that retries status updates against `/orders/${id}/status` if `/admin/orders/${id}/status` fails, inadvertently bypassing the audit log.
- **InventoryMovement Audit Degradation:** In both `cancelOrder` (line 906) and `processReturnStatus` (line 1123), `InventoryMovement.create` hardcodes `previousQuantity: 0` and `newQuantity: item.quantity` instead of fetching the current stock balance of the product/variant, creating corrupted inventory history logs.

### 3.6 Are Invalid Status Transitions Rejected? — YES (on Status), NO (on Returns)
- **Order Fulfillment Status:** Enforces `PERMITTED_STATUS_TRANSITIONS` correctly in `AdminOrdersService.updateStatus`. Direct jumps (e.g., `PENDING` -> `DELIVERED`) are rejected with HTTP 400.
- **Item Modifications on Fulfilled Orders:** `AdminOrdersService.updateOrderItems` correctly blocks edits on orders that are `SHIPPED`, `DELIVERED`, or `CANCELLED`.
- **Financial Total Discrepancy on Item Edit:** If items are modified on an already `PAID` order, the backend recalculates `order.totalCents` and `subtotalCents`, but does NOT adjust or flag `order.paymentStatus`. If new items increase the total from Rs. 2,000 to Rs. 3,500, the order remains marked `PAID` with no tracking of the Rs. 1,500 deficit.
- **Return Lifecycle:** Zero transition validation exists for return requests.

---

## 4. Permissions & RBAC Verification

### 4.1 RBAC Architecture
DSL Stationery has two distinct authorization layers in the backend:
1. **Legacy Role Guard (`RolesGuard`):** Checks the enum column `User.role` (`CUSTOMER`, `STAFF`, `MANAGER`, `ADMIN`).
2. **Granular Permissions System (`PermissionsGuard`):** Introduced for dynamic administrative roles (`Role`, `Permission`, `RolePermission`). Seeding defines 38 authoritative permissions across categories like Products, Inventory, Orders, Promotions, etc.

### 4.2 Order Permission Keys Defined in Database
From `backend/src/modules/admin/roles/backfill-super-admin.ts`:
- `orders.view`: "View orders, order details, stats, and audit history"
- `orders.update_status`: "Update order processing status"
- `orders.add_notes`: "Add operational notes to orders"

### 4.3 Controller Guarding Gap
`AdminOrdersController` line 49–50:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
export class AdminOrdersController { ... }
```
**Key Observations:**
1. `AdminOrdersController` does NOT declare `PermissionsGuard`.
2. No endpoint on `AdminOrdersController` utilizes `@RequirePermissions(...)`.
3. In PostgreSQL, all provisioned administrators (including Super Admin, Project Manager, Product Manager, Order Manager, and Customer Manager) have `role = 'ADMIN'`.
4. As a result, `RolesGuard` grants access to **every endpoint** in `AdminOrdersController` for **all admin accounts**.

### 4.4 Effective Permission Mapping Under Current Implementation

| Administrative Role | Intended Order Access (per Roadmap) | Current Effective Access | Risk Level |
| :--- | :--- | :--- | :--- |
| **Super Admin** | Full sovereignty (all actions) | Full access | Intended |
| **Project Manager** | View, Status Update, Add Notes | Full access (can also modify items, approve/reject returns, issue refunds) | Medium |
| **Order Manager** | View, Status Update, Add Notes | Full access (can also issue refunds, cancel orders, edit items) | High |
| **Customer Manager** | View Orders only (`orders.view`) | **Full access to update status, cancel, edit items, approve returns, and issue refunds!** | **Critical** |
| **Product Manager** | Catalogue only (no order permissions) | **Full access to all order operations!** | **Critical** |

### 4.5 Missing Granular Permission Keys
The database schema has no permission keys defined for:
- Approving or rejecting returns (`orders.manage_returns`).
- Receiving return items / restocking (`orders.confirm_return`).
- Recording refunds (`orders.process_refund`).
- Modifying order line items (`orders.edit_items`).
- Modifying customer/delivery details (`orders.edit_details`).
- Cancelling orders (`orders.cancel`).

---

## 5. Preservation of Existing Functionality

The following existing operational features were verified and must be preserved during implementation:

1. **Order Filters & Query State:**
   - URL parameter synchronization (`page`, `limit`, `status`, `paymentStatus`, `search`, `startDate`, `endDate`, `sortBy`, `sortOrder`).
   - Browser back/forward navigation and link sharing maintain identical filter state.
2. **Real-Time WebSocket Updates:**
   - Namespace `/orders` with events: `order.status.updated`, `order.return.updated`, `order.payment.updated`, `order.cancelled`, `order.items.updated`.
   - `orderSocketService.ts` reconnection handling that triggers authoritative data refetch.
3. **Comprehensive Order Details View:**
   - Fulfilment timeline, customer address snapshot, pricing breakdown with minor units (cents), and line items snapshot.
4. **Order Notes & Internal Comments:**
   - Distinction between customer delivery notes and internal staff annotations (`isInternal: true`).
5. **Existing Cancellation & Refund Logic:**
   - Automatic inventory restoration on cancellation and recording of `CANCELLATION_REFUND` records.

---

## 6. Identified Bugs, Gaps & Risks Summary

| ID | Category | Severity | Description |
| :--- | :--- | :--- | :--- |
| **BUG-01** | API Contract | **High** | Frontend sends `reason` instead of `rejectionReason` in `processReturnAction`, causing rejection notes to be dropped. |
| **BUG-02** | UI / API Contract | **Medium** | Frontend does not send `restockItems` during `CONFIRM_RECEIVED`, precluding staff from marking items non-restockable. |
| **RISK-01** | Inventory Integrity | **Critical** | `processReturnStatus` has no idempotency or status check; multiple calls to `CONFIRM_RECEIVED` repeatedly increment stock. |
| **RISK-02** | Inventory Integrity | **Critical** | `createReturnRequest` does not validate item quantity against ordered quantity or check order delivery status. |
| **RISK-03** | Financial Safety | **Critical** | `processRefund` does not verify that order is paid, and does not sum cumulative refunds, allowing refunds to exceed total paid. |
| **RISK-04** | Financial Safety | **High** | Any partial refund forces order payment status to `REFUNDED`. |
| **RISK-05** | Financial Safety | **High** | `updateOrderItems` alters financial totals on already `PAID` orders without flagging underpayment or initiating refund/balance workflows. |
| **GAP-01** | Security / RBAC | **Critical** | `AdminOrdersController` lacks `PermissionsGuard`; Customer Managers and Product Managers can process refunds and edit orders. |
| **GAP-02** | Audit Integrity | **High** | `InventoryMovement` entries created on cancellation and return restock hardcode `previousQuantity: 0`. |
| **GAP-03** | Resilience | **Medium** | Frontend `orderService.ts` silently swallows API errors for audit history and return requests, masking server failures. |
| **GAP-04** | UX / Features | **Medium** | Missing standalone refund modal on order detail page (refunds are only accessible via order cancellation). |

---

## 7. Recommended Implementation Plan (Phase 1 Fixes)

### Step 1: Align Frontend and Backend Return Contracts
- Update `frontend/src/services/orderService.ts`:
  ```typescript
  public async processReturnAction(
    orderId: string,
    returnId: string,
    action: 'APPROVE' | 'REJECT' | 'CONFIRM_RECEIVED',
    payload?: { rejectionReason?: string; restockItems?: boolean }
  ): Promise<{ success: boolean; data?: any; error?: string }>
  ```
- Update `frontend/src/components/admin/orders/ReturnManagementCard.tsx`:
  - When rejecting: send `{ rejectionReason }`.
  - When confirming receipt: provide a checkbox *"Restock returned items to catalogue inventory"* (defaults to checked) and send `{ restockItems: boolean }`.
  - Remove stale "backend pending" messages.

### Step 2: Implement Return State Machine & Idempotency Guards
- In `backend/src/modules/orders/admin-orders.service.ts`:
  - Define permitted return status transitions:
    - `PENDING -> [APPROVED, REJECTED]`
    - `APPROVED -> [COMPLETED]`
    - `REJECTED -> []`
    - `COMPLETED -> []`
  - In `processReturnStatus`:
    - Reject any action if `returnReq.status` is `COMPLETED` or `REJECTED`.
    - If `action === 'CONFIRM_RECEIVED'`, ensure `returnReq.status === ReturnStatus.APPROVED`.
    - Guard stock increment: check if `orderReturnItem.receivedAt` is already set before incrementing.
    - When creating `InventoryMovement`, fetch the actual current product/variant stock to record accurate `previousQuantity` and `newQuantity`.
  - In `createReturnRequest`:
    - Ensure `order.orderStatus === OrderStatus.DELIVERED`.
    - Validate `it.quantity <= matched.quantity`.
    - Check whether previous return requests for this order already returned these items.

### Step 3: Implement Financial Safety Guards on Refunds
- In `backend/src/modules/orders/admin-orders.service.ts` (`processRefund`):
  - Ensure `order.paymentStatus === PaymentStatus.PAID || order.paymentStatus === PaymentStatus.REFUNDED`.
  - Calculate total previously refunded:
    ```typescript
    const existingRefunds = await this.prisma.refundRecord.aggregate({
      _sum: { amountCents: true },
      where: { orderId: order.id },
    });
    const totalRefundedSoFar = existingRefunds._sum.amountCents || 0;
    const remainingRefundable = order.totalCents - totalRefundedSoFar;
    if (dto.amountCents > remainingRefundable) {
      throw new BadRequestException(
        `Refund amount exceeds remaining refundable balance (Rs. ${(remainingRefundable / 100).toFixed(2)})`
      );
    }
    ```
  - Only set `order.paymentStatus = PaymentStatus.REFUNDED` when `totalRefundedSoFar + dto.amountCents >= order.totalCents`.

### Step 4: Correct Inventory Movement Logging
- In `cancelOrder` and `processReturnStatus`, read the current product `stockQuantity` from the database prior to updating:
  - `previousQuantity = currentProd.stockQuantity`
  - `newQuantity = currentProd.stockQuantity + item.quantity`

### Step 5: Connect PermissionsGuard to Admin Orders
- Add missing order permissions to database seed (`orders.manage_returns`, `orders.process_refund`, `orders.cancel`, `orders.edit_items`).
- Apply `PermissionsGuard` to `AdminOrdersController` alongside `JwtAuthGuard`.
- Decorate endpoints:
  - `GET /admin/orders*`: `@RequirePermissions('orders.view')`
  - `PATCH /admin/orders/:id/status`: `@RequirePermissions('orders.update_status')`
  - `POST /admin/orders/:id/notes`: `@RequirePermissions('orders.add_notes')`
  - `POST /admin/orders/:id/cancel`: `@RequirePermissions('orders.cancel')`
  - `PATCH /admin/orders/:id/items`: `@RequirePermissions('orders.edit_items')`
  - `PATCH /admin/orders/:id/returns/:returnId/status`: `@RequirePermissions('orders.manage_returns')`
  - `POST /admin/orders/:id/refund`: `@RequirePermissions('orders.process_refund')`

### Step 6: Fix Frontend Error Masking
- In `frontend/src/services/orderService.ts`:
  - Throw or return explicit error objects on failed audit/return queries rather than returning `[]`.
  - Remove fallback to local mock updates in `transitionStatusApi` when backend returns 4xx/5xx errors.
  - Remove stale `isBackendPending` clauses for routes that exist.

---

## 8. Test Cases & Acceptance Criteria

### Test Cases

| Test Case ID | Scope | Test Scenario | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **TC-ORD-01** | Return Rejection | Admin submits rejection with reason *"Items damaged by customer"*. | Payload contains `rejectionReason`. Database updates `order_return_requests.rejectionReason`. Notification contains reason string. |
| **TC-ORD-02** | Return Restock Control | Admin confirms receipt of return with restock unchecked. | Status transitions to `COMPLETED`, `receivedAt` set, product stock remains unchanged, no `InventoryMovement` created. |
| **TC-ORD-03** | Double Restock Prevention | Admin clicks "Confirm Received" twice rapidly or replays request. | First request succeeds. Second request fails with HTTP 400 *"Return request is already completed"*. Inventory increments only once. |
| **TC-ORD-04** | Illegal Return Transition | Admin attempts to approve an already rejected return request. | Request rejected with HTTP 400 *"Invalid return status transition"*. |
| **TC-ORD-05** | Cumulative Refund Limit | Order of Rs. 2,000 has refund of Rs. 1,500. Admin tries to refund another Rs. 800. | Request rejected with HTTP 400 *"Refund amount exceeds remaining balance (Rs. 500.00)"*. |
| **TC-ORD-06** | Unpaid Order Refund Prevention | Admin attempts to issue refund on an unpaid COD or failed card order. | Request rejected with HTTP 400 *"Cannot refund an unpaid order"*. |
| **TC-ORD-07** | Inventory History Integrity | Product stock is 15. Item with qty 2 is returned and restocked. | `InventoryMovement` records `previousQuantity: 15`, `newQuantity: 17`, `changeAmount: 2`. |
| **TC-ORD-08** | RBAC Enforcement | User with role `Customer Manager` (having only `orders.view`) calls `POST /admin/orders/:id/refund`. | Server responds with HTTP 403 Forbidden. |
| **TC-ORD-09** | Filter & URL Preservation | Admin filters by `status=CONFIRMED`, `paymentStatus=PAID`, refreshes page. | Page loads with identical filters active, URL parameters intact, and filtered data rendered. |
| **TC-ORD-10** | WebSocket Reconnection | Order status updated in another session while socket is disconnected. | On socket reconnect, `onReconnect` fires and refreshes authoritative order state. |

### Acceptance Criteria
- [ ] No return action discards administrative rejection reasons.
- [ ] No scenario exists where physical or variant inventory is restocked more than once for a single return item.
- [ ] Total refund records for any order cannot exceed the amount actually paid.
- [ ] Replaying or double-clicking any return, cancel, or refund action is strictly idempotent.
- [ ] All order mutating endpoints require explicit, verified permissions.
- [ ] Audit logs and inventory movements accurately record previous and new balances.
- [ ] No regression occurs in existing filter toolbar, URL synchronization, or WebSocket live updates.

