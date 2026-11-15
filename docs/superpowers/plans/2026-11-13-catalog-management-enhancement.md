# DSL Stationery — Complete Admin Catalog Management Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing DSL Stationery E-Commerce Admin Panel with a complete, scalable, data-driven Catalog Management system across Products (`/admin/products`), Categories (`/admin/categories`), Brands (`/admin/brands`), Advanced Import (`/admin/products/import`), and Advanced Export.

**Architecture:** Extend existing NestJS REST controllers and services with server-side pagination, multi-criteria filtering, aggregation/analytics, and streaming CSV/XLSX export; build reusable admin catalog UI components (filter toolbar, column visibility dropdown, KPI cards, export modal, server pagination); connect frontend pages to real backend data and state; enforce RBAC and safe transactions; strictly preserve all existing CRUD, SKU registries, and protected product invariants.

**Tech Stack:** Next.js 16.4.3 (App Router), React 19.3.0, TypeScript 5, Tailwind CSS v4, Lucide React, NestJS 11.0.11, Prisma 7.10.1, PostgreSQL 16, ExcelJS 4.4.0, Zod, Vitest.

**Spec:** User prompt spec "DSL STATIONERY — COMPLETE ADMIN CATALOG MANAGEMENT ENHANCEMENT" (saved in `scratch/last_user_prompt.txt`).

## Global Constraints

- Never reset the database, delete existing database records, or modify existing stock quantities as part of testing.
- Never run destructive migrations.
- Never modify or delete the protected product named `Double Submission Test Product`, ID `cmw0j4cro00089kusmwsbv48t`. Its stock must remain exactly 10.
- Do not modify Product Import Phase 4 execution engine without explicit prior approval.
- No frontend-only filtering on incomplete 100-item slices; implement true server-side pagination (`GET /api/v1/products`) supporting page sizes of 25, 50, 100, and 200.
- Export must export ALL matching records across active filters, not just the visible page.
- Do not add unnecessary database models or duplicate functionality.
- Maintain the progress checklist from Part 11 and mark `[✓]` only after verified implementation and testing.

## Review Focus

1. **Server Pagination & Filter Stability:** Changing search or filters resets page to 1; page sizes 25, 50, 100, 200 return accurate total count and no duplicated records.
2. **Protected Product Invariant:** Product `cmw0j4cro00089kusmwsbv48t` stock remains strictly 10 at all times during all test and verification runs.
3. **Export Completeness:** Exporting filtered results streams all matching records from the database, not just the current paginated view of 25/50 items.
4. **Hierarchy Preservation:** Category parent/child relationships (`Category.parentId`) and direct vs descendant product count calculations remain accurate.
5. **Import Transparency & Safety:** Never silently overwrite existing products or alter stock; all duplicate SKUs and missing brands/categories are flagged for explicit admin resolution.

---

## Task 1: Backend Product Query, Pagination & Analytics Upgrades

**Files:**
- Modify: `backend/src/common/pagination/pagination.util.ts`
- Modify: `backend/src/modules/products/dto/product-query.dto.ts`
- Modify: `backend/src/modules/products/products.service.ts`
- Modify: `backend/src/modules/products/products.controller.ts`
- Test: `backend/src/modules/products/products.service.spec.ts`

- [ ] **Step 1.1**: Update `pagination.util.ts` to allow `MAX_LIMIT = 200` so that `limit: 200` is supported without breaking existing validation.
- [ ] **Step 1.2**: Extend `product-query.dto.ts` with `stockStatus` enum (`'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK'`), `status` (`'active' | 'inactive'`), and validate optional search across name, SKU, and ID.
- [ ] **Step 1.3**: Update `products.service.ts` `findAll` to filter by `stockStatus` (using `stockQuantity > lowStockThreshold`, `stockQuantity <= lowStockThreshold AND stockQuantity > 0`, and `stockQuantity = 0`), `status` (`isActive: true/false`), and search across `id`, `name`, `sku`.
- [ ] **Step 1.4**: Add `getAdminAnalytics()` in `products.service.ts` and `GET /api/v1/products/admin/analytics` in `products.controller.ts` returning counts: `totalProducts`, `activeProducts`, `inactiveProducts`, `healthyStock`, `lowStock`, `outOfStock`, `byBrand`, `byCategory`.
- [ ] **Step 1.5**: Run unit tests in `products.service.spec.ts` to verify query filtering, analytics calculation, and pagination limits.

---

## Task 2: Backend Streaming Export Engine (Products, Categories, Brands)

**Files:**
- Modify: `backend/src/modules/products/products.service.ts`
- Modify: `backend/src/modules/products/products.controller.ts`
- Modify: `backend/src/modules/categories/categories.service.ts`
- Modify: `backend/src/modules/categories/categories.controller.ts`
- Modify: `backend/src/modules/brands/brands.service.ts`
- Modify: `backend/src/modules/brands/brands.controller.ts`

