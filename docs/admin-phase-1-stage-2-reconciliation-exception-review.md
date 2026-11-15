# DSL Stationery — Admin Phase 1, Stage 2: Reconciliation Exception Review

**Document ID:** `AUDIT-ADMIN-PHASE1-STAGE2-RECON-EXC-001`  
**Review Date:** 2026-11-14  
**Audit Target Database:** `dsl_stationery_test` (Isolated Test Database)  
**Investigation Scope:** All 12 Reconciliation Discrepancies Detected during Stage 2 QA  
**Outcome:** **100% Expected Test Data (0 Unresolved Discrepancies)**  

---

## 1. Executive Summary & Purpose

During the Stage 2 final manual QA audit and reconciliation dashboard verification, the reconciliation engine identified **12 discrepancy exceptions** across the 20 total orders in the test database (`dsl_stationery_test`).

To guarantee financial data integrity, a thorough, read-only post-QA investigation was conducted to:
1. Individually inspect all 12 flagged orders in the PostgreSQL database.
2. Determine the exact root cause and provenance of each exception.
3. Classify each exception as either **Expected Test Data** or an **Unresolved System Defect**.
4. Verify that no financial records were deleted, suppressed, or modified to achieve a clean report.
5. Confirm that the development database (`dsl_stationery`) remains entirely unimpacted.

---

## 2. Discrepancy Classification & Summary Table

The reconciliation engine evaluates 6 distinct financial discrepancy types:

| Discrepancy Code | Description | Flagged Count | Expected Test Data | Unresolved | Status |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`PAID_WITHOUT_COLLECTION`** | Order marked `PAID` but has zero verified collection evidence in `PaymentAttempt` | 12 | 12 | 0 | **Reconciled (Expected QA Fixtures)** |
| **`EXCEEDS_COLLECTION`** | Completed refund total exceeds verified collections | 0 | 0 | 0 | **Clear (0 Violations)** |
| **`DUPLICATE_PAYMENT_REF`** | Gateway payment reference reused across multiple orders | 0 | 0 | 0 | **Clear (0 Violations)** |
| **`DUPLICATE_REFUND_REF`** | Gateway refund reference reused across multiple refunds | 0 | 0 | 0 | **Clear (0 Violations)** |
| **`COMPLETED_WITHOUT_EVIDENCE`** | Refund marked `COMPLETED` without external reference | 0 | 0 | 0 | **Clear (0 Violations)** |
| **`RETURN_REFUND_MISMATCH`** | Return-linked refund total exceeds returned item value | 0 | 0 | 0 | **Clear (0 Violations)** |
| **TOTAL** | | **12** | **12** | **0** | **100% Accounted For** |

---

## 3. Detailed Investigation of All 12 Exceptions

Each of the 12 exceptions was generated during the three QA test passes conducted to test blocked payment methods and verify that the reconciliation engine accurately surfaces missing collection evidence.

### Group 1: Final QA Pass Fixtures (Pass 3)

#### 1. Order `DSL-QA-DISC1-4130`
- **Order ID:** `cmwgeuk6c000f2cusj0mnh63d`
- **Payment Method:** `CARD_PAYHERE`
- **Payment Status:** `PAID`
- **Order Total:** LKR 30.00 (3,000 cents)
- **Verified Collections:** LKR 0.00 (0 rows in `PaymentAttempt`)
- **Completed Refunds:** LKR 0.00
- **Flagged Discrepancy:** `PAID_WITHOUT_COLLECTION`
- **Root Cause & Origin:** Specifically seeded in QA Item 6 as an intentional discrepancy fixture to verify that the reconciliation dashboard and table filter correctly detect and highlight orders marked `PAID` without corresponding PayHere webhook verification rows.
- **Classification:** **Expected Test Data**

#### 2. Order `DSL-QA-BANK-4112`
- **Order ID:** `cmwgeuk5x000d2cusj3k3g29p`
- **Payment Method:** `BANK_TRANSFER`
- **Payment Status:** `PAID`
- **Order Total:** LKR 40.00 (4,000 cents)
- **Verified Collections:** LKR 0.00 (Unverified manual deposit)
- **Completed Refunds:** LKR 0.00
- **Flagged Discrepancy:** `PAID_WITHOUT_COLLECTION`
- **Root Cause & Origin:** Seeded in QA Item 5 to verify that unverified bank transfer refunds are strictly blocked by the backend API and surfaced as missing collection evidence in reconciliation.
- **Classification:** **Expected Test Data**

