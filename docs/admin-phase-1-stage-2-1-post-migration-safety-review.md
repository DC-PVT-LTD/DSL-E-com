# DSL Stationery — Admin Phase 1, Stage 2.1 Post-Migration Safety Review

**Date:** November 14, 2026  
**Auditor & Reviewer:** Antigravity AI (DSL Engineering Core Team)  
**Status:** READ-ONLY SAFETY REVIEW COMPLETE  
**Review Target:** Stage 2.1 Schema Implementation & Database Push Verification  
**Deliverable File:** `docs/admin-phase-1-stage-2-1-post-migration-safety-review.md`  
**Verdict:** **PASS WITH LIMITATIONS**

---

## 1. Investigation of `--accept-data-loss` Execution

### 1.1 Exact Execution Log
The schema push was executed using the isolated test database connection string via `npx prisma db push --accept-data-loss --url="postgresql://.../dsl_stationery_test?schema=public"` with the explicit authorization consent token.

**Terminal Output Captured:**
```
Datasource "db": PostgreSQL database "dsl_stationery_test", schema "public" at "localhost:5432"

⚠️  There might be data loss when applying the changes:

  • A unique constraint covering the columns `[orderId,idempotencyKey]` on the table `RefundRecord` will be added. If there are existing duplicate values, this will fail.

Your database is now in sync with your Prisma schema. Done in 421ms
```

### 1.2 Database Objects Created, Altered, or Dropped
- **Objects Created:**
  - Enum `RefundStatus`: Created with values `['REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED']`.
  - Enum Value in `PaymentStatus`: Added `'PARTIALLY_REFUNDED'`.
  - Index `RefundRecord_status_idx`: Created on `RefundRecord("status")`.
  - Index `RefundRecord_orderReturnRequestId_idx`: Created on `RefundRecord("orderReturnRequestId")`.
  - Unique Constraint `RefundRecord_orderId_idempotencyKey_key`: Created on `RefundRecord("orderId", "idempotencyKey")`.
  - Foreign Key `RefundRecord_orderReturnRequestId_fkey`: Added referencing `OrderReturnRequest(id)` with `ON DELETE RESTRICT`.
  - 15 New Columns on `RefundRecord`: `approvedAt`, `approvedById`, `completedAt`, `currency`, `encryptedBankDetails`, `externalReference`, `failureReason`, `idempotencyKey`, `maskedAccountNumber`, `metadata`, `orderReturnRequestId`, `payloadHash`, `processedById`, `status`, `updatedAt`.
- **Objects Altered:**
  - Foreign Key `RefundRecord_orderId_fkey`: Altered deletion rule from `CASCADE` to `RESTRICT`.
- **Objects Dropped:**
  - **Zero** tables were dropped.
  - **Zero** columns were dropped.
  - **Zero** indexes were dropped.

### 1.3 Assessment of Potential Data Loss
- **Pre-Push Record Count:** An SQL query executed immediately prior to the push confirmed `SELECT count(*) FROM "RefundRecord"` returned **0 rows** in `dsl_stationery_test`.
- **Destructive Operation Check:** Prisma flags the addition of any unique constraint as a potential "data loss" event because in PostgreSQL, adding a unique index fails if existing duplicate rows violate the constraint. Because there were 0 existing rows in `RefundRecord`, no duplicate violation could occur, and **zero data was modified or destroyed**.
- **Final Schema Concordance:** PostgreSQL catalog queries against `information_schema.columns`, `pg_indexes`, and `information_schema.referential_constraints` confirm that 100% of the intended schema fields, types, defaults, indexes, and foreign keys match `backend/prisma/schema.prisma`.

---

## 2. Review of `encryptedBankDetails` & Banking Data Storage

### 2.1 Intended Data Content
- `encryptedBankDetails` is defined as a nullable string (`String?`) in `backend/prisma/schema.prisma`.
- Under the cryptographic design specification (Section 5 of `admin-phase-1-stage-2-schema-design.md`), this field was architected to store an AES-256-GCM ciphertext payload (`v1:iv:authTag:ciphertext`) containing beneficiary name, bank name, branch, and full bank account numbers.

### 2.2 Compliance with the Deferral Decision
- In Section 10.3.B of `docs/admin-phase-1-stage-2-schema-design.md`, the security assessment concluded:
  > *"Because the existing RBAC foundation cannot safely restrict decryption to isolated finance officers without modifying the core RBAC model: In Phase 1 Stage 2, defer storing full unmasked bank account numbers in the database. Capture and store only `maskedAccountNumber` (e.g. `••••••••5819`), `beneficiaryName`, `bankName`, and `branch`."*
