# DSL Stationery — Admin Phase 1, Stage 2.1 Implementation & Migration Report

**Date:** November 14, 2026  
**Auditor & Engineer:** Antigravity AI (DSL Engineering Core Team)  
**Status:** COMPLETED & VERIFIED ON TEST DATABASE (Awaiting User Review Before Stage 2.2)  
**Deliverable:** `docs/admin-phase-1-stage-2-1-implementation-report.md`

---

## 1. Executive Summary

Stage 2.1 has been successfully executed in strict accordance with the approved Stage 2.1 schema design specification and all safety mandates:

1. **Schema Updated:** `backend/prisma/schema.prisma` was updated with the verified `PaymentStatus` and `RefundStatus` enums, the `RefundRecord` model with restrictive foreign key deletion policies (`onDelete: Restrict`), composite unique index `[orderId, idempotencyKey]`, and bi-directional linkages to `OrderReturnRequest`.
2. **Strict Test Database Target Proven:** Automated pre-flight assertion verified that the target database was strictly and demonstrably `dsl_stationery_test` before applying the migration.
3. **Migration Successfully Applied:** Prisma schema was synchronized to `dsl_stationery_test` via `npx prisma db push --accept-data-loss`.
4. **Database Structure Verified via SQL:** Information schema and PostgreSQL catalog queries verified all columns, data types, nullability, default values, enums, indexes, and `RESTRICT` foreign key actions.
5. **Development Database 100% Untouched:** Direct queries to `dsl_stationery` confirmed that the development database was untouched, the protected product `Double Submission Test Product` stock remains **exactly 10 units**, and no schema alterations took place on development.
6. **Zero Breaking Regressions:**
   - Orders service unit tests: **29/29 passed**
   - Real PostgreSQL concurrency integration tests: **4/4 passed**
   - Full backend orders test suite: **75/75 passed**
   - Frontend order tests: **10/10 passed**
   - Backend production build: **Passed (`nest build` exited with code 0)**

---

## 2. Exact Files Changed

| File Path | Nature of Change | Summary of Edits |
| :--- | :--- | :--- |
| `backend/prisma/schema.prisma` | Modified | Lines 36–41: Added `PARTIALLY_REFUNDED` to `enum PaymentStatus`.<br>Lines 486–500: Added `enum RefundStatus`.<br>Lines 540–550: Added `refundRecords RefundRecord[]` to `OrderReturnRequest`.<br>Lines 575–605: Updated `RefundRecord` model with `onDelete: Restrict`, `currency`, `status`, `externalReference`, `idempotencyKey`, `payloadHash`, `failureReason`, `maskedAccountNumber`, `encryptedBankDetails`, actor tracking, return linkage, and `@@unique([orderId, idempotencyKey])`. |
| `backend/src/generated/prisma/*` | Generated | Re-generated Prisma 7 client bindings to expose new enums and fields. |
| `docs/admin-phase-1-stage-2-schema-design.md` | Updated | Added Section 10: Final Pre-Migration Verification. |
| `docs/admin-phase-1-stage-2-1-implementation-report.md` | Created | Comprehensive Stage 2.1 implementation and verification report. |

---

## 3. Schema Changes Detailed Breakdown

### 3.1 `enum PaymentStatus`
```prisma
enum PaymentStatus {
  PENDING
  PAID
  FAILED
  PARTIALLY_REFUNDED // Added
  REFUNDED
}
```

### 3.2 `enum RefundStatus`
```prisma
enum RefundStatus {
  REQUESTED       // Staff initiated a refund request; awaiting manager/finance approval
  APPROVED        // Authorized internally; queued for disbursement execution
  PROCESSING      // In-flight externally (submitted to gateway portal or bank queue)
  COMPLETED       // Confirmed executed with verified transaction reference / receipt
  FAILED          // External transfer or reversal failed / bounced; funds never left accounts
  REJECTED        // Rejected by manager or finance administrator during approval
}
```