#### 3. Order `DSL-QA-KOKO-4096`
- **Order ID:** `cmwgeuk5e000b2cussz8xrsui`
- **Payment Method:** `KOKO_BNPL`
- **Payment Status:** `PAID`
- **Order Total:** LKR 35.00 (3,500 cents)
- **Verified Collections:** LKR 0.00
- **Completed Refunds:** LKR 0.00
- **Flagged Discrepancy:** `PAID_WITHOUT_COLLECTION`
- **Root Cause & Origin:** Seeded in QA Item 5 to verify that Koko BNPL refunds are blocked due to lack of gateway integration, and that unverified Koko orders are flagged.
- **Classification:** **Expected Test Data**

#### 4. Order `DSL-QA-COD-4067`
- **Order ID:** `cmwgeuk4l00092custk03zlg1`
- **Payment Method:** `CASH_ON_DELIVERY`
- **Payment Status:** `PAID`
- **Order Total:** LKR 25.00 (2,500 cents)
- **Verified Collections:** LKR 0.00
- **Completed Refunds:** LKR 0.00
- **Flagged Discrepancy:** `PAID_WITHOUT_COLLECTION`
- **Root Cause & Origin:** Seeded in QA Item 5 to verify that Cash on Delivery refunds are strictly blocked without courier remittance slips, and that delivered COD orders lacking verified bank remittance are flagged.
- **Classification:** **Expected Test Data**

---

### Group 2: Intermediate QA Pass Fixtures (Pass 2)

#### 5. Order `DSL-QA-DISC1-0376`
- **Order ID:** `cmwgeu9ka000fa0ushuq9cbvg`
- **Payment Method:** `CARD_PAYHERE`
- **Payment Status:** `PAID`
- **Order Total:** LKR 30.00 (3,000 cents)
- **Verified Collections:** LKR 0.00
- **Flagged Discrepancy:** `PAID_WITHOUT_COLLECTION`
- **Root Cause & Origin:** Pass 2 discrepancy fixture for reconciliation filter verification.
- **Classification:** **Expected Test Data**

#### 6. Order `DSL-QA-BANK-0342`
- **Order ID:** `cmwgeu9jd000da0usa18bwdw0`
- **Payment Method:** `BANK_TRANSFER`
- **Payment Status:** `PAID`
- **Order Total:** LKR 40.00 (4,000 cents)
- **Verified Collections:** LKR 0.00
- **Flagged Discrepancy:** `PAID_WITHOUT_COLLECTION`
- **Root Cause & Origin:** Pass 2 fixture for bank transfer validation.
- **Classification:** **Expected Test Data**

#### 7. Order `DSL-QA-KOKO-0326`
- **Order ID:** `cmwgeu9ix000ba0usq2xagik9`
- **Payment Method:** `KOKO_BNPL`
- **Payment Status:** `PAID`
- **Order Total:** LKR 35.00 (3,500 cents)
- **Verified Collections:** LKR 0.00
- **Flagged Discrepancy:** `PAID_WITHOUT_COLLECTION`
- **Root Cause & Origin:** Pass 2 fixture for Koko validation.
- **Classification:** **Expected Test Data**

#### 8. Order `DSL-QA-COD-0300`
- **Order ID:** `cmwgeu9i60009a0usg58r191f`
- **Payment Method:** `CASH_ON_DELIVERY`
- **Payment Status:** `PAID`
- **Order Total:** LKR 25.00 (2,500 cents)
- **Verified Collections:** LKR 0.00
- **Flagged Discrepancy:** `PAID_WITHOUT_COLLECTION`
- **Root Cause & Origin:** Pass 2 fixture for COD validation.
- **Classification:** **Expected Test Data**

---

### Group 3: Initial QA Pass Fixtures (Pass 1)

#### 9. Order `DSL-QA-DISC1-3446`
- **Order ID:** `cmwgeth2g000foouspc04ps2l`
- **Payment Method:** `CARD_PAYHERE`
- **Payment Status:** `PAID`
- **Order Total:** LKR 30.00 (3,000 cents)
- **Verified Collections:** LKR 0.00
- **Flagged Discrepancy:** `PAID_WITHOUT_COLLECTION`
- **Root Cause & Origin:** Pass 1 discrepancy fixture.
- **Classification:** **Expected Test Data**

#### 10. Order `DSL-QA-BANK-3420`
- **Order ID:** `cmwgeth1q000doousexv64zl6`
- **Payment Method:** `BANK_TRANSFER`
- **Payment Status:** `PAID`
- **Order Total:** LKR 40.00 (4,000 cents)
- **Verified Collections:** LKR 0.00
- **Flagged Discrepancy:** `PAID_WITHOUT_COLLECTION`
- **Root Cause & Origin:** Pass 1 fixture for bank transfer validation.
- **Classification:** **Expected Test Data**

