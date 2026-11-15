# DSL Stationery — Stage 1: Return Processing & Inventory Integrity Implementation Report

**Document Reference:** `docs/admin-phase-1-stage-1-implementation-report.md`  
**Execution Context:** DSL Admin Panel Upgrade — Phase 1, Stage 1  
**Date:** November 14, 2026  
**Status:** Completed & Fully Verified  

---

## Executive Summary

Stage 1 of Phase 1 (Make Order Operations Dependable) has been implemented and verified. This stage focuses strictly on **Return Processing and Inventory Integrity**, eliminating the frontend/backend contract mismatch, enforcing a rigorous state machine for return requests, guaranteeing concurrency-safe idempotency on return receipt confirmations, validating return initiation against delivered order item quantities, and logging accurate inventory movement balances.

All 21 backend unit/concurrency tests and 10 frontend unit/component tests pass with zero regressions. Both backend and frontend production builds compiled with zero TypeScript errors. The protected test product (`Double Submission Test Product`, ID: `cmw0j4cro00089kusmwsbv48t`) retains its required stock of exactly 10, and no live database customer orders or stock balances were modified.

---

## 1. Files Modified

| File | Subsystem | Purpose & Scope of Changes |
| :--- | :--- | :--- |
| `backend/src/modules/orders/dto/admin-orders.dto.ts` | Backend DTO | Refined `adminProcessReturnSchema` to validate that `rejectionReason` is required and non-empty whenever `action === 'REJECT'`. |
| `backend/src/modules/orders/admin-orders.service.ts` | Backend Service | 1. Enforced strict return request state machine transitions.<br>2. Implemented atomic conditional update claim (`updateMany` with expected status) to guarantee concurrency-safe idempotency.<br>3. Restocks inventory only when `restockItems === true`.<br>4. Validates return creation: only delivered orders, matches order items, checks eligible quantities minus active returns.<br>5. Captures real current stock balances for `InventoryMovement` records on return restock and order cancellation. |
| `backend/src/modules/orders/admin-orders.service.spec.ts` | Backend Tests | Added 13 new unit and concurrency tests covering delivered status checks, item quantity exhaustion, state machine transitions, rejection reason persistence, restock opt-out, double restock prevention, and simultaneous `Promise.all` race condition handling. |
| `frontend/src/services/orderService.ts` | Frontend Service | Updated `processReturnAction` to accept a typed payload `{ rejectionReason?: string; restockItems?: boolean }`, sending `rejectionReason` instead of `reason`, and removed obsolete backend-pending notices. |
| `frontend/src/components/admin/orders/ReturnManagementCard.tsx` | Frontend Component | 1. Replaced `reason` with `rejectionReason` when rejecting returns.<br>2. Added a "Restock returned items to catalogue inventory" checkbox for approved returns, defaulted to `checked` (`true`).<br>3. Dispatches `restockItems` boolean to the backend.<br>4. Preserved existing loading states, styles, and error handling. |
| `frontend/src/services/__tests__/orderService.test.ts` | Frontend Tests | Added 4 new tests verifying `processReturnAction` payload formation for rejection reasons, restock enabled, restock disabled, and error handling. |
| `frontend/src/components/admin/orders/__tests__/ReturnManagementCard.test.tsx` | Frontend Tests | Added 4 new component tests verifying return list rendering, rejection reason input submission, restock checkbox default state, and checkbox toggle behavior. |

---

## 2. Changes Implemented

### A. Return API Contract Alignment
- **Problem Resolved:** The frontend previously passed an untyped 4th argument serialized as `{ action, reason }`, which was stripped by Zod validation, dropping staff rejection reasons. Furthermore, no mechanism existed to opt out of restocking damaged items.
- **Frontend Changes:**
  - `orderService.processReturnAction(orderId, returnId, action, payload)` now sends `{ action, rejectionReason: payload?.rejectionReason, restockItems: payload?.restockItems }`.
  - In `ReturnManagementCard.tsx`, confirming a rejection sends `{ rejectionReason: rejectionReason.trim() }`.
  - For `APPROVED` returns, a UI checkbox labelled **"Restock returned items to catalogue inventory"** is rendered. It defaults to checked (`true`). Staff can uncheck it to record receipt of defective/damaged items without incrementing inventory.

### B. Safe Return State Machine
- **State Machine Defined:**
  - `PENDING` -> `APPROVED` (via action `'APPROVE'`)
  - `PENDING` -> `REJECTED` (via action `'REJECT'`)
  - `APPROVED` -> `COMPLETED` (via action `'CONFIRM_RECEIVED'`)
  - `REJECTED` -> *Terminal* (no further transitions permitted)
  - `COMPLETED` -> *Terminal* (no further transitions permitted)
