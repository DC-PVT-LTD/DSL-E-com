# DSL Stationery Admin — Stage 1.1 Final Verification Report
## PostgreSQL Test Environment & Lock Ordering Audit

**Date:** 2026-11-14  
**Scope:** Stage 1.1 Final Verification: PostgreSQL Test Environment, Test Isolation, and Lock Ordering Analysis  
**Auditor:** DSL Technical Architecture Team  
**Status:** Verification Complete — Test Database Provisioning Prerequisite Identified  

---

## 1. Executive Summary

This report performs the final technical review of the Stage 1.1 inventory and return hardening implementation, focusing on:
1. **PostgreSQL Test Environment Availability & Isolation:** Verification of the isolated test database `dsl_stationery_test` and safety guards in `orders-concurrency.integration.spec.ts`.
2. **Lock-Ordering & Deadlock Analysis:** Inspection of `createReturnRequest`, `processReturnStatus`, `cancelOrder`, and `updateStatus` (`CANCELLED`) for multi-row lock ordering and deadlock risk under concurrent workloads.
3. **Data Integrity & Protection:** Empirical confirmation that the development database (`dsl_stationery`) and the protected product (`Double Submission Test Product`, stock: 10) remain completely untouched.

---

## 2. Test Database Provisioning & Isolation Inspection

### 2.1 Database Existence Check
A direct query against PostgreSQL `pg_database` was conducted:
```sql
SELECT datname FROM pg_database WHERE datname NOT LIKE 'template%';
```
- **Active Databases Found:** `postgres`, `leaflogic`, `mark`, `dsl_stationery`.
- **Target Test Database (`dsl_stationery_test`):** **DOES NOT EXIST** (`exists: false`).
- **Environment Status:** `TEST_DATABASE_URL` is undefined.

In strict adherence to the project instructions:
> *"Before creating anything: Check whether this database already exists... If it does not exist, report that it needs to be provisioned. Do not create, drop, reset or migrate any database without explicit approval. Never use the development database as a test database."*

Neither the test database nor any schema migrations were created. Execution of destructive tests against the development database was strictly prevented.

### 2.2 Test Suite Isolation & Accidental Connection Prevention
We inspected `backend/src/modules/orders/orders-concurrency.integration.spec.ts` (lines 14–46):

```typescript
const isIsolatedTestDbConfigured = Boolean(
  process.env.TEST_DATABASE_URL &&
  process.env.TEST_DATABASE_URL.includes('_test')
);

describe.skipIf(!isIsolatedTestDbConfigured)('PostgreSQL Concurrency Integration Tests (Real Database)', () => {
  let prisma1: PrismaClient;
  let prisma2: PrismaClient;
  let pool1: Pool;
  let pool2: Pool;

  beforeAll(async () => {
    if (!isIsolatedTestDbConfigured) return;
    const testDbUrl = process.env.TEST_DATABASE_URL!;
    pool1 = new Pool({ connectionString: testDbUrl });
    pool2 = new Pool({ connectionString: testDbUrl });

    prisma1 = new PrismaClient({ adapter: new PrismaPg(pool1) });
    prisma2 = new PrismaClient({ adapter: new PrismaPg(pool2) });
    // ...
  });
```

#### Isolation Guarantees Verified:
1. **Explicit Database Name Guard:** The test suite requires `TEST_DATABASE_URL` to be explicitly defined **and** must contain `_test` in the URL string (`process.env.TEST_DATABASE_URL.includes('_test')`). If a developer accidentally points `TEST_DATABASE_URL` to `.../dsl_stationery`, the suite evaluates the condition to `false` and skips all tests.
2. **Zero Default Fallback:** The suite does **not** fall back to `DATABASE_URL` or default credentials.
3. **Independent Physical Connection Pools:** `prisma1` and `prisma2` instantiate completely separate `pg.Pool` connection pools. This guarantees that concurrent queries utilize separate PostgreSQL backend worker processes and TCP sockets, accurately testing true database concurrency.
4. **Deterministic Fixture Cleanup:** All generated records use isolated timestamps (`ORD-CONC-A-${Date.now()}`), track IDs in `cleanupOrderIds` and `cleanupProductIds`, and execute reverse foreign-key deletion in `afterAll`.

### 2.3 Integration Test Status

