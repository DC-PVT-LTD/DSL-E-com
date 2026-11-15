# DSL Stationery Admin — Phase 1, Stage 2.2.1: Refund Authorization & Segregation of Duties (SoD) Implementation Report

**Status:** COMPLETED & VERIFIED  
**Target Environment:** Isolated Test Database (`dsl_stationery_test`)  
**Development Database:** `dsl_stationery` (Untouched, Stock Verified)  
**Date:** 2026-11-14  

---

## 1. Executive Summary & Purpose

In Stage 2.2, backend refund calculation and state transitions were hardened with deterministic row-level locking (`SELECT ... FOR UPDATE`), cumulative verified collection math, and strict idempotency. However, the post-implementation safety audit revealed a critical internal control vulnerability: **a single staff member or administrator could initiate, approve, and finalize a refund without secondary review or dual custody**.

Stage 2.2.1 resolves this weakness by implementing **Backend-Enforced Segregation of Duties (SoD)** across the entire refund lifecycle:
1. **Requester Independence:** An administrator or staff member who creates a refund request or initiates an order cancellation refund (`User A`) is strictly barred from approving (`approveRefund`) or completing (`completeRefund`) that refund. Any attempt raises HTTP 403 `ForbiddenException`.
2. **Dual Custody:** Approval requires an independent authenticated actor (`User B`). Completion requires verification by an independent actor (`User C` or `User B`, where `actor.id !== requestedById`).
3. **Explicit Actor Tracking:** The `RefundRecord` entity was enriched with distinct immutable columns: `requestedById` and `completedById` (alongside existing `approvedById` and `processedById`).
4. **Legacy Record Safety:** Any historical refund record with `requestedById = null` is permanently blocked from approval and completion (`BadRequestException`), preventing untracked, unauthenticated lifecycle mutations.
5. **Actor Identity Mandate:** Unauthenticated calls, missing tokens, or whitespace-only admin IDs are strictly rejected before any transaction begins (`BadRequestException`).

All 47 unit tests and 31 real PostgreSQL concurrency and integration tests passed with zero failures. The development database `dsl_stationery` remains completely untouched.

---

## 2. Audit of Existing Segregation of Duties Gaps

Prior to Stage 2.2.1, the refund system suffered from the following internal control risks:

| Workflow Step | Prior State | Identified Risk | Stage 2.2.1 Mitigation |
| :--- | :--- | :--- | :--- |
| **Request Creation** | `processedById` stored the requester ID | Ambiguous naming; overloaded as requester and processor | Added explicit `requestedById` column; retained `processedById` for backward compatibility |
| **Refund Approval** | Any admin could call `approveRefund` | Self-approval: `admin-1` could request $10,000 and immediately approve it | Requester identity checked against `actor.id`. If matching, throws HTTP 403 `ForbiddenException` |
| **Refund Completion** | Any admin could call `completeRefund` | Self-completion: `admin-1` could request and complete payout without external oversight | Requester identity checked against `actor.id`. If matching, throws HTTP 403 `ForbiddenException` |
| **Actor Identity** | Optional or unvalidated `actor?.id` | Anonymous or spoofed admin actions | Every refund transition verifies `!actor?.id \|\| !actor.id.trim()`, throwing HTTP 400 `BadRequestException` |
| **Legacy Records** | Nullable `requestedById` | Unattributed historical records could be approved without known requester | Explicit check: `!refund.requestedById` throws HTTP 400 `BadRequestException` requiring manual review |

---

## 3. Data Model Changes (Schema & Prisma Client)

The `RefundRecord` model in `backend/prisma/schema.prisma` was updated:

```prisma
model RefundRecord {
  id                   String              @id @default(cuid())
  orderId              String
  order                Order               @relation(fields: [orderId], references: [id], onDelete: Restrict)
  amountCents          Int
  currency             String              @default("LKR")
  method               String              // e.g. "BANK_TRANSFER", "CARD_PAYHERE", "KOKO_BNPL", "CASH", "STORE_CREDIT"
  status               RefundStatus        @default(REQUESTED)
  reference            String?
  externalReference    String?
  idempotencyKey       String?
  payloadHash          String?
  reason               String
  failureReason        String?
  maskedAccountNumber  String?
  encryptedBankDetails String?
  processedBy          String?
  processedById        String?
  requestedById        String?             // Explicit ID of admin who requested refund/cancellation
  approvedById         String?
  approvedAt           DateTime?
  completedById        String?             // Explicit ID of independent admin who verified execution and completed refund
  completedAt          DateTime?
  orderReturnRequestId String?
  orderReturnRequest   OrderReturnRequest? @relation(fields: [orderReturnRequestId], references: [id], onDelete: Restrict)
  metadata             Json?
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt

  @@unique([orderId, idempotencyKey])
  @@index([orderId])
  @@index([status])
  @@index([orderReturnRequestId])
}
```

### Migration Safety
- Target Database: `dsl_stationery_test` strictly.
- Schema push executed via isolated Node script verifying database URL contains `_test`.
- Prisma Client regenerated in `backend/src/generated/prisma`.

---

## 4. Role-Based Segregation of Duties Implementation

In `backend/src/modules/orders/admin-orders.service.ts`:

### 4.1. Requesting Refunds & Cancellations
When an admin calls `processRefund` or `cancelOrder` with `processRefund: true`:
- Actor identity is required:
  ```typescript
  if (!actor?.id || !actor.id.trim()) {
    throw new BadRequestException('Authenticated admin identity is required to request a refund.');
  }
  ```
- The refund record is created with:
  ```typescript
  requestedById: actor.id,
  processedById: actor.id,
  processedBy: actor.name || 'Admin',
  status: RefundStatus.REQUESTED,
  ```

### 4.2. Approving Refunds (`approveRefund`)
- Actor identity is validated:
  ```typescript
  if (!actor?.id || !actor.id.trim()) {
    throw new BadRequestException('Authenticated admin identity is required to approve a refund.');
  }
  ```
- Legacy / untracked requester check:
  ```typescript
  if (!refund.requestedById) {
    throw new BadRequestException(
      `Legacy or untracked refund "${refundId}" cannot be approved without verifiable requester identity. Manual review is required.`
    );
  }
  ```
- Segregation of Duties guard:
  ```typescript
  if (actor.id === refund.requestedById) {
    throw new ForbiddenException(
      `Segregation of duties violation: The original refund requester (${actor.id}) cannot approve their own refund.`
    );
  }
  ```
- Records `approvedById: actor.id`, `approvedAt: new Date()`.

### 4.3. Completing Refunds (`completeRefund`)
- Actor identity is validated:
  ```typescript
  if (!actor?.id || !actor.id.trim()) {
    throw new BadRequestException('Authenticated admin identity is required to complete a refund.');
  }
  ```
- External reference validation (`!dto.externalReference || !dto.externalReference.trim()`).
- Legacy / untracked requester check:
  ```typescript
  if (!refund.requestedById) {
    throw new BadRequestException(
      `Legacy or untracked refund "${refundId}" cannot be completed without verifiable requester identity. Manual review is required.`
    );
  }
  ```
- Segregation of Duties guard:
  ```typescript
  if (actor.id === refund.requestedById) {
    throw new ForbiddenException(
      `Segregation of duties violation: The original refund requester (${actor.id}) cannot complete their own refund.`
    );
  }
  ```
- Records `completedById: actor.id`, `completedAt: new Date()`.

---

## 5. State Machine & Authorization Matrix

