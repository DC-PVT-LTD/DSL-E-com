# DSL Admin + Backend Completion Roadmap

> **For agentic workers:** Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to execute this roadmap in phase order. Treat each unchecked item as work to verify or complete, not as an assumption that it is missing.

**Goal:** Bring the DSL Stationery admin portal and backend from the currently verified local setup to a reliable, production-ready operations system, with every admin screen backed by correct, authorized, persistent data.

**Architecture:** Keep the Next.js admin UI, NestJS REST API, Prisma, and PostgreSQL architecture. Close frontend/API contract gaps, add backend APIs where admin screens still use demo/local data, verify role permissions and operational workflows, then connect approved external providers and deploy through staging to production.

**Tech Stack:** Next.js 16, React 19, TypeScript, NestJS 11, Prisma 7, PostgreSQL, Zod, Vitest, Socket.IO.

**Source of current status:** User-provided Antigravity verification report dated 2026-11-12. It reports PostgreSQL/database connectivity, 14 applied migrations, seeded catalog data, active Super Admin, backend health 200, and frontend HTTP 200. Admin credential login and an authenticated API-backed page were not verified.

## Global Constraints

- Do not recreate the database, rerun provisioning, reset data, or repeat setup steps that the verification report says are complete.
- Do not display or log credentials, password hashes, access/refresh tokens, or raw connection strings.
- Do not treat demo/local data as live operational data.
- Keep API authorization in NestJS guards; frontend route checks alone are not security controls.
- Preserve money calculations as integer minor units (cents) across API/database boundaries.
- Use the existing `/api/v1` REST conventions and cookie-based administrator session unless a reviewed design changes them.
- Keep integration errors visible; do not silently convert failed API calls into empty lists that look like valid data.
- Production cutover requires business approval for hosting, payment, email, OCR, file storage, notification providers, and data migration.

## Review Focus

- Valid admin account but failed cookie/session flow: test login, refresh, `/auth/me`, logout, expiry, and unauthorized redirects.
- Incomplete permission assignment: test allowed and denied API calls for every admin permission group.
- Filters/pagination returning plausible but wrong data: test combined filters, date boundaries, sort allowlists, and empty results.
- Duplicate stock/order side effects: test transaction rollback, cancellation, item edits, refunds, and retry behavior.
- Provider unavailable or webhook replayed: test timeout, invalid signature, duplicate delivery, and recovery paths before enabling live providers.

## Phase 0 — Confirm the working baseline

**Files/areas:** `frontend/.env`, `backend/.env`, `/admin/login`, `/api/v1/health`, one API-backed admin screen.

- [ ] Sign in with the already-provisioned admin account; keep credentials private.
- [ ] Confirm the browser receives the expected HTTP-only session cookies.
- [ ] Load `/auth/me` or reload an authenticated admin route to confirm the session survives navigation/reload.
- [ ] Open Products or Inventory and confirm the response comes from the local API, not a fallback/demo dataset.
- [ ] Sign out and confirm protected API calls require authentication again.
- [ ] Record the exact database counts/environment and do not reseed or reset the DB.

**Exit criteria:** Admin login, current-user session lookup, one protected list request, and logout work end to end.

## Phase 1 — Reconcile the admin feature and API contract inventory

**Files/areas:** `frontend/src/app/admin/`, `frontend/src/services/`, `backend/src/modules/`, `frontend/docs/BACKEND_API_REQUIREMENTS.md`, `frontend/docs/PHASE_11_BACKEND_API_REQUIREMENTS.md`, `backend/docs/PHASE_11_FRONTEND_INTEGRATION.md`.

- [ ] Build a page-by-page inventory: data source, read API, write API, permission, persistence, error state, and demo/local fallback.
- [ ] Compare each frontend service request/response shape with the live backend controller, DTO, and service implementation.
- [ ] Update stale Phase 11 documentation: many endpoints marked “missing” now exist in `AdminOrdersController` and `AdminOrdersService`.
- [ ] Fix the returns contract mismatch: frontend sends `reason`; backend schema expects `rejectionReason` and `restockItems`.
- [ ] Remove stale “backend pending” strings for implemented endpoints.
- [ ] Replace silent `[]` fallback behavior for failed audit/return requests with an explicit error/loading state.
- [ ] Document endpoints that are genuinely absent (dashboard aggregate/report, global customers, global audit list, store settings as needed).

**Exit criteria:** One current integration matrix exists and each listed UI action maps to a confirmed endpoint/contract or a planned API task.

## Phase 2 — Make the existing order operations dependable

**Files/areas:** `frontend/src/services/orderService.ts`, `frontend/src/app/admin/orders/`, `frontend/src/components/admin/orders/`, `backend/src/modules/orders/`.