### 3.3 `model RefundRecord`
```prisma
model RefundRecord {
  id                   String              @id @default(cuid())
  orderId              String
  order                Order               @relation(fields: [orderId], references: [id], onDelete: Restrict)
  amountCents          Int
  currency             String              @default("LKR")
  method               String
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
  approvedById         String?
  approvedAt           DateTime?
  completedAt          DateTime?
  orderReturnRequestId String?
  orderReturnRequest   OrderReturnRequest? @relation(fields: [orderReturnRequestId], references: [id], onDelete: Restrict)
  metadata             Json?
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt

  @@index([orderId])
  @@index([status])
  @@index([orderReturnRequestId])
  @@unique([orderId, idempotencyKey])
}
```

---

## 4. Target Database & Pre-Flight Safety Verification

Before running any Prisma CLI command, the following automated pre-flight assertion script was executed:

```
--- SAFETY PRE-FLIGHT VERIFICATION ---
Resolved Dev DB Name: dsl_stationery
Resolved Test DB Name: dsl_stationery_test
SUCCESS: Target database is proven to be strictly "dsl_stationery_test".
```

The database push command was executed targeting exclusively `TEST_DATABASE_URL`:
```powershell
npx prisma db push --accept-data-loss --url="postgresql://.../dsl_stationery_test?schema=public"
```

Result:
```
Datasource "db": PostgreSQL database "dsl_stationery_test", schema "public" at "localhost:5432"
Your database is now in sync with your Prisma schema. Done in 421ms
```

---

## 5. PostgreSQL Catalog Verification Results (`dsl_stationery_test`)

Direct SQL inspection was run against PostgreSQL catalog tables in `dsl_stationery_test`:

### 5.1 Enums Verified
- **`PaymentStatus`:** `['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']`
- **`RefundStatus`:** `['REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED']`

### 5.2 Columns & Defaults Verified
```
┌─────────┬────────────────────────┬───────────────────────────────┬─────────────┬───────────────────────────────┐
│ (index) │ column_name            │ data_type                     │ is_nullable │ column_default                │
├─────────┼────────────────────────┼───────────────────────────────┼─────────────┼───────────────────────────────┤
│ 0       │ 'id'                   │ 'text'                        │ 'NO'        │ null                          │
│ 1       │ 'orderId'              │ 'text'                        │ 'NO'        │ null                          │
│ 2       │ 'amountCents'          │ 'integer'                     │ 'NO'        │ null                          │
│ 3       │ 'method'               │ 'text'                        │ 'NO'        │ null                          │
│ 4       │ 'reference'            │ 'text'                        │ 'YES'       │ null                          │
│ 5       │ 'reason'               │ 'text'                        │ 'NO'        │ null                          │
│ 6       │ 'processedBy'          │ 'text'                        │ 'YES'       │ null                          │
│ 7       │ 'createdAt'            │ 'timestamp without time zone' │ 'NO'        │ 'CURRENT_TIMESTAMP'           │
│ 8       │ 'approvedAt'           │ 'timestamp without time zone' │ 'YES'       │ null                          │
│ 9       │ 'approvedById'         │ 'text'                        │ 'YES'       │ null                          │
│ 10      │ 'completedAt'          │ 'timestamp without time zone' │ 'YES'       │ null                          │
│ 11      │ 'currency'             │ 'text'                        │ 'NO'        │ "'LKR'::text"                 │
│ 12      │ 'encryptedBankDetails' │ 'text'                        │ 'YES'       │ null                          │
│ 13      │ 'externalReference'    │ 'text'                        │ 'YES'       │ null                          │
│ 14      │ 'failureReason'        │ 'text'                        │ 'YES'       │ null                          │
│ 15      │ 'idempotencyKey'       │ 'text'                        │ 'YES'       │ null                          │
│ 16      │ 'maskedAccountNumber'  │ 'text'                        │ 'YES'       │ null                          │
│ 17      │ 'metadata'             │ 'jsonb'                       │ 'YES'       │ null                          │
│ 18      │ 'orderReturnRequestId' │ 'text'                        │ 'YES'       │ null                          │
│ 19      │ 'payloadHash'          │ 'text'                        │ 'YES'       │ null                          │
│ 20      │ 'processedById'        │ 'text'                        │ 'YES'       │ null                          │
│ 21      │ 'status'               │ 'USER-DEFINED'                │ 'NO'        │ `'REQUESTED'::"RefundStatus"` │
│ 22      │ 'updatedAt'            │ 'timestamp without time zone' │ 'NO'        │ null                          │
└─────────┴────────────────────────┴───────────────────────────────┴─────────────┴───────────────────────────────┘
```