| Action | Current Status | Target Status | Required Actor | Disallowed Actor | HTTP Error on Violation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `processRefund` | *None* | `REQUESTED` | Authenticated Admin / Staff (`User A`) | Unauthenticated / empty ID | 400 `BadRequestException` |
| `cancelOrder` | `CONFIRMED` / `PROCESSING` | `REQUESTED` | Authenticated Admin / Staff (`User A`) | Unauthenticated / empty ID | 400 `BadRequestException` |
| `approveRefund` | `REQUESTED` | `APPROVED` | Independent Admin (`User B`) | Requester (`User A`) | 403 `ForbiddenException` |
| `rejectRefund` | `REQUESTED` / `APPROVED` | `REJECTED` | Authenticated Admin (`User B` or `User A`) | Unauthenticated / empty ID | 400 `BadRequestException` |
| `processRefundExecution` | `APPROVED` | `PROCESSING` | Authenticated Admin (`User B`, `User C`) | Unauthenticated / empty ID | 400 `BadRequestException` |
| `completeRefund` | `PROCESSING` | `COMPLETED` | Independent Admin (`User C` or `User B`) | Requester (`User A`) | 403 `ForbiddenException` |
| `failRefund` | `PROCESSING` | `FAILED` | Authenticated Admin | Unauthenticated / empty ID | 400 `BadRequestException` |

---

## 6. Legacy Record Handling & Backward Compatibility

- **Database Preservation:** No historical records were deleted or modified during migration.
- **Null Safety:** Historical records created prior to Stage 2.2.1 have `requestedById = null`.
- **Enforced Safety Guard:** When attempting to advance a legacy record (`!refund.requestedById`), both `approveRefund` and `completeRefund` immediately abort with:
  > *"Legacy or untracked refund cannot be approved/completed without verifiable requester identity. Manual review is required."*
- **Field Compatibility:** Existing fields `processedById` and `processedBy` remain populated for legacy queries, reporting, and backwards compatibility.

---

## 7. Deterministic Locking & Concurrency Protection

All refund operations continue to use strict PostgreSQL row-level locks:
1. `SELECT ... FOR UPDATE` acquires an exclusive lock on the parent `Order` row before reading or mutating any refund records.
2. Concurrent approval attempts by competing admins serialize sequentially: the first caller transitions the status from `REQUESTED` to `APPROVED`, causing subsequent callers to fail with `BadRequestException: Current status is APPROVED`.
3. Concurrent completion attempts serialize sequentially: the first caller transitions the status from `PROCESSING` to `COMPLETED`, causing subsequent callers to fail with `BadRequestException: Current status is COMPLETED`.

---

## 8. Audit Trail & Non-Repudiation Logging

Every state transition writes an immutable `OrderAuditLog` entry capturing:
- `adminId`: Explicit ID of the acting administrator (`actor.id`).
- `adminName`: Name of the acting administrator (`actor.name`).
- `action`: Specific action (`REFUND_REQUESTED`, `REFUND_APPROVED`, `REFUND_COMPLETED`, etc.).
- `reason`: Comprehensive audit text including requester identity, approver/completer identity, and external references:
  - Approval: `Refund approved by <User B>. Requester: <User A>. <notes>`
  - Completion: `Refund of Rs. <amount> completed by <User C>. Requester: <User A>. Approver: <User B>. External ref: <ref>`

---

## 9. Test Suite Verification (Unit & PostgreSQL Integration)

### 9.1. Unit Test Suite (`backend/src/modules/orders/admin-orders.service.spec.ts`)
- **Total Tests:** 47 passed (0 failed).
- **Execution Time:** ~97 ms.
- **Specific SoD Scenarios Tested:**
  - Requester cannot approve own refund (403 `ForbiddenException`).
  - Independent approver succeeds (200 OK, `approvedById` set).
  - Requester cannot complete own refund (403 `ForbiddenException`).
  - Independent completer succeeds (200 OK, `completedById` set).
  - Approver can also complete if independent from requester.
  - Legacy refund with `requestedById = null` blocked from approval (400 `BadRequestException`).
  - Legacy refund with `requestedById = null` blocked from completion (400 `BadRequestException`).