- [ ] Verify order list status/payment/date/search filters, sort, pagination, and URL state against backend behavior.
- [ ] Verify order statistics endpoint and align fields/status casing in frontend types.
- [ ] Verify order detail, status-transition matrix, tracking fields, cancellation, refund record, return lifecycle, internal notes, and audit history.
- [ ] Align update-customer, update-delivery, item-edit, return, and refund request DTOs and response types.
- [ ] Make failure, permission-denied, stale-data, and empty-list states distinguishable in the UI.
- [ ] Confirm stock reservations/movements and refund records remain consistent when mutations fail or are retried.
- [ ] Verify WebSocket order/inventory refreshes and refetch authoritative REST state after reconnect.

**Exit criteria:** Staff can complete and audit an order from intake to delivery/cancellation/return without the frontend masking API errors or creating duplicate side effects.

## Phase 3 — Replace demo-only admin business data

### 3A. Dashboard

- [ ] Add or confirm a backend admin dashboard summary endpoint for gross/net sales definition, order counts by status, low stock, and recent activity.
- [ ] Replace `orderService.getAll()` / `productService.getAll()` calculations in `frontend/src/app/admin/dashboard/page.tsx` with API data.
- [ ] Display metric definitions, time period, loading/error/empty states, and timestamp of last refresh.

### 3B. Reports

- [ ] Define required report periods and metrics with the business owner.
- [ ] Add authenticated, paginated/report endpoints with server-side aggregation and CSV export where needed.
- [ ] Replace local `orderService.getAll()` calculations in `frontend/src/app/admin/reports/page.tsx`.
- [ ] Validate totals against known database queries and clarify treatment of cancelled/refunded orders.

### 3C. Customers

- [ ] Add authorized customer list/detail endpoints with search, pagination, address and order summaries.
- [ ] Replace `INITIAL_CUSTOMERS` and local order counts in customer list/detail pages.
- [ ] Define safe field exposure and avoid revealing customer data to roles without permission.

### 3D. Global audit log

- [ ] Add/confirm a paginated global audit endpoint with actor, action, entity, date and search filters.
- [ ] Replace `MOCK_AUDIT_LOGS` in `frontend/src/app/admin/audit-logs/page.tsx`.
- [ ] Confirm sensitive values are redacted and records cannot be edited/deleted from the UI.

### 3E. Store settings

- [ ] Decide which settings are database-backed (delivery fees, threshold, store contact details, payment switches, WhatsApp number).
- [ ] Add guarded read/update endpoint with validation and audit logging.
- [ ] Replace `localStorage` persistence in `frontend/src/app/admin/settings/page.tsx`.
- [ ] Verify customer checkout and cart delivery calculations consume the persisted settings.

**Exit criteria:** No admin operational dashboard/report/customer/audit/settings screen presents local demo data as live data.

## Phase 4 — Verify RBAC and admin account lifecycle

**Files/areas:** `backend/src/modules/admin-users/`, `backend/src/modules/admin/roles/`, guards/decorators, `frontend/src/app/admin/admins/`, `frontend/src/app/admin/roles/`, `frontend/src/components/admin/AdminSidebar.tsx`.

- [ ] Create a role-to-page/API permission matrix from existing permission keys.
- [ ] Verify least-privilege behavior for Staff, Manager, Admin, and Super Admin roles.
- [ ] Hide/disable UI actions users cannot perform while retaining server-side denial.
- [ ] Test invitations, acceptance, role assignment, deactivation, token revocation, and last-Super-Admin protections.
- [ ] Confirm role changes take effect for existing sessions according to an explicit policy.
- [ ] Confirm audit records exist for role/account changes.

**Exit criteria:** Each role can only access the approved screens and APIs, including direct API requests.

## Phase 5 — Complete catalogue, inventory, school-pack, marketing, and upload workflows

- [ ] Products/import: validate preview, row errors, commit, SKU uniqueness, image uploads, and import history.
- [ ] Categories/brands: validate uniqueness, hierarchy constraints, delete restrictions, and product counts.
- [ ] Inventory: validate manual adjustment reasons, audit trail, low-stock filters, and concurrent stock changes.
- [ ] School packs: validate grade/tier configuration, component product stock, pricing, discounts, and live product display.
- [ ] Promotions: validate activation dates, usage limits, eligible products/categories, stacking, redemption counts, and reporting.
- [ ] Banners: validate image upload/storage, scheduling/publication, ordering, and public homepage retrieval.
- [ ] Uploaded documents: validate private storage, file limits/type checks, OCR provider selection, manual matching/review, retries, and cart conversion.
- [ ] Newsletter: verify consent history, double opt-in, export eligibility, and unsubscribe handling.

