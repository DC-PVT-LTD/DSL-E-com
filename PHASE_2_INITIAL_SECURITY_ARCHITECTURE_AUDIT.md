# PHASE 2 — INITIAL SECURITY ARCHITECTURE AUDIT
## DSL Stationery E-Commerce Platform

**Audit Timestamp:** 2026-11-15T21:05:00+05:30  
**Environment:** Development / Staging Verification  
**Database:** PostgreSQL 18.4 (`dsl_stationery`) via Prisma 7  
**Backend:** NestJS 11 (`http://localhost:4000/api/v1`)  
**Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS, Zustand (`http://localhost:3000`)

---

## 1. EXECUTIVE SUMMARY & AUDIT OBJECTIVE

The DSL Stationery platform completed its Phase 1 RBAC hardening with 14 backend controllers secured across 50+ endpoints, 25 admin pages protected, 46 database permissions validated, and all migration drifts resolved.

However, financial security and administrative segregation of duties require further hardening under Phase 2:
1. **Financial Operations Coupled to Generic Permissions:** Dangerous operational and financial actions (order fulfillment, order cancellation, bank deposit slip approvals, monetary refund execution, and bank account configuration) are currently grouped under broad permissions (`orders.update_status`, `settings.manage`).
2. **Missing Granular Permissions:** Exactly five new granular permissions must be separated:
   - `orders.fulfill` (mark processing, packing, shipping, delivering)
   - `orders.cancel` (cancel order, restock items)
   - `payments.verify_bank_deposit` (approve or reject manual bank transfer slips)
   - `orders.refund` (execute ledger and monetary refund transactions)
   - `settings.financial` (view and update store bank credentials and payment settings)
3. **Double Verification Gap:** High-risk actions (role permission updates, admin deactivation/reactivation, role deletion, bank credential modifications, manual bank slip approvals, and monetary refund issuances) currently lack secondary step-up authentication.
4. **Audit Logging Segregation:** System audit logs are partially visible to non-Super Admin roles (`project_manager` possesses `audit_logs.view`). Furthermore, mutation endpoints do not uniformly capture before-and-after change diffs or failed security attempts.

This document serves as the Stage A Architectural Blueprint and baseline audit for Phase 2 implementation.

---

## 2. DATABASE ARCHITECTURE BASELINE (LIVE POSTGRESQL STATE)

Inspection of the live database (`dsl_stationery`) confirmed the following exact metrics:

- **Total Roles in DB:** 8 roles
  - **System Roles (5):**
    - `super_admin` (`cmw4wm0hs0012u4us2g1pateo`) — 46/46 permissions
    - `project_manager` (`cmw4wm0ok0013u4usr95elyut`) — 38 permissions
    - `product_manager` (`cmw4wm0s90014u4us83hpjaay`) — 11 permissions
    - `order_manager` (`cmw4wm0tu0015u4usd9btg0pv`) — 6 permissions
    - `customer_manager` (`cmw4wm0uh0016u4us64rzqlxs`) — 8 permissions
  - **Custom Roles (3):**
    - `om_0001` (`cmw8c5yda0005aguskkjq2mlm`, "oder manger")
    - `qa_inspector_role_179474055050` (`cmwhq6r1o0001i8us93fkfazp`)
    - `inline_express_role_1794740559161` (`cmwhq6uwc0003i8usaci1nbut`)
- **Total Permissions in DB:** 46 permissions across 19 categories.
- **Total Role-Permission Bindings:** 130 bindings in `RolePermission`.
- **Total Admin Users:** 16 active administrators.
- **Audit Tables:**
  - `AuditLog`: 1,528 records
  - `OrderAuditLog`: 5 records
- **RefundRecord Table Structure:** Live DB has 8 columns (`id`, `orderId`, `amountCents`, `method`, `reference`, `reason`, `processedBy`, `createdAt`).

---

## 3. ENDPOINT INVENTORY: CURRENT VS. TARGET PERMISSIONS

