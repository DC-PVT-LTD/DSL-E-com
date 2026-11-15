# DSL Stationery Admin — Stage 1 Final Technical Verification Report

**Review Date:** 2026-11-14  
**Scope:** Stage 1: Secure Order Returns and Inventory Restocking  
**Reference Document:** `docs/admin-phase-1-stage-1-implementation-report.md`  
**Inspected Source Files:**
- `backend/src/modules/orders/admin-orders.service.ts`
- `backend/src/modules/orders/admin-orders.service.spec.ts`
- `backend/src/modules/orders/dto/admin-orders.dto.ts`
- `frontend/src/services/orderService.ts`
- `frontend/src/components/admin/orders/ReturnManagementCard.tsx`

---

## Executive Summary & Verdict

### Final Verdict: **PASS WITH LIMITATIONS**

The Stage 1 implementation successfully addresses the primary requirements defined in the specification:
1. The frontend-to-backend contract mismatch is fully resolved (`rejectionReason` and `restockItems` properly typed, validated with Zod, and transmitted).
2. The return state machine is strictly enforced (`PENDING` → `APPROVED` / `REJECTED`, `APPROVED` → `COMPLETED`, terminal states protected).
3. Concurrency protection against duplicate return confirmations and duplicate restocking utilizes an atomic database condition (`updateMany` with `status: expectedStatus`) inside a Prisma transaction.
4. Item-level receipt guards (`receivedAt`) provide defense-in-depth against duplicate restocking.
5. All backend and frontend unit tests compile and pass cleanly, and both Next.js and NestJS production builds succeed with exit code 0.

However, three distinct technical limitations have been identified during this inspection that prevent an unconditional "PASS":
1. **Mocked Concurrency Test:** The test asserting concurrent return protection runs against Vitest in-memory mocks (`mockResolvedValueOnce({ count: 1 })` / `mockResolvedValueOnce({ count: 0 })`), which proves the service logic branch but does **not** provide empirical proof of PostgreSQL row-locking behavior under true multi-socket concurrency.
2. **Snapshot Skew in Inventory Movement Records:** In `processReturnStatus` and `cancelOrder`, `previousQuantity` is fetched via an un-locked `findUnique` query prior to the atomic `{ increment: item.quantity }` statement. Under concurrent stock modifications on the same product, the recorded `previousQuantity` in `InventoryMovement` may differ from the actual database stock column immediately prior to the increment.
3. **Concurrent Return-Creation Race Condition in `createReturnRequest`:** The remaining eligible quantity check evaluates uncommitted state in `Read Committed` isolation without an exclusive row lock on the parent `Order`. Two simultaneous return requests for the same order item can both pass validation and exceed the ordered quantity.

---

## 1. Verified Concurrency Strategy

### 1.1 Atomic Conditional Claim in `processReturnStatus`
The return confirmation and restocking logic in `AdminOrdersService.processReturnStatus` (`backend/src/modules/orders/admin-orders.service.ts`, lines 1118–1294) employs an atomic conditional claim strategy.

#### Evidence from Source Code (`admin-orders.service.ts:1132-1216`):
```typescript
const updated = await this.prisma.$transaction(async (tx) => {
  // 1. Enforce return state machine transitions
  const current = await tx.orderReturnRequest.findUnique({
    where: { id: returnId },
    include: { items: true, order: true },
  });
  if (!current || current.orderId !== orderId) {
    throw new NotFoundException(`Return request "${returnId}" not found for this order`);
  }

  // Pre-condition validation for requested action...
  let expectedStatus: ReturnStatus;
  let targetStatus: ReturnStatus;
  let itemStatus: ReturnItemStatus;
  // For CONFIRM_RECEIVED: expectedStatus = APPROVED; targetStatus = COMPLETED;

  // 2. Concurrency-safe atomic conditional update to claim this state transition
  const atomicClaim = await tx.orderReturnRequest.updateMany({
    where: {
      id: returnId,
      orderId,
      status: expectedStatus, // 'APPROVED'
    },
    data: {
      status: targetStatus,   // 'COMPLETED'
      rejectionReason: dto.action === 'REJECT' ? dto.rejectionReason : current.rejectionReason,
    },
  });

  if (atomicClaim.count === 0) {
    const fresh = await tx.orderReturnRequest.findUnique({ where: { id: returnId } });
    if (fresh?.status === ReturnStatus.COMPLETED) {
      throw new BadRequestException(
        `Return request "${current.returnNumber}" has already been completed and cannot be processed again.`
      );
    }
    // ...
    throw new BadRequestException(
      `Invalid return status transition. Return "${current.returnNumber}" is currently in status "${fresh?.status}".`
    );
  }

  // 3. Update return items...
  // 4. Restock inventory if and only if restockItems is true...
```