- [ ] **Step 2.1**: Implement `exportProducts(query, format, res)` in `products.service.ts` using `ExcelJS`. Query all matching products (no pagination limit), format into CSV or XLSX workbook with columns (ID, Name, SKU, Brand, Category, Price, Stock, Low Stock Threshold, Status, Created At), set appropriate Content-Type / Content-Disposition headers, and stream to client.
- [ ] **Step 2.2**: Add `GET /api/v1/products/export` in `products.controller.ts` protected by `JwtAuthGuard` and `RolesGuard`.
- [ ] **Step 2.3**: Implement `exportCategories(format, res)` in `categories.service.ts` and `GET /api/v1/categories/export` in `categories.controller.ts` exporting Category ID, Name, Slug, Parent Category, Direct Products, Total Products, Display Order, Created At.
- [ ] **Step 2.4**: Implement `exportBrands(format, res)` in `brands.service.ts` and `GET /api/v1/brands/export` in `brands.controller.ts` exporting Brand ID, Name, Slug, Origin Country, Product Count, Featured, Created At.
- [ ] **Step 2.5**: Run backend build check (`npm run build --prefix backend`) to verify zero type errors.

---

## Task 3: Backend Category & Brand Analytics and Product Count Aggregations

**Files:**
- Modify: `backend/src/modules/categories/categories.service.ts`
- Modify: `backend/src/modules/categories/categories.controller.ts`
- Modify: `backend/src/modules/brands/brands.service.ts`
- Modify: `backend/src/modules/brands/brands.controller.ts`

- [ ] **Step 3.1**: Extend `categories.service.ts` `findAll` and `getCategoryTree` to include aggregated product counts for direct products (`directProductCount`) and descendants (`totalProductCount`).
- [ ] **Step 3.2**: Add `getAdminAnalytics()` in `categories.service.ts` and `GET /api/v1/categories/admin/analytics` in `categories.controller.ts` returning: `totalCategories`, `parentCategories`, `subcategories`, `activeCategories`, `emptyCategories`, `categoriesWithProducts`, `productDistribution`.
- [ ] **Step 3.3**: Extend `brands.service.ts` `findAll` to include `productCount` via Prisma relation aggregation (`_count: { select: { products: true } }`).
- [ ] **Step 3.4**: Add `getAdminAnalytics()` in `brands.service.ts` and `GET /api/v1/brands/admin/analytics` in `brands.controller.ts` returning: `totalBrands`, `activeBrands`, `inactiveBrands`, `brandsWithProducts`, `emptyBrands`, `topBrandsByProductCount`.
- [ ] **Step 3.5**: Verify backend build and unit tests for categories and brands.

---

## Task 4: Shared Reusable Admin Catalog UI Components

**Files:**
- Create: `frontend/src/components/admin/catalog/ColumnVisibilityDropdown.tsx`
- Create: `frontend/src/components/admin/catalog/CatalogFilterToolbar.tsx`
- Create: `frontend/src/components/admin/catalog/CatalogKpiCards.tsx`
- Create: `frontend/src/components/admin/catalog/CatalogExportModal.tsx`
- Create: `frontend/src/components/admin/catalog/CatalogPagination.tsx`

- [ ] **Step 4.1**: Implement `ColumnVisibilityDropdown.tsx`: accepts column definition list `{ key, label, visible, locked? }`, toggle column callback, select-all and reset-to-defaults actions, persists preferences in `localStorage` under a configurable `storageKey`.
- [ ] **Step 4.2**: Implement `CatalogFilterToolbar.tsx`: accepts search query, debounce handler, search placeholder, filter dropdown configs, active filter chips with remove triggers, clear-all action, and total count indicator.
- [ ] **Step 4.3**: Implement `CatalogKpiCards.tsx`: displays metric cards with icons, numerical count, label, subtitle, and clickable highlight state that triggers filtering.
- [ ] **Step 4.4**: Implement `CatalogExportModal.tsx`: dialog for selecting format (CSV or Excel .xlsx), scope (All Filtered Records vs Selected Rows), column set (All Columns vs Visible Columns), and export trigger.
- [ ] **Step 4.5**: Implement `CatalogPagination.tsx`: page navigation, page size selector (25, 50, 100, 200 items per page), current range text ("Showing 1 to 25 of 94 items").

---

## Task 5: Frontend Products Management Screen Upgrade

**Files:**
- Modify: `frontend/src/services/productService.ts`
- Modify: `frontend/src/app/admin/products/page.tsx`