### 9.2. Real PostgreSQL Integration Test Suite (`backend/src/modules/orders/orders-concurrency.integration.spec.ts`)
- **Total Tests:** 31 passed (0 failed).
- **Execution Time:** ~1.92 s.
- **Specific Stage 2.2.1 Integration Scenarios Verified:**
  - `Scenario A`: User A requests refund $\rightarrow$ User A self-approval blocked with HTTP 403 `ForbiddenException`.
  - `Scenario B`: User A requests refund $\rightarrow$ User B approves successfully (`APPROVED`, `approvedById` recorded, audit log logged).
  - `Scenario C`: User A requests refund $\rightarrow$ User A self-completion blocked with HTTP 403 `ForbiddenException`.
  - `Scenario D`: User A requests $\rightarrow$ User B approves $\rightarrow$ User C completes successfully (`COMPLETED`, `completedById` recorded).
  - `Scenario E`: Dual-custody allowance: User B can complete a refund requested by User A even if User B was the approver.
  - `Scenario F`: Missing or whitespace-only actor identity rejected with HTTP 400 `BadRequestException`.
  - `Scenario G`: Legacy refund record with `requestedById = null` blocked from approval and completion.
  - `Scenario H`: Concurrent approvals by different admins serialize via `FOR UPDATE` and exactly one succeeds.
  - `Scenario I`: Concurrent completions by different admins serialize via `FOR UPDATE` and cannot complete twice.
  - `Scenario J`: Authorization failure (e.g. self-approval attempt) leaves financial balances, order status (`PAID`), and reservations completely unchanged.

---

## 10. Dev Database Integrity & Protection Proof

Integrity verification was executed directly against PostgreSQL instances:

```json
{
  "development": {
    "database": "dsl_stationery",
    "protectedProduct": {
      "id": "cmw0j4cro00089kusmwsbv48t",
      "name": "Double Submission Test Product",
      "stockQuantity": 10
    },
    "orderCount": 2,
    "refundCount": 0
  },
  "test": {
    "database": "dsl_stationery_test",
    "nonNullEncryptedBankDetailsCount": 0
  }
}
```

- Development database `dsl_stationery` remains **100% untouched**.
- Protected product stock quantity remains **exactly 10**.
- Order count remains **exactly 2**.
- Refund count in development remains **0**.
- No unmasked bank account numbers stored; `nonNullEncryptedBankDetailsCount` remains **0**.

---

## 11. Security & Financial Hardening Summary

1. **Dual Custody Enforced:** At least two distinct administrators are mathematically required to issue funds. No single credential compromise can initiate and complete an unauthorized payout.
2. **Deterministic Concurrency:** All operations are strictly guarded by PostgreSQL transaction-level row locks (`FOR UPDATE`), eliminating race conditions in high-throughput environments.
3. **Defense in Depth:** Actor identity and segregation checks are performed both outside the transaction (for rapid rejection) and inside the transaction against locked rows.
4. **Non-Repudiation:** The full actor lineage (`requestedById`, `approvedById`, `completedById`) is persisted in relational columns and duplicated in chronological audit logs.

---

## 12. Risk Assessment & Known Boundaries

| Aspect | Current Status | Boundary / Handling |
| :--- | :--- | :--- |
| **COD Refunds** | Strictly Blocked | Requires verified courier cash collection remittance before enabling. |
| **Koko BNPL Refunds** | Strictly Blocked | Requires Koko refund gateway integration before enabling. |
| **PayHere Refunds** | Manual Verification Required | Payment verified via `PaymentAttempt(SUCCEEDED)` with unique reference; gateway refund execution verified by admin before completion. |
| **Bank Transfer Details** | Zero Unmasked Accounts Stored | Storing full bank account details deferred; `encryptedBankDetails` is `NULL`. |

---

## 13. Stage 2.2.1 Verdict & Sign-Off

Stage 2.2.1 (Refund Authorization & Segregation of Duties) is **COMPLETE, VERIFIED, AND APPROVED**:
- All financial rules and dual-custody requirements are enforced.
- All 47 unit tests and 31 real PostgreSQL integration tests pass.
- Backend builds cleanly with 0 TypeScript errors.
- Development database and protected inventory are completely pristine.
- Stage 2.3, 2.4, and 2.5 remain untouched pending user review.
