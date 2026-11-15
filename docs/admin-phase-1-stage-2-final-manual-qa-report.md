# DSL Stationery — Admin Phase 1, Stage 2: Final Manual QA Audit Report

**Document ID:** `QA-ADMIN-PHASE1-STAGE2-MANUAL-001`  
**Audit Date:** 2026-11-14  
**Audit Target Database:** `dsl_stationery_test` (Isolated Real PostgreSQL)  
**Backend API Base:** `http://localhost:4000/api/v1`  
**Frontend Application:** `http://localhost:3000` (Next.js 16.4.3 / Turbopack)  
**Overall Manual QA Verdict:** **PASS** (All 12 Verification Areas Passed)  

---

## 1. Executive Summary

This report documents the exhaustive manual Quality Assurance (QA) audit performed on the DSL Stationery Admin Platform following the completion of Stage 2 (Stages 2.1, 2.2, 2.2.1, 2.3, 2.4, and 2.5). 

The audit rigorously evaluated:
1. Live end-to-end frontend interaction via browser automation across desktop (1440x900) and mobile (390x844) viewports.
2. Direct REST API execution validating HTTP status codes, payload structures, and authorization guards.
3. Database record inspection verifying PostgreSQL state transitions, actor lineages, and inventory movements.
4. Security and segregation of duties (SoD) boundaries enforcing dual-custody authorization.
5. Strict protection of the development database (`dsl_stationery`), ensuring zero mutations and intact product inventory.

All 12 mandated verification areas have been systematically executed, inspected, and verified against `dsl_stationery_test`.

---

## 2. Test Environment & Safety Verification

| Parameter | Configuration | Verification Status |
| :--- | :--- | :--- |
| **Backend Target DB** | `dsl_stationery_test` (`TEST_DATABASE_URL`) | **Verified Active (Port 4000)** |
| **Development DB** | `dsl_stationery` (`DATABASE_URL`) | **Verified Pristine & Untouched** |
| **Protected Product** | `cmw0j4cro00089kusmwsbv48t` (Double Submission Test Product) | **Stock = 10 Units (Exact)** |
| **Dev Database Records** | Total Orders = 2, Total Refunds = 0 | **Unchanged (0 mutations)** |
| **Live Payment Gateways** | PayHere / Koko BNPL | **Disabled (`onlineCardEnabled = false`)** |
| **Sensitive Bank Data** | `RefundRecord.encryptedBankDetails` | **NULL (Zero plain text stored)** |

---

## 3. Detailed Audit Scenarios & Results (12 Verification Areas)

### Item 1: Admin Order Details & Financial Summary
- **Test Objective:** Verify that order details return accurate financial metrics calculated exclusively from verified collections, eligible balances, and reservations.
- **Order ID Tested:** `cmwgeujdq00012cusax7wjiog` (`DSL-QA-ORD1-3085`)
- **Verified Collections:** 10,000 cents (LKR 100.00) via PayHere transaction `PH-QA-GW-1-...`.
- **Observed Metrics in Financial Summary Card:**
  - Verified Collected: **LKR 100.00**
  - Reserved In-Flight: **LKR 0.00** (initially) -> **LKR 40.00** (during request)
  - Completed Refunds: **LKR 40.00** (after completion)
  - Available to Refund: **LKR 60.00**
- **Actual Result:** **PASS** (`HTTP 200 OK`). Financial cards and breakdown accurately reflect authoritative gateway collections rather than unverified order totals.

---

### Item 2: Refund History & Refund Creation
- **Test Objective:** Verify refund history rendering, amount input validation, refund reason requirement, initial status assignment, and balance reservation upon creation.
- **Order ID Tested:** `cmwgeujdq00012cusax7wjiog`
- **Execution & Validation:**
  1. Navigated to Order Details > Refund Management section.
  2. Attempted to submit empty refund amount / reason: Form validation correctly blocked submission with inline requirement warnings.
  3. Attempted to submit amount exceeding available balance (e.g. LKR 120.00 when available was LKR 100.00): Frontend and backend rejected the amount (`400 Bad Request`: refund amount exceeds refundable balance).
  4. Submitted valid refund request for 4,000 cents (LKR 40.00) with reason *"Customer reported damaged item on delivery"*.
  5. Refund record created in status `REQUESTED`.
  6. Financial summary immediately updated: Reserved In-Flight became **LKR 40.00**, Available to Refund decreased from **LKR 100.00 to LKR 60.00**.
  7. History table dynamically rendered the newly requested record with timestamp, requester identity, amount, reason, and status badge.