- **Current State:** The column was added to the database schema as a nullable text column (`encryptedBankDetails String?`) during the schema migration.
- **Evaluation:** Although the column physically exists in the test database schema, it is completely `nullable` (`is_nullable = 'YES'`) and currently holds `NULL` across all rows.
- **Impact on Workflow:** The intended Stage 2.2–2.4 workflow does not require `encryptedBankDetails`. Staff records the manual bank transfer external reference and masked account number (`maskedAccountNumber`), while actual disbursements occur on external corporate banking portals.
- **Recommendation:**
  1. **Do not populate or use `encryptedBankDetails`** in Stage 2.2 service implementations.
  2. Treat `encryptedBankDetails` as an inert, dormant nullable field for future phases (when a dedicated Finance RBAC role is created), or remove it in a future schema cleanup.
  3. Ensure all Stage 2.2–2.4 DTOs and forms capture strictly `maskedAccountNumber`, `bankName`, and `beneficiaryName`.

---

## 3. Investigation of the Frontend Test Failure

### 3.1 Failing Test Execution Details
- **Exact Command Executed:** `cd frontend; npm test` (Task-1015, running `vitest run`).
- **Result:** 27 test files passed, 2 test files failed (201 tests passed, 2 tests failed out of 203).

### 3.2 Failing Tests & Error Analysis
1. **Failure 1:** `src/services/__tests__/brandService.test.ts`
   - **Test Name:** `brandService > fetches brands from backend API and updates local store`
   - **Error:**
     ```
     AssertionError: expected 13 to be 2 // Object.is equality
     - Expected: 2
     + Received: 13
     at src/services/__tests__/brandService.test.ts:49:27
     ```
   - **Root Cause:** A pre-existing test fixture discrepancy. The unit test asserts that `brandService.fetchBrands()` returns 2 mock brands, but the mock/environment returned the full catalogue dataset of 13 seed brands.
2. **Failure 2:** `src/services/__tests__/categoryService.test.ts`
   - **Test Name:** `categoryService > fetches categories from backend API and updates local store`
   - **Error:**
     ```
     AssertionError: expected 19 to be 2 // Object.is equality
     - Expected: 2
     + Received: 19
     at src/services/__tests__/categoryService.test.ts:45:27
     ```
   - **Root Cause:** A pre-existing test fixture discrepancy. The unit test asserts 2 categories, but the seed catalogue contains 19 categories.

### 3.3 Comparison with Order Test Suites
- **Did the later 10/10 test command run the same files?**
  **NO.** The targeted test command executed:
  ```powershell
  cd frontend; npx vitest run src/components/admin/orders/
  ```
  This command ran `src/components/admin/orders/__tests__/ReturnManagementCard.test.tsx` (4 tests passed).
- Together with `src/services/__tests__/orderService.test.ts` (6 tests passed in the full run), all **10 order-specific frontend tests executed and passed (100%)**.
- **Were any order tests skipped or excluded?**
  No order-related tests were skipped or excluded. The 2 failures in `brandService` and `categoryService` are completely decoupled from orders, returns, and refunds.

---

## 4. Reconfirmation of Database Isolation & Safety

Direct read-only verification was executed across both environments:

| Safety Requirement | Evidence / Command Result | Status |
| :--- | :--- | :--- |
| **`TEST_DATABASE_URL` Resolution** | Resolved pathname: `/dsl_stationery_test`. | **CONFIRMED** |
| **Dev Database Schema Integrity** | `SELECT column_name FROM information_schema.columns WHERE table_name = 'RefundRecord' AND column_name = 'idempotencyKey'` returned **0 rows**. Dev schema has zero Stage 2.1 modifications. | **CONFIRMED** |
| **Protected Product Stock** | `SELECT "stockQuantity" FROM "Product" WHERE id = 'cmw0j4cro00089kusmwsbv48t'` on `dsl_stationery` returned **exactly 10**. | **CONFIRMED** |
| **Orders & Returns on Dev** | Dev Orders: **2**, Dev Return Requests: **0**, Dev RefundRecords: **0**. Unchanged. | **CONFIRMED** |
| **Payment Gateway Protection** | `onlineCardEnabled` remains `false`. Zero PayHere or Koko API invocations. | **CONFIRMED** |
| **COD & Koko Policy** | COD cash collection records remain absent; COD refunds remain strictly blocked. | **CONFIRMED** |

---

## 5. Final Safety Verdict

```
+--------------------------------------------------------------------------------------------------+
|                               VERDICT: PASS WITH LIMITATIONS                                     |
+--------------------------------------------------------------------------------------------------+
| 1. Database isolation is 100% verified. Development DB is pristine; protected stock is 10.      |
| 2. The isolated test database (dsl_stationery_test) has all required tables, columns, indexes,  |
|    enums, unique constraints, and restrictive foreign keys in sync with schema.prisma.          |
| 3. No data was lost during --accept-data-loss (table had 0 rows prior to migration).             |
| 4. Limitation A: `encryptedBankDetails` exists as a dormant nullable column in the schema.      |
|    In Stage 2.2, implementation must NOT store full unmasked accounts; only masked details.      |
| 5. Limitation B: 2 pre-existing frontend brand/category unit tests fail due to mock fixture       |
|    count differences (13 vs 2, 19 vs 2). All 10 order-related frontend tests pass 100%.          |
+--------------------------------------------------------------------------------------------------+
```

---

*Report certified by Antigravity AI — DSL Engineering Core Team. Ready for review.*

