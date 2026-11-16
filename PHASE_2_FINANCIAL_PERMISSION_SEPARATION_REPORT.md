# DSL STATIONERY — PHASE 2: FINANCIAL PERMISSION SEPARATION REPORT
## Production Security Implementation & Multi-Role Authorization Verification

**Author:** Antigravity Senior Security & Database Architect  
**Project:** DSL Stationery E-Commerce Platform  
**Environment:** Next.js 16 App Router · NestJS 11 · Prisma 7 · PostgreSQL 18.4  
**Date of Execution:** November 15, 2026  
**Status:** FULLY IMPLEMENTED & VERIFIED  

---

## 1. Executive Summary

In Phase 1 of the DSL Stationery RBAC project, 46 system permissions were audited and verified across 14 backend controllers and 25 admin pages. However, operational and financial powers remained coupled under coarse permissions:
- `orders.update_status` previously permitted both everyday packing/fulfillment operations and irreversible order cancellations.
- Broad order viewing and update permissions permitted triggering manual refunds.
- `payments.view` permitted both non-sensitive viewing and the critical verification/approval of offline bank deposit slips.
- `settings.manage` gave access to general store metadata as well as confidential bank accounts and payout destinations without masking.

**Phase 2: Financial Permission Separation** successfully decomposes these operations into **5 new, high-security granular permissions**, expanding the authoritative permission catalog from **46 to 51 permissions**. Through strict database migrations, backend endpoint guards, sensitive data masking, and frontend button-level gating, the DSL Stationery platform now enforces strict Separation of Duties (SoD) and the Principle of Least Privilege across all administrator roles.

---

## 2. Granular Financial Permissions Catalog

The following 5 permissions were introduced via Prisma migration `20261115190000_add_verification_challenge_and_financial_permissions` and registered in `AUTHORITATIVE_PERMISSIONS`:

| # | Permission Key | Category | Name | Description | Risk Level | Initial Roles Granted |
|---|---|---|---|---|---|---|
| 1 | `orders.fulfill` | Orders | Fulfill Orders | Process order fulfillment, packing, and dispatch transitions | Moderate | `super_admin`, `project_manager`, `order_manager` |
| 2 | `orders.cancel` | Orders | Cancel Orders | Cancel active customer orders and release inventory reservations | High | `super_admin`, `project_manager`, `order_manager` |
| 3 | `payments.verify_bank_deposit` | Payments | Verify Bank Deposit Slips | Approve, verify, or reject manual offline bank transfer slips | Critical | `super_admin` only |
| 4 | `orders.refund` | Orders | Process Order Refunds | Authorize and execute financial customer refunds | Critical | `super_admin` only |
| 5 | `settings.financial` | Settings | Manage Financial Settings | Modify bank accounts, payment gateway credentials, and view unmasked financial data | Critical | `super_admin` only |

### Database Verification
PostgreSQL query verification confirming 51 authoritative permissions in table `"permissions"`:
```sql
SELECT id, key, category, name FROM permissions WHERE key LIKE '%.fulfill' OR key LIKE '%.cancel' OR key LIKE '%.verify_bank_deposit' OR key LIKE '%.refund' OR key LIKE '%.financial';
```
Result:
- `cmwi11a0u0000abcde0000001` | `orders.fulfill` | `orders` | Fulfill Orders
- `cmwi11a0u0000abcde0000002` | `orders.cancel` | `orders` | Cancel Orders
- `cmwi11a0u0000abcde0000003` | `payments.verify_bank_deposit` | `payments` | Verify Bank Deposit Slips
- `cmwi11a0u0000abcde0000004` | `orders.refund` | `orders` | Process Order Refunds
- `cmwi11a0u0000abcde0000005` | `settings.financial` | `settings` | Manage Financial Settings

---

## 3. Backend Authorization Enforcement

### 3.1 Order Fulfillment vs. Cancellation Separation (`admin-orders.controller.ts`)
Legacy endpoints relied solely on `@RequirePermissions('orders.update_status')`. In Phase 2:
1. `PATCH /admin/orders/:id/status`:
   - Inspects the target status dynamically:
   - If target is `OrderStatus.CANCELLED`, dynamically verifies that the user possesses `orders.cancel`.
   - If target is an operational fulfillment transition (`PROCESSING`, `PACKED`, `SHIPPED`, `DELIVERED`), dynamically verifies `orders.fulfill`.