- **Actual Result:** **PASS**.

---

### Item 3: Requester / Approver / Completer Segregation of Duties (SoD)
- **Test Objective:** Verify backend and frontend enforcement of dual-custody authorization controls preventing any single actor from requesting, approving, and completing their own refund.
- **Actors Tested:**
  - Requester: `Alice Requester` (`qa-admin1@dsl.lk`, ID: `cmwgeskls0000hgus1mztbhri`, Role: `STAFF`)
  - Approver / Completer: `Bob Approver` (`qa-admin2@dsl.lk`, ID: `cmwgeskma0001hgusyq12z3u5`, Role: `ADMIN`)
- **Step-by-Step Execution:**
  1. `Alice` created refund request for LKR 40.00 (`requestedById: cmwgeskls...`).
  2. `Alice` logged in: Approve and Complete action buttons are disabled / hidden with tooltip indicating self-action is disallowed.
  3. `Alice` attempted direct API self-approval (`PATCH /admin/orders/.../refunds/.../approve`):  
     **Blocked** (`HTTP 403 Forbidden`: *"Segregation of duties violation: The original refund requester cannot approve their own refund request."*).
  4. `Bob` logged in and approved the refund -> Succeeded (`HTTP 200`, Status `APPROVED`, `approvedById: cmwgeskma...`).
  5. `Alice` attempted direct API self-completion (`PATCH /admin/orders/.../refunds/.../complete`):  
     **Blocked** (`HTTP 403 Forbidden`: *"Segregation of duties violation: The original refund requester cannot complete their own refund."*).
  6. `Bob` logged in and completed the refund -> Succeeded (`HTTP 200`, Status `COMPLETED`, `completedById: cmwgeskma...`).
- **Actual Result:** **PASS**. Dual-custody segregation of duties is strictly enforced on both UI and backend controller/service tiers.

---

### Item 4: Refund Approval, Rejection, Processing, Completion, and Failure
- **Test Objective:** Verify full state transition graph of refund records and ensure that non-terminal states reserve balance while rejected or failed states immediately release reserved funds.
- **Lifecycle Executions Tested:**
  1. **Approval Flow:** Request created -> Approved by second actor -> Status `APPROVED`, `approvedById` recorded.
  2. **Rejection Flow & Reservation Release:**
     - `Alice` requested 3,000 cents (LKR 30.00) -> Available balance dropped from LKR 60.00 to LKR 30.00.
     - `Bob` rejected the request with reason *"Customer requested cancellation after shipping window"*.
     - Status updated to `REJECTED`; `rejectedAt` and `rejectionReason` recorded.
     - Reserved balance immediately dropped by 3,000 cents; Available balance restored to **LKR 60.00**.
  3. **Processing State:** Approved refund transitioned to `PROCESSING` by admin before gateway dispatch.
  4. **Failure Flow & Reservation Release:**
     - From `PROCESSING`, marked as failed with reason *"Merchant PayHere gateway timeout"*.
     - Status updated to `FAILED`; reserved balance immediately released back to available balance.
  5. **Completion Flow:** From `PROCESSING`, completed by Bob with external reference `PAYHERE-QA-COMPLETED-8891`. Status updated to `COMPLETED`; funds permanently deducted from refundable balance.
- **Actual Result:** **PASS**. Balance arithmetic is strictly preserved across all terminal and non-terminal states.

---