### 1.2 Step-by-Step Concurrency Verification

| Criteria | Code Location | Verification Result | Details |
| :--- | :--- | :--- | :--- |
| **Transaction Boundary** | `admin-orders.service.ts:1132` | **VERIFIED** | The `atomicClaim` and all subsequent item updates, product increments, variant increments, inventory movements, and audit log entries run inside the exact same `this.prisma.$transaction(async (tx) => { ... })`. |
| **Atomic Expected Status Condition** | `admin-orders.service.ts:1189-1199` | **VERIFIED** | The `updateMany` query specifies `status: expectedStatus` (`APPROVED` for `CONFIRM_RECEIVED`). In PostgreSQL, this translates to an atomic `UPDATE ... WHERE id = $1 AND status = 'APPROVED'`. |
| **Mutual Exclusion on Concurrent Requests** | PostgreSQL Row Lock | **VERIFIED** | When two concurrent requests enter the transaction simultaneously, PostgreSQL forces the second transaction to wait on the row lock held by the first transaction's `UPDATE`. When the first transaction commits (`status` becomes `COMPLETED`), the second transaction re-evaluates the `WHERE status = 'APPROVED'` condition, finds 0 matching rows, and returns `count: 0`. |
| **Immediate Exit on Failed Claim** | `admin-orders.service.ts:1201-1216` | **VERIFIED** | If `atomicClaim.count === 0`, a `BadRequestException` is thrown immediately. Execution terminates before reaching line 1219 (no item status update, no stock increment, no movement created). |
| **Atomic Rollback on Restocking Failure** | Prisma `$transaction` | **VERIFIED** | If an exception occurs during product update, variant update, or movement creation (lines 1228–1269), the entire transaction aborts, automatically rolling back the return status transition from `COMPLETED` back to `APPROVED`. |
| **Secondary Item-Level Idempotency Guard** | `admin-orders.service.ts:1231-1233` | **VERIFIED** | `if (item.receivedAt) continue;` ensures that if individual items were previously stamped as received, they are bypassed, preventing duplicate inventory increments at the item level. |

---

## 2. Test Suite Investigation: Mocks vs. Real PostgreSQL

### 2.1 Test Code Inspection
Inspecting `backend/src/modules/orders/admin-orders.service.spec.ts` (lines 8–71, 707–748):

```typescript
// lines 8-12: Mock declarations
let mockPrisma: any;
let mockOrdersGateway: any;
let mockInventoryGateway: any;
let mockNotificationsService: any;

// line 70: In-memory mock transaction runner
$transaction: vi.fn(async (cb) => cb(mockPrisma)),

// lines 707-748: The concurrency test
it('concurrent confirmation requests cannot restock twice (simultaneous Promise.all)', async () => {
  mockPrisma.orderReturnRequest.updateMany
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValueOnce({ count: 0 });
  
  const p1 = service.processReturnStatus('ord-6', 'ret-concurrent', { action: 'CONFIRM_RECEIVED', restockItems: true }, ...);
  const p2 = service.processReturnStatus('ord-6', 'ret-concurrent', { action: 'CONFIRM_RECEIVED', restockItems: true }, ...);

  const results = await Promise.allSettled([p1, p2]);
  // ...
  expect(mockPrisma.product.update).toHaveBeenCalledTimes(1);
});
```

### 2.2 Finding & Distinction
- **Nature of the Test:** The existing `Promise.all` test is an **in-memory Vitest unit test utilizing mock functions**.
- **What it Proves:** It proves that **if** the database driver returns `{ count: 1 }` for one call and `{ count: 0 }` for the other, the service logic correctly fulfills the first promise, throws a `BadRequestException` on the second, and executes `product.update` exactly once.
- **What it Does NOT Prove:** It does **not** prove PostgreSQL's actual concurrency behavior. It does not establish TCP/Unix socket connections to PostgreSQL, does not test MVCC snapshot isolation, does not test transaction locking behavior (`FOR UPDATE` / row-level locks), and does not test deadlocks or serialization failures.
- **Conclusion:** It is technically inaccurate to cite this unit test as proof of real database concurrency. Real database concurrency safety relies on PostgreSQL's atomic update mechanics, not on the unit test execution.

---

## 3. Inventory Consistency & Movement Accuracy

### 3.1 Return Restocking vs. Cancellation Restoration

We inspected both `processReturnStatus` (`CONFIRM_RECEIVED`) and `cancelOrder`.

#### Code Comparison:

| Dimension | `processReturnStatus` (`admin-orders.service.ts:1229-1268`) | `cancelOrder` (`admin-orders.service.ts:889-922`) |
| :--- | :--- | :--- |
| **Stock Increment** | `tx.product.update({ data: { stockQuantity: { increment: item.quantity } } })` | `tx.product.update({ data: { stockQuantity: { increment: item.quantity } } })` |
| **Variant Increment** | `tx.productVariant.update({ data: { stockQuantity: { increment: item.quantity } } })` | `tx.productVariant.update({ data: { stockQuantity: { increment: item.quantity } } })` |
| **Atomic SQL Execution** | Yes: Translates to `SET "stockQuantity" = "stockQuantity" + $1` | Yes: Translates to `SET "stockQuantity" = "stockQuantity" + $1` |
| **Previous Quantity Source** | `const currentProd = await tx.product.findUnique(...)` | `const currentProd = await tx.product.findUnique(...)` |
| **Calculated New Quantity** | `prevProdQty + item.quantity` | `prevProdQty + item.quantity` |
| **Inventory Movement Reason** | `InventoryChangeReason.RESTOCK` | `InventoryChangeReason.RESTOCK` |
| **Transactional Atomicity** | Enclosed in single `tx` | Enclosed in single `tx` |

### 3.2 Findings & Edge Cases

1. **Stock Increment Atomicity:**
   - Both return restocking and cancellation use Prisma's atomic `{ increment: item.quantity }` modifier.
   - At the SQL level in PostgreSQL, this generates an atomic arithmetic update (`stockQuantity = stockQuantity + $1`), which avoids lost updates even under high concurrency.
2. **Transactional All-or-Nothing Guarantee:**
   - Product stock, variant stock, inventory movement records, and return/order status updates are committed or rolled back together within the database transaction (`tx`). Neither partial restocking nor orphaned movement records can occur.
3. **Movement History Snapshot Skew (Limitation):**
   - The value stored in `previousQuantity` is obtained by querying `tx.product.findUnique(...)` **prior** to running `tx.product.update({ increment })`.
   - Because `findUnique` does not issue `SELECT ... FOR UPDATE`, it does not lock the product row during read.
   - If an independent checkout or manual inventory adjustment executes between the `findUnique` read and the `product.update` write, the `previousQuantity` written to `InventoryMovement` reflects the read snapshot, while the actual live physical stock at the instant of increment will have shifted.
   - *Severity: Minor/Auditing Only.* The physical product stock remains mathematically correct; only the audit trail's reported intermediate balance can become slightly skewed under concurrent product stock alterations.

---

## 4. Concurrent Return-Creation Race Condition in `createReturnRequest`

### 4.1 Code Inspection (`admin-orders.service.ts:1033-1064`)
```typescript
const returnReq = await this.prisma.$transaction(async (tx) => {
  // Find all existing return requests for this order that are not REJECTED
  const existingReturns = await tx.orderReturnRequest.findMany({
    where: {
      orderId: order.id,
      status: { in: [ReturnStatus.PENDING, ReturnStatus.APPROVED, ReturnStatus.COMPLETED] },
    },
    include: { items: true },
  });

  for (const it of dto.items) {
    const matched = order.items.find((oi) => oi.id === it.orderItemId);
    // ...
    const previouslyReturnedQty = existingReturns
      .flatMap((r) => r.items)
      .filter((ri) => ri.orderItemId === it.orderItemId)
      .reduce((sum, ri) => sum + ri.quantity, 0);

    const remainingEligibleQty = matched.quantity - previouslyReturnedQty;
    if (it.quantity > remainingEligibleQty) {
      throw new BadRequestException(
        `Cannot return ${it.quantity} unit(s) of "${matched.productName}". Only ${remainingEligibleQty} eligible unit(s) remaining...`
      );
    }
  }

  const created = await tx.orderReturnRequest.create({ ... });
  // ...
});
```

### 4.2 Race Condition Analysis
- **Scenario:** An order contains 2 units of Item A. A customer or staff member opens two browser tabs or double-clicks "Submit Return" simultaneously, each requesting 2 units of Item A.
- **Database Behavior under Default Isolation (`Read Committed`):**
  1. Transaction 1 begins and queries `tx.orderReturnRequest.findMany`. It finds 0 existing returns. `previouslyReturnedQty = 0`, `remainingEligibleQty = 2`. The check passes.
  2. Transaction 2 begins concurrently and queries `tx.orderReturnRequest.findMany`. Because Transaction 1 has not yet committed, Transaction 2 does not see Transaction 1's uncommitted rows. `previouslyReturnedQty = 0`, `remainingEligibleQty = 2`. The check passes.
  3. Transaction 1 executes `tx.orderReturnRequest.create(...)` with quantity 2 and commits.
  4. Transaction 2 executes `tx.orderReturnRequest.create(...)` with quantity 2 and commits.