| Controller | HTTP Method & Route | Current Permission Guard | Target Phase 2 Permission | Step-Up Verification Required? |
| :--- | :--- | :--- | :--- | :--- |
| `admin-orders.controller.ts` | `PATCH /admin/orders/:id/status` | `@RequirePermissions('orders.update_status')` | Dynamic: `orders.fulfill` (for processing/packed/shipped/delivered) vs `orders.cancel` (for cancelled) | No for fulfillment; Optional for cancellation |
| `admin-orders.controller.ts` | `POST /admin/orders/:id/cancel` | `@RequirePermissions('orders.update_status')` | `@RequirePermissions('orders.cancel')` | Yes (Reason + OTP verification) |
| `admin-orders.controller.ts` | `POST /admin/orders/:id/refund` | `@RequirePermissions('orders.update_status')` | `@RequirePermissions('orders.refund')` | Yes (Double verification code required) |
| `admin-orders.controller.ts` | `POST /admin/orders/:id/returns/:returnId/refund` | `@RequirePermissions('orders.update_status')` | `@RequirePermissions('orders.refund')` | Yes (Double verification code required) |
| `admin-orders.controller.ts` | `POST /admin/orders/:id/refunds/record` | `@RequirePermissions('orders.update_status')` | `@RequirePermissions('orders.refund')` | Yes (Double verification code required) |
| `admin-orders.controller.ts` | `POST /admin/orders/:id/refunds/process` | `@RequirePermissions('orders.update_status')` | `@RequirePermissions('orders.refund')` | Yes (Double verification code required) |
| `admin-orders.controller.ts` | `POST /admin/orders/:id/refunds/:refundId/approve` | `@RequirePermissions('orders.update_status')` | `@RequirePermissions('orders.refund')` | Yes (Double verification code required) |
| `admin-orders.controller.ts` | `POST /admin/orders/:id/refunds/:refundId/process` | `@RequirePermissions('orders.update_status')` | `@RequirePermissions('orders.refund')` | Yes (Double verification code required) |
| `admin-orders.controller.ts` | `POST /admin/orders/:id/refunds/:refundId/complete` | `@RequirePermissions('orders.update_status')` | `@RequirePermissions('orders.refund')` | Yes (Double verification code required) |
| `admin-orders.controller.ts` | `POST /admin/orders/:id/refunds/:refundId/reject` | `@RequirePermissions('orders.update_status')` | `@RequirePermissions('orders.refund')` | No |
| `admin-orders.controller.ts` | `POST /admin/orders/:id/refunds/:refundId/fail` | `@RequirePermissions('orders.update_status')` | `@RequirePermissions('orders.refund')` | No |
| `admin-orders.controller.ts` | `PATCH /admin/orders/:id/returns/:returnId/status` | `@RequirePermissions('orders.update_status')` | `@RequirePermissions('orders.update_status')` (Workflow state only) | No |
| `payments.controller.ts` | `POST /payments/admin/bank-transfers/:submissionId/approve` | `@RequirePermissions('orders.update_status')` | `@RequirePermissions('payments.verify_bank_deposit')` | Yes (Double verification code required) |
| `payments.controller.ts` | `POST /payments/admin/bank-transfers/:submissionId/reject` | `@RequirePermissions('orders.update_status')` | `@RequirePermissions('payments.verify_bank_deposit')` | No |
| `store-settings.controller.ts` | `PUT /store-settings/admin/bank-transfer` | `@RequirePermissions('settings.manage')` | `@RequirePermissions('settings.financial')` | Yes (Double verification code required) |
| `store-settings.controller.ts` | `GET /store-settings/admin` | `@RequirePermissions('settings.view')` | Mask sensitive bank fields if user lacks `settings.financial` | No |
| `admin-roles.controller.ts` | `PUT /admin/roles/:id/permissions` | `@RequirePermissions('roles.assign_permissions')` | `@RequirePermissions('roles.assign_permissions')` | Yes (Double verification code required) |
| `admin-roles.controller.ts` | `DELETE /admin/roles/:id` | `@RequirePermissions('roles.manage')` | `@RequirePermissions('roles.manage')` | Yes (Double verification code required) |
| `admin-users.controller.ts` | `POST /admin/users/:id/deactivate` | `@RequirePermissions('admins.manage')` | `@RequirePermissions('admins.manage')` | Yes (Double verification code required) |
| `admin-users.controller.ts` | `POST /admin/users/:id/reactivate` | `@RequirePermissions('admins.manage')` | `@RequirePermissions('admins.manage')` | Yes (Double verification code required) |
| `admin-users.controller.ts` | `DELETE /admin/users/:id/role` | `@RequirePermissions('admins.manage')` | `@RequirePermissions('admins.manage')` | Yes (Double verification code required) |

---

## 4. FRONTEND COMPONENT INVENTORY & GATING ANALYSIS