2. `POST /admin/orders/:id/cancel`:
   - Gated with `@RequirePermissions('orders.cancel')`.
3. `POST /admin/orders/:id/refund` & `POST /admin/orders/refunds/:refundId/process`:
   - Strictly gated with `@RequirePermissions('orders.refund')`.

```typescript
// backend/src/modules/orders/admin-orders.controller.ts
@Patch(':id/status')
@RequirePermissions('orders.update_status')
async updateOrderStatus(
  @Param('id') id: string,
  @Body() dto: UpdateOrderStatusDto,
  @CurrentUser() user: any,
) {
  if (dto.status === OrderStatus.CANCELLED) {
    if (!hasUserPermission(user, 'orders.cancel')) {
      throw new ForbiddenException('Missing required permission: orders.cancel');
    }
  } else {
    if (!hasUserPermission(user, 'orders.fulfill')) {
      throw new ForbiddenException('Missing required permission: orders.fulfill');
    }
  }
  return this.adminOrdersService.updateOrderStatus(id, dto, user.id);
}

@Post(':id/cancel')
@RequirePermissions('orders.cancel')
async cancelOrder(@Param('id') id: string, @Body() dto: CancelOrderDto, @CurrentUser() user: any) {
  return this.adminOrdersService.cancelOrder(id, dto, user.id);
}
```

### 3.2 Bank Transfer Verification Protection (`payments.controller.ts`)
Manual bank slip verification was decoupled from generic payment viewing. Only callers holding `payments.verify_bank_deposit` can approve or reject offline deposit submissions:

```typescript
// backend/src/modules/payments/payments.controller.ts
@Patch('admin/payments/bank-transfers/:submissionId/approve')
@RequirePermissions('payments.verify_bank_deposit')
async approveBankTransfer(
  @Param('submissionId') submissionId: string,
  @Body() dto: ReviewBankTransferDto,
  @CurrentUser('id') adminId: string,
) {
  return this.bankTransferService.approveSubmission(submissionId, adminId, dto.notes);
}

@Patch('admin/payments/bank-transfers/:submissionId/reject')
@RequirePermissions('payments.verify_bank_deposit')
async rejectBankTransfer(
  @Param('submissionId') submissionId: string,
  @Body() dto: ReviewBankTransferDto,
  @CurrentUser('id') adminId: string,
) {
  return this.bankTransferService.rejectSubmission(submissionId, adminId, dto.notes);
}
```

### 3.3 Financial Settings & Sensitive Data Masking (`store-settings.controller.ts` & `.service.ts`)
1. **Mutation Protection:** `PUT /store-settings/admin/bank-transfer` requires `@RequirePermissions('settings.financial')`.
2. **Confidential Account Number Masking:**
   - In `GET /store-settings/admin`, the account number is masked (`••••••••8239`) by default.
   - Only requests from a verified `super_admin` or users with `settings.financial` receive the raw plaintext account number.
   - `maskedAccountNumber` is provided universally for administrative identification.

```typescript
// backend/src/modules/store-settings/store-settings.service.ts
export function maskAccountNumber(acc?: string | null): string | null {
  if (!acc) return null;
  const trimmed = acc.trim();
  if (trimmed.length <= 4) return '••••'.slice(0, trimmed.length);
  return '••••••••' + trimmed.slice(-4);
}
```

---

## 4. Frontend UI Action Gating & Privacy Shield

All administrative views were updated to query `hasPermission(...)` from `useAdminAuth`:

1. **Order Detail (`frontend/src/app/admin/orders/[id]/page.tsx`):**
   - **Fulfill / Progress Buttons:** Gated behind `hasPermission('orders.fulfill')`.
   - **Cancel Order Modal Trigger:** Gated behind `hasPermission('orders.cancel')`.
   - **Refund Section:** Gated behind `hasPermission('orders.refund')`.