- **Result:** Two return requests exist with a combined return quantity of 4 units, exceeding the 2 ordered units.
- **Mitigation Requirement for Future Phases:**
  To guarantee complete concurrency protection during return creation, the parent `Order` row should be locked at the start of the transaction using a raw query (e.g., `tx.$executeRaw` with `SELECT 1 FROM "Order" WHERE id = $1 FOR UPDATE`), or an order version field must be conditionally updated.

---

## 5. Summary of Remaining Risks & Limitations

| Risk / Limitation | Component | Technical Mechanism | Impact / Severity | Recommended Future Action |
| :--- | :--- | :--- | :--- | :--- |
| **Unit Mock Reliance** | `admin-orders.service.spec.ts` | Vitest mocks simulate `{ count: 1 }` and `{ count: 0 }` rather than testing PostgreSQL row locks. | **Low**: The database mechanics of PostgreSQL `updateMany` are standard and well-understood. | Add integration test suite running against testcontainers / local PostgreSQL instance. |
| **Audit Movement Snapshot Skew** | `processReturnStatus` & `cancelOrder` | `previousQuantity` read via `findUnique` without `FOR UPDATE` lock before atomic `{ increment }`. | **Low**: Stock balance is always accurate; audit movement record might show a pre-increment snapshot skew if concurrent stock modifications occur. | Acceptable for current scale, or acquire row lock on `Product` if strict ledger tracking is required. |
| **Concurrent Return Request Race** | `createReturnRequest` | `findMany` quantity check is susceptible to phantom/uncommitted reads under `Read Committed` isolation. | **Medium**: Rapid duplicate clicks on return submission could create duplicate return requests exceeding ordered quantity. | In Stage 2/3, introduce `SELECT ... FOR UPDATE` on the parent `Order` row inside `createReturnRequest`. |

---

## 6. Detailed File-by-File Verification Evidence

### 1. `backend/src/modules/orders/dto/admin-orders.dto.ts`
- **Lines 85–101:** `adminProcessReturnSchema` defines:
  - `action`: `z.enum(['APPROVE', 'REJECT', 'CONFIRM_RECEIVED'])`
  - `rejectionReason`: `z.string().trim().optional()`
  - `restockItems`: `z.boolean().default(true)`
  - `superRefine`: Strictly enforces that `rejectionReason` must be present and non-empty when `action === 'REJECT'`.

### 2. `frontend/src/services/orderService.ts`
- **Lines 669–694:** `processReturnAction` signature:
  ```typescript
  public async processReturnAction(
    orderId: string,
    returnId: string,
    action: 'APPROVE' | 'REJECT' | 'CONFIRM_RECEIVED',
    payload?: {
      rejectionReason?: string;
      restockItems?: boolean;
    }
  ): Promise<{ success: boolean; data?: any; error?: string }>
  ```
  Properly passes `{ action, rejectionReason: payload?.rejectionReason, restockItems: payload?.restockItems }` to `PATCH /admin/orders/${orderId}/returns/${returnId}/status`.

### 3. `frontend/src/components/admin/orders/ReturnManagementCard.tsx`
- **Lines 32–37:** `restockMap` state initialized with helper `isRestockChecked` defaulting to `true`.
- **Lines 171–230:** Rejection UI requires non-empty `rejectionReason` before enabling the "Confirm Rejection" button and transmits `rejectionReason.trim()`.
- **Lines 231–257:** Receipt confirmation UI renders a checkbox labelled `"Restock returned items to catalogue inventory"` (defaulting to checked) and forwards `restockItems: isRestockChecked(ret.id)` on click.
- **Lines 95–103:** Obsolete backend-pending warning messages removed for working endpoints.

### 4. `backend/src/modules/orders/admin-orders.service.ts`
- **Lines 1025–1029:** Rejects return creation if `order.orderStatus !== OrderStatus.DELIVERED`.
- **Lines 1051–1061:** Calculates cumulative requested/returned quantities across non-rejected returns and blocks excess quantities.
- **Lines 1142–1150:** Forbids further transitions from `COMPLETED` or `REJECTED` returns.
- **Lines 1157–1186:** Restricts `APPROVE` and `REJECT` to `PENDING` returns; restricts `CONFIRM_RECEIVED` to `APPROVED` returns.
- **Lines 1189–1216:** Atomic `updateMany` claim inside the transaction; aborts with HTTP 400 if claimed by a concurrent request.
- **Lines 1228–1269:** Restocks product and variant inventory and creates `InventoryMovement` with actual quantities if and only if `restockItems === true`.

---

## 7. Verification Sign-Off

The technical implementation of Stage 1 meets all defined functional requirements and significantly hardens return management and inventory integrity. The limitations identified above are documented and catalogued for future development phases. Stage 1 is ready for operational deployment upon user review.