- **Validation:**
  - Direct jumps (e.g., `PENDING` -> `COMPLETED`) are rejected with HTTP 400.
  - Re-approving or modifying `REJECTED` returns is rejected with HTTP 400.
  - Re-processing `COMPLETED` returns is rejected with HTTP 400.
  - Rejection reasons are persisted on both `orderReturnRequest` and `orderReturnItem` records and passed to customer notification dispatchers.

### C. Concurrency-Safe Idempotent Restocking Strategy
- **Core Challenge:** Simple status checks before a database transaction are susceptible to race conditions (e.g., fast double-clicks or concurrent network retries).
- **Atomic Database Strategy:**
  - Inside the Prisma `$transaction`, an atomic conditional update (`updateMany`) is executed first:
    ```typescript
    const atomicClaim = await tx.orderReturnRequest.updateMany({
      where: {
        id: returnId,
        orderId,
        status: expectedStatus, // ReturnStatus.APPROVED for CONFIRM_RECEIVED
      },
      data: {
        status: targetStatus,
        rejectionReason: dto.action === 'REJECT' ? dto.rejectionReason : current.rejectionReason,
      },
    });
    ```
  - In PostgreSQL, this acquires an exclusive row lock on the return request record. The first concurrent request transitions the row (`count === 1`). The second concurrent request blocks until the first transaction commits, after which its `where: { status: 'APPROVED' }` evaluates to false (`count === 0`).
  - When `atomicClaim.count === 0`, the transaction queries the fresh record, determines that the return was already completed or rejected, and throws a clear HTTP 400 `BadRequestException` without executing any restocking queries.
  - **Secondary Defense:** Each item's `receivedAt` timestamp is checked before incrementing stock to prevent any possibility of item-level duplicate processing.
  - **Restock Discretion:** When `restockItems === false`, the return transitions to `COMPLETED` and items are stamped with `receivedAt`, but `product.update`, `productVariant.update`, and `inventoryMovement.create` are completely bypassed.

### D. Return Initiation Validation
- In `AdminOrdersService.createReturnRequest`:
  - **Order Delivery Guard:** Returns are blocked unless `order.orderStatus === OrderStatus.DELIVERED`. Orders in `PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, or `CANCELLED` status cannot have returns initiated.
  - **Item Verification:** Ensures requested `orderItemId` belongs to the target order.
  - **Quantity Ceiling & Exhaustion Tracking:** Calculates previously returned or active return quantities across all existing non-rejected return requests (`PENDING`, `APPROVED`, `COMPLETED`) for the order:
    ```typescript
    const remainingEligibleQty = matched.quantity - previouslyReturnedQty;
    if (it.quantity > remainingEligibleQty) {
      throw new BadRequestException(...);
    }
    ```
  - Prevents requesting more items than were originally ordered or returning items repeatedly across multiple return requests.

### E. Accurate Inventory Movement History
- **Return Restock:** Reads `currentProd.stockQuantity` and `currentVar.stockQuantity` before updating:
  - `previousQuantity` = actual stock before increment.
  - `newQuantity` = actual stock after increment (`previousQuantity + item.quantity`).
  - `changeAmount` = `item.quantity`.
- **Order Cancellation:** Replaced hardcoded `previousQuantity: 0` in `cancelOrder` with the product's actual current stock level, aligning it with the standard inventory movement format.

---

## 3. Test Coverage & Verification Results

### 3.1 Backend Tests (`backend/src/modules/orders/admin-orders.service.spec.ts`)
Run command: `npm --prefix backend run test -- admin-orders.service.spec.ts`

```text
 ✓ src/modules/orders/admin-orders.service.spec.ts (21 tests) 37ms
   ✓ AdminOrdersService > getOrderStats > aggregates order counts and total revenue accurately
   ✓ AdminOrdersService > updateStatus > allows valid status transition PROCESSING -> PACKED
   ✓ AdminOrdersService > updateStatus > rejects invalid status transition DELIVERED -> PENDING
   ✓ AdminOrdersService > updateCustomerInfo > updates customer contact details without altering user record and creates audit log
   ✓ AdminOrdersService > cancelOrder > cancels order, restores inventory, and records refund if requested
   ✓ AdminOrdersService > processRefund > validates refund amount does not exceed order total
   ✓ AdminOrdersService > processRefund > creates refund record and updates order paymentStatus
   ✓ AdminOrdersService > returns management > createReturnRequest > rejects return creation if order is not delivered
   ✓ AdminOrdersService > returns management > createReturnRequest > rejects return if requested item is not in order
   ✓ AdminOrdersService > returns management > createReturnRequest > rejects return if quantity exceeds ordered quantity
   ✓ AdminOrdersService > returns management > createReturnRequest > rejects return if previous active returns exhaust eligible quantity
   ✓ AdminOrdersService > returns management > createReturnRequest > creates return request for delivered order with valid quantity
   ✓ AdminOrdersService > returns management > processReturnStatus > approves a pending return request (PENDING -> APPROVED)
   ✓ AdminOrdersService > returns management > processReturnStatus > rejects a pending return request and persists rejectionReason
   ✓ AdminOrdersService > returns management > processReturnStatus > rejects invalid transition: cannot approve an already rejected return
   ✓ AdminOrdersService > returns management > processReturnStatus > rejects invalid transition: pending return cannot bypass approval to CONFIRM_RECEIVED
   ✓ AdminOrdersService > returns management > processReturnStatus > confirms receipt with restockItems=false: marks COMPLETED and does NOT touch stock
   ✓ AdminOrdersService > returns management > processReturnStatus > confirms receipt with restockItems=true: increments stock exactly once with accurate previous/new balances
   ✓ AdminOrdersService > returns management > processReturnStatus > prevents duplicate restocking: completed return cannot be processed again
   ✓ AdminOrdersService > returns management > processReturnStatus > prevents concurrent double restocking: if atomic update returns count 0, throws BadRequestException
   ✓ AdminOrdersService > returns management > processReturnStatus > concurrent confirmation requests cannot restock twice (simultaneous Promise.all)