2. **Bank Transfer Verification (`frontend/src/app/admin/payments/bank-transfers/page.tsx`):**
   - Approve & Reject action buttons only render if `hasPermission('payments.verify_bank_deposit')` is true.
   - Protected actions initiate a Step-Up Double Verification modal before sending requests to the backend.
3. **Store Settings (`frontend/src/app/admin/settings/page.tsx`):**
   - Bank configuration editing is disabled and displays a read-only lock icon unless the user holds `settings.financial`.
   - The bank account input field shows masked characters (`••••••••8239`) with an explicit "Sensitive Financial Data — Restricted" badge.

---

## 5. Multi-Role Authorization Matrix

The matrix below reflects the enforced production state across all default system roles:

| Module / Operation | Permission Key | Super Admin | Project Manager | Order Manager | Product Manager | Customer Manager | Custom Roles (Default) |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Fulfill / Dispatch Orders | `orders.fulfill` | **ALLOW** | **ALLOW** | **ALLOW** | DENY (403) | DENY (403) | DENY |
| Cancel Orders | `orders.cancel` | **ALLOW** | **ALLOW** | **ALLOW** | DENY (403) | DENY (403) | DENY |
| Verify Bank Deposit Slips | `payments.verify_bank_deposit` | **ALLOW** | DENY (403) | DENY (403) | DENY (403) | DENY (403) | DENY |
| Execute Order Refunds | `orders.refund` | **ALLOW** | DENY (403) | DENY (403) | DENY (403) | DENY (403) | DENY |
| Edit Financial Settings | `settings.financial` | **ALLOW** | DENY (403) | DENY (403) | DENY (403) | DENY (403) | DENY |
| View Unmasked Bank Account | `settings.financial` | **UNMASKED** | **MASKED** | **MASKED** | **MASKED** | **MASKED** | **MASKED** |

---

## 6. Automated Multi-Role Verification Evidence

An automated end-to-end verification suite (`scratch/verify_phase_2.js`) was executed against the live PostgreSQL database and NestJS HTTP server (`http://localhost:4000/api/v1`). All 16 checks passed:

```
================================================================
DSL STATIONERY — PHASE 2 AUTOMATED MULTI-ROLE VERIFICATION SUITE
================================================================

[PASS] Total Permissions in Database: Expected 51 permissions, found 51
[PASS] Granular Financial Permissions Created: Found 5/5 granular permissions in DB
[PASS] Super Admin Access to Security Challenges: Status 200
[PASS] Project Manager Blocked on Security Challenges (403): Status 403 (Forbidden enforced)
[PASS] Super Admin Access to Private Admin Activities: Status 200
[PASS] Project Manager Blocked on Private Admin Activities (403): Status 403 (Forbidden enforced)
[PASS] Generate Double Verification Challenge: ChallengeId: cmwi1inmi0005h4us4xmvy1c6, Status 200
[PASS] Verification Challenge Persisted in PostgreSQL: Status: PENDING, Attempts: 0
[PASS] Reject Invalid OTP Code and Increment Attempts: Status 400, Attempts: 1
[PASS] Project Manager Blocked on Financial Bank Settings PUT (403): Status 403 (Missing settings.financial)
[PASS] Mask Account Number for Roles Lacking settings.financial: Masked Account Number: "••••••••8239"
[PASS] Super Admin Views Unmasked Account Number: Unmasked Account Number: "8204918239"
[PASS] Project Manager Blocked on Bank Deposit Verification (403): Status 403 (Missing payments.verify_bank_deposit)
[PASS] Order Manager Blocked on Bank Deposit Verification (403): Status 403 (Missing payments.verify_bank_deposit)
[PASS] Order Manager Blocked on Refund Execution (403): Status 403 (Missing orders.refund)
[PASS] Product Manager Blocked on Order Cancellation (403): Status 403 (Missing orders.cancel)

================================================================
SUITE RESULT: ALL TESTS PASSED (16/16)
================================================================
```

---

## 7. Conclusion

Phase 2: Financial Permission Separation is complete and fully operational.
1. Financial actions are strictly decoupled from operational store duties.
2. Sensitive bank account numbers are masked across non-financial roles.
3. Every high-risk route is protected both on the backend API layer and frontend client UI.
4. Database integrity is preserved with zero data loss.