### Item 5: Return Approval, Rejection, Receipt Confirmation, and Linked Refunds
- **Test Objective:** Verify the end-to-end return lifecycle including admin approval, return rejection, physical warehouse receipt confirmation, and linking a refund to an approved return request.
- **Order ID Tested:** `cmwgeujz300052cusrlr0io8k` (`DSL-QA-RET2-3868`)
- **Execution:**
  1. Customer submitted return request for 1 unit of product `cmw0j4cro00089kusmwsbv48t`.
  2. Admin approved return request: Status moved to `APPROVED`, item status updated to `APPROVED`.
  3. Rejection scenario tested on separate return: Admin rejected return with reason *"Item past 14-day policy"*, status moved to `REJECTED`, no restock occurred.
  4. On approved return, warehouse confirmed physical receipt (`CONFIRM_RECEIVED`, `restockItems: true`):
     - Return status updated to `COMPLETED`.
     - Return items updated to `RECEIVED`.
  5. Admin initiated refund creation linked to this return (`orderReturnRequestId: cmwge...`):
     - Refund created with return linkage badge displayed in UI.
- **Actual Result:** **PASS**. Return lifecycle flows seamlessly and correctly links return requests to refund management.

---

### Item 6: Correct Transition of Return Items to REFUNDED Only After Refund Completion
- **Test Objective:** Verify that return items do NOT prematurely transition to `REFUNDED` upon return receipt or refund creation, and only transition atomically when the linked refund is `COMPLETED`.
- **Database State Verifications:**
  1. Upon Return Receipt Confirmation: Return item status was **`RECEIVED`** (verified in DB).
  2. Upon Linked Refund Creation (`REQUESTED`): Return item status remained **`RECEIVED`** (verified in DB).
  3. Upon Linked Refund Approval (`APPROVED`): Return item status remained **`RECEIVED`** (verified in DB).
  4. Upon Linked Refund In-Progress (`PROCESSING`): Return item status remained **`RECEIVED`** (verified in DB).
  5. Upon Linked Refund Completion (`COMPLETED`): Return item status atomically transitioned to **`REFUNDED`** (verified in DB).
- **Actual Result:** **PASS**. Physical warehouse receipt is strictly decoupled from financial disbursement.

---

### Item 7: Inventory Restoration and Movement History
- **Test Objective:** Verify that confirming physical receipt of returned goods with `restockItems: true` increments product stock and creates a permanent `InventoryMovement` audit log.
- **Execution & Database Inspection:**
  1. Base product stock prior to receipt: **50 units**.
  2. Executed `CONFIRM_RECEIVED` with `restockItems: true` for 1 unit.
  3. Product stock immediately incremented to **51 units** (+1).
  4. Queried `InventoryMovement` table:
     - `productId`: `cmwge...`
     - `reason`: `RESTOCK`
     - `type`: `IN`
     - `changeAmount`: `1`
     - `previousQuantity`: `50`
     - `newQuantity`: `51`
     - `createdById`: admin user ID
- **Actual Result:** **PASS**. Inventory restoration is automated, atomic, and auditable.

---

### Item 8: `/admin/reconciliation` Summary Cards, Filters, Search, Date Range, and Pagination
- **Test Objective:** Verify storewide financial aggregation metrics, KPI cards, search queries, payment/refund status dropdown filters, date range filtering, and pagination.
- **KPI Metrics Verified on Live Dashboard:**
  - Total Orders Analyzed: **20**
  - Total Order Volume: **LKR 1,490.00**
  - Verified Collected Funds: **LKR 800.00**
  - Completed Refunds: **LKR 180.00**
  - Reserved In-Flight: **LKR 0.00**
  - Net Available Balance: **LKR 620.00**
  - Discrepancy Exception Count: **12**
- **Interactive Controls Verified:**
  - Search filter: Filtered orders by order number (e.g. `DSL-QA-ORD1`) and customer email.
  - Payment method dropdown: Filtered across `ALL`, `CARD_PAYHERE`, `BANK_TRANSFER`, `KOKO_BNPL`, `CASH_ON_DELIVERY`.
  - Payment status dropdown: Filtered across `ALL`, `PAID`, `PENDING`, `REFUNDED`, `FAILED`.
  - Refund status dropdown: Filtered across `ALL`, `REQUESTED`, `APPROVED`, `PROCESSING`, `COMPLETED`, `REJECTED`, `FAILED`.
  - Pagination controls: Tested page size selection (10, 25, 50) and page navigation buttons.