### 5.3 Indexes & Unique Constraints Verified
- `RefundRecord_pkey`: PRIMARY KEY (`id`)
- `RefundRecord_orderId_idx`: btree (`orderId`)
- `RefundRecord_status_idx`: btree (`status`)
- `RefundRecord_orderReturnRequestId_idx`: btree (`orderReturnRequestId`)
- `RefundRecord_orderId_idempotencyKey_key`: **UNIQUE INDEX** btree (`orderId`, `idempotencyKey`)

### 5.4 Foreign Key Deletion Actions Verified
- `RefundRecord_orderId_fkey`: References `Order(id)`, delete_rule: **`RESTRICT`**
- `RefundRecord_orderReturnRequestId_fkey`: References `OrderReturnRequest(id)`, delete_rule: **`RESTRICT`**

---

## 6. Development Database Safety Audit (`dsl_stationery`)

Direct queries were executed against `dsl_stationery` to verify complete isolation:

| Safety Criterion | Expected Value | Actual Verified Value | Status |
| :--- | :--- | :--- | :--- |
| **Target Database** | `dsl_stationery` | `dsl_stationery` | **VERIFIED** |
| **Protected Product Stock** (`cmw0j4cro00089kusmwsbv48t`) | Exactly 10 | **10** | **PASS** |
| **Dev DB Schema Modified?** | `false` | `false` (`idempotencyKey` column does not exist) | **PASS** |
| **Existing Dev Orders Count** | 2 | 2 | **PASS** |
| **Existing Dev RefundRecords Count** | 0 | 0 | **PASS** |
| **PayHere `onlineCardEnabled`** | `false` | `false` | **PASS** |
| **Gateway APIs Called** | None | 0 | **PASS** |

---

## 7. Test Execution Results

| Test Suite / Command | Scope | Result | Details |
| :--- | :--- | :--- | :--- |
| `npx prisma validate` | Prisma schema syntax | **PASS** | "The schema at prisma\schema.prisma is valid 🚀" |
| `npx prisma generate` | Client generator | **PASS** | Generated client (v7.10.1) in 779ms |
| `admin-orders.service.spec.ts` | Orders service unit tests | **PASS (29/29)** | 29 passing in 52ms |
| `orders-concurrency.integration.spec.ts` | Real PostgreSQL concurrency tests | **PASS (4/4)** | 4 passing against `dsl_stationery_test` in 1226ms |
| `src/modules/orders/*` | Full backend orders test suite | **PASS (75/75)** | 75 passing across 4 test files in 2.86s |
| `src/components/admin/orders/*` | Frontend order components | **PASS (10/10)** | 10 passing across 2 test files |
| `npm run build` (Backend) | Production NestJS compilation | **PASS** | Build succeeded, exit code 0 |

---

## 8. Current System Limitations & Boundaries

In accordance with strict safety mandates:
1. **Stage 2.2 through 2.5 Not Yet Begun:** Backend services (`processRefund`, `cancelOrder`), DTOs, frontend UI components, and new refund concurrency tests have **NOT** been altered.
2. **COD & Koko Refunds Remain Blocked:** Because no courier cash remittance model exists in the database schema, COD refunds will remain strictly blocked. Koko refunds remain blocked until an integration is developed.
3. **No Unmasked Bank Account Storage:** `maskedAccountNumber` (e.g. `••••1234`) will be used; full unmasked bank account numbers will not be stored in plaintext.
4. **Zero Git Mutations:** Changes have not been committed or pushed.

---

*Stage 2.1 implementation and verification is complete. Antigravity AI is stopped and awaiting user review and approval before proceeding to Stage 2.2.*

