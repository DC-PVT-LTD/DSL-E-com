# DSL STATIONERY — COMPLETE ADMIN DASHBOARD DATABASE SCHEMA DRIFT FIX REPORT

**Target Environment:** DSL Stationery E-Commerce Platform  
**Architecture:** Next.js 16 (App Router), NestJS 11, PostgreSQL 18.4, Prisma 7, Zustand  
**Date:** November 16, 2026  
**Final Status:** **VERIFIED — FULLY RESOLVED**

---

## 1. Original Error

When an administrator navigated to the Admin Dashboard (`/admin/dashboard`), the frontend failed to load metrics and displayed:
> **"Unable to load dashboard data. An unexpected server error occurred."**

The underlying API request:
```http
GET /api/v1/admin/dashboard/kpis?period=last30days
```
crashed with an unhandled **HTTP 500 Internal Server Error**.

Backend exception log:
```text
ERROR [HttpExceptionFilter] Unhandled exception on GET /api/v1/admin/dashboard/kpis?period=last30days:
Invalid `this.prisma.order.findMany()` invocation in
backend/src/modules/reports/reports.service.ts:695:44

The column `RefundRecord.completedAt` does not exist in the current database.
(PostgreSQL Error Code 42703: ColumnNotFound)
```

---

## 2. Root Cause Analysis

1. **Schema Drift:**  
   The `RefundRecord` model in `backend/prisma/schema.prisma` had been expanded to include full lifecycle refund auditing fields (`status`, `completedAt`, `completedById`, `currency`, `idempotencyKey`, `orderReturnRequestId`, etc.).
2. **Missing Migration:**  
   The actual PostgreSQL database table `"RefundRecord"` only possessed the original 8 legacy columns from the initial database seed, and the PostgreSQL enum `RefundStatus` had never been created in the database.
3. **Runtime Failure:**  
   When `ReportsService.calculateReportingData` executed `this.prisma.order.findMany({ include: { refundRecords: { where: { status: RefundStatus.COMPLETED } } } })`, Prisma generated a SQL query requesting `RefundRecord.completedAt` and filtering by `RefundRecord.status`. PostgreSQL rejected the query with code `42703` (ColumnNotFound).

---

## 3. Original PostgreSQL Schema (`RefundRecord`)

Prior to remediation, the table in PostgreSQL contained only 8 columns:

| Column Name | Data Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | None (PK) |
| `orderId` | `text` | NO | None (FK to Order) |
| `amountCents` | `integer` | NO | None |
| `method` | `text` | NO | None |
| `reference` | `text` | YES | None |
| `reason` | `text` | NO | None |
| `processedBy` | `text` | YES | None |
| `createdAt` | `timestamp without time zone` | NO | `CURRENT_TIMESTAMP` |

**Missing in Database:**
- Enum `RefundStatus` did not exist.
- 17 extended columns expected by Prisma were absent.
- Foreign key relation to `OrderReturnRequest` was absent.
- Composite unique constraint `("orderId", "idempotencyKey")` was absent.

---

## 4. Database Backup Verification

In accordance with strict safety requirements, a verified backup of the `dsl_stationery` database was taken before applying any database modification:

* **Tool:** `C:\Program Files\PostgreSQL\18\bin\pg_dump.exe`
* **Target Database:** `dsl_stationery` (PostgreSQL 18.4 on localhost:5432)
* **Backup File:** `C:\Users\Yehara Kobbagala\Desktop\dsl_db_backups\dsl_stationery_pre_refund_fix_20261116.sql`
* **File Size:** **1,454,254 bytes (1.45 MB)**
* **Backup Status:** **VERIFIED** (exit code 0, non-empty, stored outside source-controlled repository)

---

## 5. Migration SQL Summary

A dedicated, non-destructive additive Prisma migration was created at:  
`backend/prisma/migrations/20261116110000_add_refund_record_extended_fields/migration.sql`