| Frontend View / Component | Path | Current Permission Check | Target Permission Check & Action Gating |
| :--- | :--- | :--- | :--- |
| Order Detail Fulfillment Controls | `frontend/src/app/admin/orders/[id]/page.tsx` | `hasPermission('orders.update_status')` | Check `hasPermission('orders.fulfill')` for packing, shipping, delivering buttons. |
| Order Detail Cancel Action | `frontend/src/app/admin/orders/[id]/page.tsx` | `hasPermission('orders.update_status')` | Check `hasPermission('orders.cancel')`. If user lacks permission, hide/disable cancel button. |
| Bank Transfer Verification Page | `frontend/src/app/admin/bank-transfers/page.tsx` | `hasPermission('orders.update_status')` | Check `hasPermission('payments.verify_bank_deposit')` on "Verify & Approve" and "Reject" buttons. |
| Refund Management Card | `frontend/src/components/admin/orders/RefundManagementCard.tsx` | `hasPermission('orders.update_status')` | Check `hasPermission('orders.refund')`. Trigger Double Verification Modal before submission. |
| Return Management Card | `frontend/src/components/admin/orders/ReturnManagementCard.tsx` | `hasPermission('orders.update_status')` | Status transitions use `orders.update_status`; refund issuance uses `orders.refund`. |
| Store Settings Bank Config Tab | `frontend/src/app/admin/settings/page.tsx` | `hasPermission('settings.manage')` | Check `hasPermission('settings.financial')` to view unmasked details or edit bank fields. Trigger OTP modal on save. |
| Roles & Permissions Matrix Page | `frontend/src/app/admin/roles/page.tsx` | Static list / modal permissions | Implement interactive Super Admin Matrix with 51 permissions, category groupings, change counter, diff drawer, and double verification before save. |
| Super Admin Control Center | `frontend/src/app/admin/super-admin/page.tsx` | Missing (new view) | Restricted strictly to `super_admin`. Central dashboard for system security, verification logs, admin access, and audit reports. |

---

## 5. AUDIT LOGGING GAP ANALYSIS

### Current State:
1. `audit.service.ts` supports generic `logAction()` writing to `AuditLog`.
2. Sensitive keys are redacted via `isSensitiveKey` (e.g. `password`, `token`, `secret`, `creditCard`).
3. **Gaps Identified:**
   - **No Actor Role Tracking:** The log records `userId` and `userEmail`, but does not snapshot the actor's primary role or active permission set at the moment of execution.
   - **No Verification Challenge Binding:** When a sensitive operation is executed via double verification, the audit record does not link to the `verificationChallengeId` or OTP verification event.
   - **No Structured Before-and-After Diffs:** Role permission changes, admin status toggles, and store setting updates frequently log an unstructured metadata payload rather than a formalized `{ before: {...}, after: {...} }` object.
   - **Security Access Boundary:** `audit_logs.view` is currently held by both `super_admin` and `project_manager`. Private administrative audit logs containing sensitive system changes must be restricted exclusively to the `super_admin` role.

---

## 6. DOUBLE VERIFICATION SYSTEM ARCHITECTURE

To satisfy Stage F requirements:
- **Challenge Lifecycle:**
  1. Super Admin clicks a high-risk action (e.g. Save Role Permissions, Issue Refund, Verify Bank Deposit, Edit Bank Details, Deactivate Admin).
  2. Frontend sends `POST /admin/security/verify/challenge` with `{ action, resourceType, resourceId, details }`.
  3. Backend generates a cryptographically secure 6-digit numeric OTP (`100000`–`999999`).
  4. Backend hashes the OTP using SHA-256 with a salt and stores it in the `VerificationChallenge` table with an expiration timestamp ($T + 5\text{ minutes}$), `maxAttempts: 3`, and status `PENDING`.
  5. Backend dispatches the verification code to the Super Admin's email via `NotificationsService`.
  6. Frontend displays an interactive 6-digit input modal with countdown timer and resend capability.
  7. When submitted, the user passes `{ challengeId, code }` either in a standalone verification step (`POST /admin/security/verify/confirm`) which issues a short-lived single-use confirmation token, or directly in the request header (`x-verification-code` or `x-verification-challenge-id`).
  8. Upon verification, the challenge status transitions to `VERIFIED` and is atomically marked `CONSUMED`. Replay attacks are rejected.

---

## 7. MIGRATION & REVERSIBILITY STRATEGY

1. **Permission Expansion:**
   - 5 new permissions added to `AUTHORITATIVE_PERMISSIONS` in `backfill-super-admin.ts` (total 51 permissions).
   - SQL migration inserts the 5 records into `Permission` using idempotent `ON CONFLICT DO NOTHING`.
   - Initial role assignment policy applied via migration / backfill:
     - `super_admin`: all 5 new permissions.
     - `project_manager`: `orders.fulfill`, `orders.cancel`.
     - `order_manager`: `orders.fulfill`, `orders.cancel`.
     - `product_manager`, `customer_manager`, custom roles: NONE.
2. **Schema Safety:**
   - Add `VerificationChallenge` model via a Prisma migration.
   - Absolutely NO drops or alterations to existing tables or columns.
   - Zero data loss for existing orders, users, roles, and audit records.