| Scenario | Objective | Status | Reason |
| :--- | :--- | :---: | :--- |
| **Test A** | Concurrent Return Creation Race | **SKIPPED** | Dedicated isolated database `dsl_stationery_test` is not provisioned. |
| **Test B** | Concurrent Receipt Double-Restock | **SKIPPED** | Dedicated isolated database `dsl_stationery_test` is not provisioned. |
| **Test C** | Concurrent Inventory Ledger Increments | **SKIPPED** | Dedicated isolated database `dsl_stationery_test` is not provisioned. |
| **Test D** | Transaction Rollback Integrity | **SKIPPED** | Dedicated isolated database `dsl_stationery_test` is not provisioned. |

---

## 3. Database Lock-Ordering & Deadlock Analysis

We conducted a line-by-line inspection of row locking across the four order operations:
1. `createReturnRequest`
2. `processReturnStatus`
3. `cancelOrder`
4. `updateStatus` (when cancelling orders)

### 3.1 Operation-by-Operation Audit

#### A. `createReturnRequest` (`admin-orders.service.ts:1042-1044`)
```sql
SELECT id, "orderStatus" FROM "Order" WHERE id = $1 FOR UPDATE
```
- **Rows Locked:** Exactly 1 row in the `"Order"` table.
- **Deadlock Potential:** **None**. A transaction locking a single row cannot deadlock with other single-row locks on `"Order"` because locking a single row is an atomic acquisition.

---

#### B. `processReturnStatus` (`admin-orders.service.ts:1267-1284`)
```typescript
if (dto.action === 'CONFIRM_RECEIVED' && dto.restockItems) {
  for (const item of current.items) {
    if (item.receivedAt) continue;
    const orderItem = await tx.orderItem.findUnique({ where: { id: item.orderItemId } });
    if (!orderItem) continue;

    // 1. Lock Product
    const lockedProds = await tx.$queryRaw<Array<{ id: string; stockQuantity: number }>>`
      SELECT id, "stockQuantity" FROM "Product" WHERE id = ${orderItem.productId} FOR UPDATE
    `;
    // ...
    // 2. Lock Variant (if present)
    if (orderItem.variantId) {
      await tx.$queryRaw`
        SELECT id, "stockQuantity" FROM "ProductVariant" WHERE id = ${orderItem.variantId} FOR UPDATE
      `;
      // ...
    }
  }
}
```

#### C. `cancelOrder` (`admin-orders.service.ts:895-912`)
```typescript
if (dto.restoreInventory && order.items && order.items.length > 0) {
  for (const item of order.items) {
    // 1. Lock Product
    const lockedProds = await tx.$queryRaw<Array<{ id: string; stockQuantity: number }>>`
      SELECT id, "stockQuantity" FROM "Product" WHERE id = ${item.productId} FOR UPDATE
    `;
    // ...
    // 2. Lock Variant (if present)
    if (item.variantId) {
      await tx.$queryRaw`
        SELECT id, "stockQuantity" FROM "ProductVariant" WHERE id = ${item.variantId} FOR UPDATE
      `;
      // ...
    }
  }
}
```

#### D. `updateStatus` (`admin-orders.service.ts:296-314`)
Identical loop structure to `cancelOrder`: iterates over `order.items`, locks `Product`, then locks `ProductVariant`.

---

### 3.2 Deadlock Risk Analysis

#### Finding: Lock Acquisition Order is Non-Deterministic Across Multiple Rows
In `processReturnStatus`, `cancelOrder`, and `updateStatus`, the rows are locked sequentially inside a `for (const item of items)` loop:
1. `items` are ordered by the default query return order (insertion order or primary key order of the join table `OrderItem` / `OrderReturnItem`), rather than by the `productId` or `variantId` primary key.
2. If two concurrent transactions attempt to restock or restore overlapping sets of products in different sequences, a **deadlock cycle** is possible.