#### 11. Order `DSL-QA-KOKO-3405`
- **Order ID:** `cmwgeth1b000boousg53kytwe`
- **Payment Method:** `KOKO_BNPL`
- **Payment Status:** `PAID`
- **Order Total:** LKR 35.00 (3,500 cents)
- **Verified Collections:** LKR 0.00
- **Flagged Discrepancy:** `PAID_WITHOUT_COLLECTION`
- **Root Cause & Origin:** Pass 1 fixture for Koko validation.
- **Classification:** **Expected Test Data**

#### 12. Order `DSL-QA-COD-3393`
- **Order ID:** `cmwgeth0z0009oous7fnji5ip`
- **Payment Method:** `CASH_ON_DELIVERY`
- **Payment Status:** `PAID`
- **Order Total:** LKR 25.00 (2,500 cents)
- **Verified Collections:** LKR 0.00
- **Flagged Discrepancy:** `PAID_WITHOUT_COLLECTION`
- **Root Cause & Origin:** Pass 1 fixture for COD validation.
- **Classification:** **Expected Test Data**

---

## 4. Analysis of Clean Orders (Zero Discrepancies)

Of the 20 total orders in `dsl_stationery_test`, **8 orders** exhibited **zero discrepancies**:
- **6 Verified Orders with Completed Refunds:**
  - `DSL-QA-ORD1-3085` (`cmwgeujdq00012cusax7wjiog`): 10,000 cents collected via PayHere, 4,000 cents refunded, 6,000 cents net available balance. Fully balanced.
  - `DSL-QA-RET2-3868` (`cmwgeujz300052cusrlr0io8k`): 10,000 cents collected via PayHere, 5,000 cents refunded, return items updated to `REFUNDED`. Fully balanced.
  - 4 additional test orders created during earlier QA passes with corresponding verified `PaymentAttempt` records.
- **2 Integration Test Fixtures:** Clean seeded integration test orders.

In all 8 clean orders:
- Verified collections matched or exceeded disbursements.
- Unique gateway payment references were present.
- Refund references were non-empty and unique.
- Return-linked refund amounts matched or were less than the returned goods value.

---

## 5. Why Other Potential Discrepancy Types Had Zero Occurrences

The reconciliation service monitors five other high-risk financial discrepancy types, all of which recorded **0 occurrences**:

1. **`EXCEEDS_COLLECTION` (0 occurrences):**
   - *Why zero:* Stage 2.2 hardened the backend `refund()` and `approve()` methods with database-level isolation and strict pre-condition checks (`availableToRefund = verifiedCollected - completedRefunds - reservedInFlight`). The system mathematically rejects any refund amount greater than available funds.
2. **`DUPLICATE_PAYMENT_REF` (0 occurrences):**
   - *Why zero:* Database unique constraints and payment webhook validation prevent duplicate gateway collection references.
3. **`DUPLICATE_REFUND_REF` (0 occurrences):**
   - *Why zero:* Stage 2.1 added a unique index on `RefundRecord.externalReference`, and Stage 2.2 validates that every external completion reference is globally unique.
4. **`COMPLETED_WITHOUT_EVIDENCE` (0 occurrences):**
   - *Why zero:* Stage 2.2 enforces that `externalReference` must be non-empty, trimmed, and formatted before any refund can transition to `COMPLETED`.
5. **`RETURN_REFUND_MISMATCH` (0 occurrences):**
   - *Why zero:* Stage 2.3 validates that return-linked refunds cannot exceed the monetary value of the approved and received items linked to the return request.

---

## 6. Financial Data Preservation Confirmation

In accordance with strict financial audit requirements:
- **No records were deleted:** None of the 12 discrepancy rows were deleted, cleared, or hidden.
- **No data was modified:** No mock `PaymentAttempt` rows were backfilled or fabricated to artificially force the exception count to zero.
- **Integrity preserved:** The reconciliation dashboard functions as an authentic mirror of the database state, properly detecting and displaying the exact test conditions introduced.
- **Development database safety:** The primary development database (`dsl_stationery`) remains completely untouched:
  - Product `cmw0j4cro00089kusmwsbv48t` stock: **10 units** (exact)
  - Total orders: **2**
  - Total refunds: **0**

---

## 7. Conclusion & Audit Sign-Off

The investigation proves that all 12 reconciliation exceptions detected on `dsl_stationery_test` are **100% expected test fixtures** created deliberately during manual QA to validate edge cases (unverified methods and discrepancy detection). There are **0 unresolved bugs or financial leaks**.

**Verdict:** **AUDIT PASSED — ALL 12 EXCEPTIONS RECONCILED**