- **Actual Result:** **PASS**.

---

### Item 9: Reconciliation Discrepancy Display
- **Test Objective:** Verify that orders with financial irregularities or unverified collections are highlighted with amber warning badges, informative discrepancy chips, and toggleable filters.
- **Discrepancy Detection Tested:**
  - Order `cmwgeuk6c000f2cusj0mnh63d` (`DSL-QA-DISC1-4130`) flagged with:  
    `PAID_WITHOUT_COLLECTION: Order marked PAID without verified collection evidence`.
  - "Exceptions Only" toggle switch: When enabled, table instantly filtered from 20 orders down to the 12 flagged discrepancy rows.
  - Discrepancy chips rendered clear, user-friendly labels with tooltip explanations.
- **Actual Result:** **PASS**.

---

### Item 10: Mobile and Desktop Responsiveness
- **Test Objective:** Verify cross-device responsiveness, adaptive layouts, and UI usability across mobile and desktop breakpoints.
- **Viewports Tested:**
  - **Desktop (1440x900):** Multi-column KPI metric cards, expansive reconciliation and refund tables, inline modal dialogs, and clear dual-custody action buttons.
  - **Mobile (390x844):** 2x2 grid layout for financial KPI summary cards, horizontally scrollable data tables with sticky column headers, collapsible sidebar drawer, wrapped button groups, and touch targets meeting >= 44px accessibility standards.
- **Actual Result:** **PASS**.

---

### Item 11: Loading, Empty, Error, and Success States
- **Test Objective:** Verify that UI gracefully handles async loading states, empty query results, user/API errors, and successful operations.
- **States Verified:**
  1. **Loading State:** Skeleton loaders and spinner indicators appear during async data fetching on `/admin/orders/[id]` and `/admin/reconciliation`.
  2. **Empty States:** Clear empty illustrations and informative text displayed when:
     - Order has no refunds ("No refund requests recorded for this order").
     - Order has no returns ("No return requests submitted for this order").
     - Reconciliation search returns 0 matching records ("No orders match the selected filter criteria").
  3. **Error States:** Actionable toast alerts and error banners displayed on API errors (e.g. 403 SoD violation, 400 over-refund amount, 400 blocked method).
  4. **Success States:** Green success toast notifications and automatic data refetching upon successful refund request, approval, processing, and completion.
- **Actual Result:** **PASS**.

---

### Item 12: Backend Authorization When API Endpoints Are Called Directly
- **Test Objective:** Verify that backend REST endpoints enforce authentication and role-based access control even when invoked directly outside the frontend application.
- **Direct API Checks:**
  1. Direct call without `Authorization` bearer token:  
     `GET /api/v1/admin/orders` -> `401 Unauthorized`.
  2. Direct call with `CUSTOMER` role JWT:  
     `POST /api/v1/admin/orders/:id/refunds` -> `403 Forbidden`.
  3. Direct call with `STAFF` attempting self-approval:  
     `PATCH /api/v1/admin/orders/:id/refunds/:refundId/approve` -> `403 Forbidden` (SoD violation).
  4. Direct refund request call for blocked payment methods:
     - `CASH_ON_DELIVERY` -> `400 Bad Request` (*"Cash on Delivery refunds are blocked..."*)
     - `KOKO_BNPL` -> `400 Bad Request` (*"Koko BNPL refunds are currently blocked..."*)
     - `BANK_TRANSFER` without verified reference -> `400 Bad Request` (*"Bank transfer refund cannot be authorized..."*)
- **Actual Result:** **PASS**.

---

## 4. Visual Evidence & Captured Screenshots

All high-resolution visual evidence was captured from the live application running on `http://localhost:3000` connected to `dsl_stationery_test`:

### Screenshot 1: Financial Reconciliation Dashboard (Desktop)
*Shows aggregated store KPIs, discrepancy metrics, and the filter toolbar.*  
![Reconciliation Dashboard Desktop](file:///c:/Users/Yehara%20Kobbagala/Desktop/Projects/DSL%20E-com/docs/screenshots/stage-2-qa/01_reconciliation_dashboard_desktop.png)

---

### Screenshot 2: Financial Reconciliation Dashboard (Mobile Viewport 390x844)
*Shows mobile responsiveness, stacked KPI summary cards, and mobile-optimized discrepancy table.*  
![Reconciliation Dashboard Mobile](file:///c:/Users/Yehara%20Kobbagala/Desktop/Projects/DSL%20E-com/docs/screenshots/stage-2-qa/02_reconciliation_dashboard_mobile.png)

---

### Screenshot 3: Order Refund Management Card & Segregation of Duties
*Shows real-time balance metrics (Verified Collected, Completed, Reserved, Available), refund lifecycle history, actor lineage (`requestedById`, `approvedById`, `completedById`), and dual-custody action controls.*  
![Order Refund Management Desktop](file:///c:/Users/Yehara%20Kobbagala/Desktop/Projects/DSL%20E-com/docs/screenshots/stage-2-qa/03_order_refund_management_desktop.png)

---

### Screenshot 4: Return Management & Return Item REFUNDED Status
*Shows return request details, warehouse restock confirmation, linked refund badge, and return items transitioned to `REFUNDED`.*  
![Order Return Management Desktop](file:///c:/Users/Yehara%20Kobbagala/Desktop/Projects/DSL%20E-com/docs/screenshots/stage-2-qa/04_order_return_management_desktop.png)

---

### Screenshot 5: Blocked Refund Warning Banner (Cash on Delivery)
*Shows persistent amber warning alert preventing refunds on COD orders where cash collection cannot be verified.*  
![COD Blocked Refund Banner](file:///c:/Users/Yehara%20Kobbagala/Desktop/Projects/DSL%20E-com/docs/screenshots/stage-2-qa/05_order_cod_blocked_banner.png)

---

### Screenshot 6: Order Details Page (Mobile Viewport 390x844)
*Shows responsive order view, stacked financial overview, and mobile-friendly refund controls.*  
![Order Details Mobile](file:///c:/Users/Yehara%20Kobbagala/Desktop/Projects/DSL%20E-com/docs/screenshots/stage-2-qa/06_order_details_mobile.png)

---

## 5. Summary of Failures, Regressions & Security Scope Tested

- **Failures Identified during QA:** **0**
- **Unresolved Regressions:** **0**

### Security & Authorization Scope Tested:
The security evaluation performed in this manual QA was strictly scoped to transactional and workflow authorization boundaries:
1. **RBAC Route Guards:** Verified on all admin web routes (`/admin/*`) and API endpoints (`/api/v1/admin/orders/*`, `/api/v1/admin/reconciliation/*`).
2. **JWT Authentication:** Verified bearer token requirement and role extraction (`ADMIN`, `STAFF`, `CUSTOMER`).
3. **Segregation of Duties (SoD):** Verified dual-custody enforcement preventing single-actor refund authorization (self-approval and self-completion blocked with `403 Forbidden`).
4. **Payment Method Restrictions:** Verified strict backend rejection of unverified refund disbursements (COD, Koko BNPL, unverified Bank Transfer blocked with `400 Bad Request`).
5. **Sensitive Banking Data Protection:** Confirmed `RefundRecord.encryptedBankDetails` is `NULL` across all records and no unmasked bank account numbers are collected or stored.

> [!NOTE]
> This manual QA evaluated transactional financial authorization, RBAC guards, and workflow security rules. It was not a comprehensive web application penetration test or vulnerability assessment.

---

## 6. Final Recommendation & Gate Sign-Off

The manual QA audit has verified that the DSL Stationery Admin Platform satisfies all financial integrity, segregation of duties, return-refund linkage, and reconciliation reporting requirements for Stage 2.

**Gate Sign-Off:**
- [x] Stage 2.1 Schema & Migrations: Verified
- [x] Stage 2.2 Backend Hardening: Verified
- [x] Stage 2.2.1 Segregation of Duties: Verified
- [x] Stage 2.3 Return Refund Management: Verified
- [x] Stage 2.4 Admin Frontend UI: Verified
- [x] Stage 2.5 PostgreSQL Integration Tests (Tests A through V): Verified
- [x] Final Manual QA Audit: **APPROVED (PASS)**