#### Scenario: Cross-Order Deadlock Cycle
Consider two simultaneous cancellations or return confirmations involving two products: `Product A` (`id: 'prod-001'`) and `Product B` (`id: 'prod-002'`).
- **Transaction 1 (Order #101):** Contains line items `[Product A, Product B]`.
  - Step 1: Acquires exclusive lock on `Product A`.
- **Transaction 2 (Order #102):** Contains line items `[Product B, Product A]`.
  - Step 1: Acquires exclusive lock on `Product B`.
- **Conflict:**
  - Transaction 1 attempts to lock `Product B` $\rightarrow$ Blocks waiting for Transaction 2.
  - Transaction 2 attempts to lock `Product A` $\rightarrow$ Blocks waiting for Transaction 1.
- **Outcome:** Both transactions block indefinitely until PostgreSQL's `deadlock_timeout` (default 1000ms) expires, whereupon PostgreSQL terminates one of the transactions with:
  `ERROR: 40P01: deadlock detected`.

#### Scenario: Duplicate Product in Multiple Line Items
If an order contains multiple variants of the same base product (e.g. `Variant V1` of `Product A` and `Variant V2` of `Product A`):
- Iteration 1 locks `Product A`, then locks `Variant V1`.
- Iteration 2 re-acquires lock on `Product A` (re-entrant within same transaction), then locks `Variant V2`.
- While re-entrant locking on the same transaction does not self-deadlock in PostgreSQL, if another transaction locks `Variant V2` before `Product A`, an inter-table deadlock cycle can occur.

---

### 3.3 Recommended Deterministic Lock Ordering Pattern (For Stage 2 Architecture)

To mathematically eliminate deadlock risk across all concurrent inventory operations, lock acquisitions must adhere to a **global deterministic lock hierarchy**:

1. **Table Hierarchy:** Always acquire locks in a fixed order across tables:
   `"Order"` $\rightarrow$ `"Product"` $\rightarrow$ `"ProductVariant"`.
2. **Row Hierarchy:** Always sort row IDs in ascending order (`ORDER BY id ASC`) before locking:
   ```typescript
   // 1. Extract and sort unique Product IDs
   const uniqueProductIds = Array.from(new Set(items.map((i) => i.productId))).sort();

   // 2. Batch lock all Products in deterministic ascending order
   if (uniqueProductIds.length > 0) {
     const lockedProducts = await tx.$queryRaw<Array<{ id: string; stockQuantity: number }>>`
       SELECT id, "stockQuantity" 
       FROM "Product" 
       WHERE id = ANY(${uniqueProductIds}::text[]) 
       ORDER BY id ASC 
       FOR UPDATE
     `;
   }

   // 3. Extract and sort unique Variant IDs
   const uniqueVariantIds = Array.from(new Set(items.map((i) => i.variantId).filter(Boolean))).sort();

   // 4. Batch lock all Variants in deterministic ascending order
   if (uniqueVariantIds.length > 0) {
     const lockedVariants = await tx.$queryRaw<Array<{ id: string; stockQuantity: number }>>`
       SELECT id, "stockQuantity" 
       FROM "ProductVariant" 
       WHERE id = ANY(${uniqueVariantIds}::text[]) 
       ORDER BY id ASC 
       FOR UPDATE
     `;
   }
   ```
*(Note: As per instructions, this recommendation is documented for subsequent implementation and no code modifications were made during this verification task).*

---

## 4. Test Database Provisioning Requirements

To enable the execution of the 4 real PostgreSQL concurrency integration tests, the operations/DevOps team must provision the isolated test database as follows:

### Step 1: Create Database
Connect to the local PostgreSQL instance:
```sql
CREATE DATABASE dsl_stationery_test;
```

### Step 2: Push Prisma Schema
Apply the existing Prisma schema to the newly created test database:
```bash
cd backend
npx prisma db push --schema=prisma/schema.prisma
```

### Step 3: Configure Environment
Add `TEST_DATABASE_URL` to `backend/.env.test` or system environment:
```env
TEST_DATABASE_URL="postgresql://<user>:<password>@localhost:5432/dsl_stationery_test?schema=public"
```
*(Ensure the database name contains `_test` to satisfy the safety guard).*

### Step 4: Execute Concurrency Integration Suite
Run the dedicated test suite:
```bash
cd backend
npx vitest run src/modules/orders/orders-concurrency.integration.spec.ts
```

---

## 5. Development Database Protection Verification

Direct database verification was performed to confirm zero impact on development state:

```javascript
// Query executed via direct pg pool:
SELECT id, name, "stockQuantity" FROM "Product" WHERE id = 'cmw0j4cro00089kusmwsbv48t';
```

- **Protected Product ID:** `cmw0j4cro00089kusmwsbv48t`
- **Product Name:** `Double Submission Test Product`
- **Verified Stock Quantity:** **Exactly 10** (Untouched)
- **Live Orders & Returns:** No development orders, return records, or customer data were altered.
- **Security & Payments:** `onlineCardEnabled=false`, PayHere sandbox settings, and RBAC permissions remain completely unchanged.