- [ ] **Step 5.1**: Extend `productService.ts` with `fetchProductAnalytics()` and `exportProducts(format, params)`. Ensure `fetchProducts` forwards all query parameters (`stockStatus`, `brandId`, `categoryId`, `subcategoryId`, `status`, `minPrice`, `maxPrice`, `search`, `page`, `limit`).
- [ ] **Step 5.2**: Upgrade `frontend/src/app/admin/products/page.tsx`:
  - Integrate server-side pagination with configurable page sizes (25, 50, 100, 200).
  - Connect KPI cards (Total, Active, Inactive, Healthy Stock, Low Stock, Out of Stock) with click-to-filter behavior.
  - Implement comprehensive filter bar: Search (name/SKU/ID), Brand, Category, Subcategory, Stock Health, Active Status, Price Range, and removable filter chips.
  - Add `ColumnVisibilityDropdown` with column persistence.
  - Add CSV and Excel export modal with file download trigger.
  - Support row selection for batch actions / selected-row export.
  - Preserve product CRUD, variant viewing/editing, status toggling, and soft deletion.
- [ ] **Step 5.3**: Verify protected product `cmw0j4cro00089kusmwsbv48t` remains strictly unmodified with stock 10.

---

## Task 6: Frontend Categories Management Screen Upgrade

**Files:**
- Modify: `frontend/src/services/categoryService.ts`
- Modify: `frontend/src/app/admin/categories/page.tsx`

- [ ] **Step 6.1**: Extend `categoryService.ts` with `fetchCategoryAnalytics()` and `exportCategories(format)`.
- [ ] **Step 6.2**: Upgrade `frontend/src/app/admin/categories/page.tsx`:
  - Category hierarchy tree visualization with clear parent-child indentation and branches.
  - Expand/collapse individual nodes or all nodes at once.
  - Product count display per category (direct and total descendant count).
  - Category KPI cards (Total, Parent, Subcategories, Active, Empty, With Products).
  - Advanced search and filters (parent category filter, with/without products, active status).
  - Column visibility dropdown and CSV/Excel export modal.
  - Preserve category create, edit, delete, and parent-child assignment.

---

## Task 7: Frontend Brands Management Screen Upgrade

**Files:**
- Modify: `frontend/src/services/brandService.ts`
- Modify: `frontend/src/app/admin/brands/page.tsx`

- [ ] **Step 7.1**: Extend `brandService.ts` with `fetchBrandAnalytics()` and `exportBrands(format)`.
- [ ] **Step 7.2**: Upgrade `frontend/src/app/admin/brands/page.tsx`:
  - Brand KPI cards (Total Brands, Active, Inactive, With Products, Empty).
  - Search by brand name and ID, status filter, product-count filter and sorting.
  - Product counts per brand from backend relation aggregation.
  - Column visibility dropdown and CSV/Excel export modal.
  - Preserve brand create, edit, and delete functionality.

---

## Task 8: Advanced Import Management UI & Workflow Enhancement

**Files:**
- Modify: `frontend/src/app/admin/products/import/page.tsx`

- [ ] **Step 8.1**: Inspect and preserve existing import preview and validation workflow.
- [ ] **Step 8.2**: Add Duplicate Comparison Modal: when an imported row has a duplicate SKU, show existing product vs uploaded row with field-by-field differences highlighted.
- [ ] **Step 8.3**: Add Row-Level Error & Warning Inspector: display row number, product name, SKU, issue type, suggested resolution, and brand/category mapping helpers.
- [ ] **Step 8.4**: Add Final Administrator Approval Modal: breakdown of items to create, items to update, items to skip, new brands/categories proposed; require explicit confirmation before execution.
- [ ] **Step 8.5**: Add Import History Tab: fetch recent batches from `GET /api/v1/products/import/history` and display batch ID, filename, status, total/success/failed counts, date, and error report download.

---

## Task 9: Quality Assurance, Verification & Final Report

**Files:**
- Execute: Backend build and tests
- Execute: Frontend build and tests
- Verify: Protected product stock invariant
- Verify: Responsive layout check
- Generate: Final completion report in chat and artifact

- [ ] **Step 9.1**: Run `npm run build --prefix backend` and verify zero errors.
- [ ] **Step 9.2**: Run `npm run build --prefix frontend` and verify all routes compile cleanly.
- [ ] **Step 9.3**: Run targeted backend and frontend unit tests.
- [ ] **Step 9.4**: Query PostgreSQL database to confirm protected product `cmw0j4cro00089kusmwsbv48t` stock is strictly 10.
- [ ] **Step 9.5**: Update Part 11 progress checklist with verified `[✓]` items.
- [ ] **Step 9.6**: Produce comprehensive completion report covering all 12 sections requested in Part 12.