**Exit criteria:** Each admin-managed change persists in PostgreSQL and appears correctly in the relevant public/customer flow.

## Phase 6 — Select and integrate production providers

**Business decisions required before implementation:**

- [ ] Hosting/platform and production domain.
- [ ] Managed PostgreSQL provider, region, backups, and recovery objectives.
- [ ] Payment providers and whether PayHere/Koko/bank transfer/COD will be live at launch.
- [ ] Email sender/SMTP or provider, verified domain, and required transactional messages.
- [ ] SMS/WhatsApp provider and message templates.
- [ ] OCR provider (or approved simulated/manual workflow) and API credentials.
- [ ] File/object storage provider, retention, access controls, and public/private asset rules.
- [ ] Courier/tracking process and whether courier integrations are manual or API-based.

Then:

- [ ] Add credentials through deployment secret management, not committed `.env` files.
- [ ] Verify signatures, webhooks, idempotency, retries, timeouts, and provider failure states.
- [ ] Keep sandbox/test mode until provider acceptance and business sign-off.
- [ ] Document reconciliation and manual fallback procedures.

**Exit criteria:** Every launch-enabled provider has credentials, tested sandbox flow, monitoring, and a documented fallback.

## Phase 7 — Production security, data, and operational readiness

- [ ] Review cookie `Secure`, `HttpOnly`, `SameSite`, domain, CSRF, CORS, HTTPS, refresh rotation, and logout behavior in production configuration.
- [ ] Rotate development/demo secrets; verify production JWT, database, payment, email, OCR, and storage secrets are unique and managed externally.
- [ ] Review throttling, login lockout, admin invitation expiry, upload scanning/limits, authorization, and sensitive logs.
- [ ] Confirm backups, restore procedure, retention, migration runbook, rollback strategy, and incident contact.
- [ ] Define monitoring for API health, DB pool, 5xx rate, payment webhooks, email/OCR failures, queues, and WebSocket reconnects.
- [ ] Confirm privacy, terms, returns/refunds, delivery policy, and data retention with the business owner.
- [ ] Audit demo flags and demo banners so production cannot accidentally present simulated revenue/orders or test payments as real.

**Exit criteria:** Security review and restore/recovery runbook are approved; production configuration contains no demo secrets or demo claims.

## Phase 8 — Staging release and acceptance

- [ ] Provision staging app and database using the production-like configuration.
- [ ] Apply migrations through the release process; do not use local dev DB shortcuts.
- [ ] Create staging Super Admin through a documented secure provisioning path.
- [ ] Import sanitized/approved catalogue data and verify media URLs/storage.
- [ ] Run automated unit/integration/e2e tests and lint/build checks for frontend and backend.
- [ ] Complete role-based UAT across desktop/mobile admin workflows.
- [ ] Test order/payment failure, cancellation/refund, low stock, upload/OCR failure, and recovery scenarios.
- [ ] Record defects and repeat acceptance until exit criteria pass.

**Exit criteria:** Product owner approves the staging workflow and no release-blocking defects remain.

## Phase 9 — Production launch

- [ ] Confirm launch checklist, provider status, backups, alerts, support contacts, and rollback decision-maker.
- [ ] Deploy backend and frontend with production secrets/configuration.
- [ ] Apply reviewed migrations and run a controlled production data import.
- [ ] Provision production Super Admin securely, verify login, then create/invite additional least-privilege administrators.
- [ ] Run smoke checks: health, login, catalogue, product edit, stock adjustment, order creation/fulfilment, payment callback, email, and admin audit log.
- [ ] Monitor initial traffic, orders, errors, payment and notification events.
- [ ] Use the rollback plan if health, payment integrity, data integrity, or access control fails.

**Exit criteria:** Customers can place and track real orders and authorized staff can manage them with persistent, auditable data and an operational support path.

## Recommended immediate order

1. Complete Phase 0 by signing in and opening Products/Inventory.
2. Complete Phase 1 integration inventory and fix the order return contract/stale fallbacks.
3. Build the missing live Dashboard, Reports, Customers, Global Audit, and Settings data paths (Phase 3).
4. Complete order and core admin workflow verification (Phases 2, 4, 5).
5. Collect the business decisions in Phase 6 before provider/deployment implementation.
6. Complete security, staging acceptance, and production launch (Phases 7–9).

## Questions to answer before production planning is locked

- Where will the production frontend, API, and PostgreSQL database be hosted?
- Which payment methods/providers are required for the first launch?
- Which providers should handle email, SMS/WhatsApp, OCR, and uploaded files?
- Which admin roles are needed and what can each role do?
- Is the existing verified database only development data, or does it contain business data to migrate?
- What is the target launch date and who signs off staging acceptance?