```sql
-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
DO $$ BEGIN
    ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Add extended fields to RefundRecord
ALTER TABLE "RefundRecord"
    ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'LKR',
    ADD COLUMN IF NOT EXISTS "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    ADD COLUMN IF NOT EXISTS "externalReference" TEXT,
    ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
    ADD COLUMN IF NOT EXISTS "payloadHash" TEXT,
    ADD COLUMN IF NOT EXISTS "failureReason" TEXT,
    ADD COLUMN IF NOT EXISTS "maskedAccountNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "encryptedBankDetails" TEXT,
    ADD COLUMN IF NOT EXISTS "processedById" TEXT,
    ADD COLUMN IF NOT EXISTS "requestedById" TEXT,
    ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
    ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "completedById" TEXT,
    ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "orderReturnRequestId" TEXT,
    ADD COLUMN IF NOT EXISTS "metadata" JSONB,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RefundRecord_status_idx" ON "RefundRecord"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RefundRecord_orderReturnRequestId_idx" ON "RefundRecord"("orderReturnRequestId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RefundRecord_orderId_idempotencyKey_key" ON "RefundRecord"("orderId", "idempotencyKey");

-- AddForeignKey (OrderReturnRequest)
DO $$ BEGIN
    ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_orderReturnRequestId_fkey"
        FOREIGN KEY ("orderReturnRequestId") REFERENCES "OrderReturnRequest"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
```

---

## 6. Migration Execution & Client Regeneration

1. **Migration Deployment:**
   ```bash
   npx prisma migrate deploy
   ```
   **Output:**
   ```text
   17 migrations found in prisma/migrations
   Applying migration `20261116110000_add_refund_record_extended_fields`
   All migrations have been successfully applied.
   ```
   **Status:** **VERIFIED**

2. **Prisma Client Regeneration:**
   ```bash
   npx prisma generate
   ```
   **Output:**
   ```text
   ✔ Generated Prisma Client (v7.10.1) to .\src\generated\prisma in 669ms
   ```
   **Status:** **VERIFIED**

3. **Prisma Validation:**
   ```bash
   npx prisma validate
   ```
   **Output:**
   ```text
   The schema at prisma\schema.prisma is valid 🚀
   ```
   **Status:** **VERIFIED**

---

## 7. Database Integrity & Data Preservation

Post-migration inspection confirms that the `"RefundRecord"` table in PostgreSQL now contains exactly 25 columns matching `schema.prisma`:

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | None |
| `orderId` | `text` | NO | None |
| `amountCents` | `integer` | NO | None |
| `method` | `text` | NO | None |
| `reference` | `text` | YES | None |
| `reason` | `text` | NO | None |
| `processedBy` | `text` | YES | None |
| `createdAt` | `timestamp without time zone` | NO | `CURRENT_TIMESTAMP` |
| `currency` | `text` | NO | `'LKR'` |
| `status` | `RefundStatus` | NO | `'REQUESTED'` |
| `externalReference` | `text` | YES | None |
| `idempotencyKey` | `text` | YES | None |
| `payloadHash` | `text` | YES | None |
| `failureReason` | `text` | YES | None |
| `maskedAccountNumber` | `text` | YES | None |
| `encryptedBankDetails` | `text` | YES | None |
| `processedById` | `text` | YES | None |
| `requestedById` | `text` | YES | None |
| `approvedById` | `text` | YES | None |
| `approvedAt` | `timestamp without time zone` | YES | None |
| `completedById` | `text` | YES | None |
| `completedAt` | `timestamp without time zone` | YES | None |
| `orderReturnRequestId` | `text` | YES | None |
| `metadata` | `jsonb` | YES | None |
| `updatedAt` | `timestamp without time zone` | NO | `CURRENT_TIMESTAMP` |

- **Row Count:** Preserved (0 existing records; zero data lost).
- **Other Tables:** `Order`, `Payment`, `StoreSettings`, `User`, `AuditLog` remained untouched and intact.
- **Status:** **VERIFIED**

---

## 8. Dashboard API Verification

Live tests against the running NestJS server (`http://localhost:4000/api/v1`) using authenticated Super Admin credentials:

| Period Filter | HTTP Status | Response Details | Status |
| :--- | :---: | :--- | :---: |
| `GET .../kpis?period=today` | **200 OK** | Orders: 0, Net Revenue: Rs. 0.00 | **VERIFIED** |
| `GET .../kpis?period=last7days` | **200 OK** | Orders: 0, Top Products: 1 | **VERIFIED** |
| `GET .../kpis?period=last30days` | **200 OK** | Gross: Rs. 13,000, Refunds: Rs. 0, Net: Rs. 13,000, Orders: 2, Top Products: 1, Low Stock: 17 | **VERIFIED** |
| `GET .../kpis?period=custom&dateFrom=2026-11-01&dateTo=2026-11-16` | **200 OK** | Calculated for exact calendar range | **VERIFIED** |

### Verified Payload Output (`period=last30days`):
```json
{
  "financial": {
    "grossSalesCents": 1300000,
    "netRevenueCents": 1300000,
    "completedRefundsCents": 0,
    "paidOrdersCount": 1,
    "averageOrderValueCents": 1300000
  },
  "financialVerificationStatus": "PASS",
  "orders": {
    "totalOrdersInPeriod": 2,
    "pendingFulfillmentQueue": 2
  },
  "inventory": {
    "lowStockSkuCount": 17,
    "lowStockItems": [...]
  },
  "recentOrders": [...]
}
```

---

## 9. Refund Calculation Verification

In [reports.service.ts](file:///c:/Users/Yehara%20Kobbagala/Desktop/Projects/DSL%20E-com/backend/src/modules/reports/reports.service.ts#L709-L735):
- **Completed Refunds Filter:** Strictly queries `where: { status: RefundStatus.COMPLETED }`.
- **Pending / Requested Handling:** Refunds in `REQUESTED`, `APPROVED`, `PROCESSING`, `FAILED`, or `REJECTED` are **never** subtracted from net revenue.
- **Net Revenue Formula:** `Net Revenue = Gross Sales (Captured) - Completed Refunds`.
- **Status:** **VERIFIED**

---

## 10. Build & Compilation Verification

1. **Backend TypeScript Compilation:**
   ```bash
   npx tsc -p tsconfig.build.json --noEmit
   ```
   **Result:** Exit code 0 (zero errors). **VERIFIED**

2. **Backend Production Build:**
   ```bash
   npm run build
   ```
   **Result:** Exit code 0 (compiled to `dist/`). **VERIFIED**

3. **Frontend TypeScript Check:**
   ```bash
   npx tsc --noEmit
   ```
   **Result:** Exit code 0 (zero errors). **VERIFIED**

4. **Frontend Production Build:**
   ```bash
   npm run build
   ```
   **Result:** Exit code 0 (Next.js 16.4.3 Turbopack, 62 routes compiled). **VERIFIED**

---

## 11. Final Completion Summary

| Acceptance Criterion | Result | Evidence |
| :--- | :---: | :--- |
| Verified pre-migration pg_dump backup | **VERIFIED** | 1.45 MB backup saved to `C:\Users\Yehara Kobbagala\Desktop\dsl_db_backups\` |
| PostgreSQL matches Prisma schema | **VERIFIED** | `RefundRecord` has all 25 columns and `RefundStatus` enum |
| Existing database records preserved | **VERIFIED** | Zero data loss; non-destructive `ALTER TABLE` applied |
| Prisma migration history consistent | **VERIFIED** | Migration `20261116110000_add_refund_record_extended_fields` applied |
| Prisma Client regenerated | **VERIFIED** | Client regenerated to `src/generated/prisma` |
| Dashboard KPI endpoint returns HTTP 200 | **VERIFIED** | `today`, `last7days`, `last30days`, `custom` return 200 OK |
| Net Revenue and Refund calculations correct | **VERIFIED** | Only `COMPLETED` refunds deducted; calculations verified |
| Backend build passes | **VERIFIED** | `nest build` completed with exit code 0 |
| Frontend build passes | **VERIFIED** | `next build` completed with exit code 0 |

**Verdict:** **COMPLETE — ISSUE FULLY RESOLVED**