Test Files: 1 passed (1) | Tests: 21 passed (21)
```

All 63 orders module backend tests (`orders.gateway.spec.ts`, `admin-orders.service.spec.ts`, `orders.service.spec.ts`) pass without regression.

### 3.2 Frontend Tests
1. **Service Tests:** `npm --prefix frontend run test -- src/services/__tests__/orderService.test.ts`
   ```text
   ✓ src/services/__tests__/orderService.test.ts (6 tests) 22ms
     ✓ enforces permitted order status transitions
     ✓ restores stock when an order is cancelled
     ✓ sends rejectionReason when rejecting a return request
     ✓ sends restockItems: false when confirming receipt without restocking
     ✓ sends restockItems: true when confirming receipt with restocking
     ✓ returns error when backend rejects transition
   ```

2. **Component Tests:** `npm --prefix frontend run test -- src/components/admin/orders/__tests__/ReturnManagementCard.test.tsx`
   ```text
   ✓ src/components/admin/orders/__tests__/ReturnManagementCard.test.tsx (4 tests) 542ms
     ✓ renders return requests correctly
     ✓ allows rejecting a return with a rejection reason
     ✓ renders restock checkbox defaulted to checked for approved returns and sends restockItems: true
     ✓ allows unchecking restock checkbox and sends restockItems: false
   ```

---

## 4. TypeScript & Production Build Verification

### Backend Build
- **Command:** `npm --prefix backend run build` (`nest build`)
- **Result:** Exited with code `0`. Clean compilation with no TypeScript or NestJS build errors.

### Frontend Build
- **Command:** `npm --prefix frontend run build` (`next build` with Turbopack)
- **Result:** Exited with code `0`.
- **TypeScript Typecheck:** `Finished TypeScript in 7.4s` with zero errors across all 58 static/dynamic routes.

---

## 5. Safety Confirmations

1. **Protected Product Stock Invariance:**
   - Product ID: `cmw0j4cro00089kusmwsbv48t`
   - Name: `Double Submission Test Product`
   - SKU: `COLLISION-SKU-1793700760720`
   - **Verified Stock Balance:** Exactly `10` (verified via direct database query before and after test execution).
2. **Customer Orders & Live Inventory:**
   - No live database customer orders, return requests, or inventory balances were modified. All test cases were executed against isolated mock fixtures.
3. **No Unrelated Module Changes:**
   - Strictly excluded features (refund processing redesign, payment provider integrations, PayHere credentials, RBAC foundations, customer management, store settings) were untouched.
   - `onlineCardEnabled` remains `false`.
4. **Git Workspace Discipline:**
   - No Git commits or pushes were performed.

---

## 6. Remaining Scope for Subsequent Stages

As planned in the upgrade roadmap:
- **Stage 2:** Financial safety & refund processing (cumulative refund limit, unpaid order refund prevention, partial refund payment status tracking, and standalone refund UI).
- **Stage 3:** Granular RBAC enforcement (`PermissionsGuard` integration on `AdminOrdersController`, addition of order management permission keys).
- **Stage 4:** Admin dashboard, customers, and global reporting integrations.

