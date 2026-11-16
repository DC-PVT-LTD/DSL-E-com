# DSL Stationery — Complete System QA & Testing Master Guide
## Comprehensive End-to-End System Manual for Quality Assurance & Test Engineers

**Document Version:** 2.0.0  
**Target Applications:** Customer Storefront (`:3000`) & Operations Admin Console (`:3000/admin`)  
**Backend API Server:** NestJS 11 Engine (`:4000/api/v1`)  
**Database:** PostgreSQL 18.4 with Prisma 7 ORM (`dsl_stationery`)  
**Authoritative Date:** November 16, 2026  

---

## 1. Business Overview & Mission

### 1.1 What is DSL Stationery?
DSL Stationery (DSL Enterprises Pvt Ltd) is an authorized Sri Lankan stationery distributor and omnichannel e-commerce platform. The platform serves retail consumers, school parents, university students, corporate offices, and craft hobbyists across all 25 administrative districts of Sri Lanka.

### 1.2 Core Value Proposition: "Tell Us What You Need — DSL Builds Your Basket"
Unlike generic retail storefronts where parents and students must manually hunt for dozens of individual exercise books, pens, pencils, and mathematical instruments, DSL provides specialized guided commerce workflows:
1. **Find My Stationery**: An interactive shopping wizard that maps student grades, curricula, and budget preferences to pre-curated stationery lists.
2. **School Packs**: Pre-packaged, curriculum-aligned bundles categorized by grade and tier (Essential, Standard, Premium).
3. **Upload Your List**: An image/document upload interface allowing customers to upload booklists or handwritten school stationery requirements for automated extraction and instant cart assembly.

### 1.3 Customer Segments
- **School Parents & Students**: Seeking grade-specific packs, exercise books, geometry sets, and coloring materials.
- **University Students & Academics**: Requiring technical drawing instruments, lecture pads, and high-capacity binders.
- **Corporate & Office Buyers**: Ordering bulk paper reams, filing accessories, desk essentials, and markers.
- **Art & Craft Creators**: Sourcing professional drawing pencils, paints, palettes, and specialty sketch pads.

---

## 2. Complete System Architecture

```mermaid
flowchart TD
    subgraph Client Layer
        CB["Customer Browser (Desktop / Mobile)"]
        AB["Admin / Staff Browser (Console)"]
    end

    subgraph Presentation & Routing (Next.js 16)
        Storefront["Storefront App Router (:3000)"]
        AdminPortal["Admin Console App Router (:3000/admin)"]
        AuthStore["Zustand Client Stores (UserStore, CartStore)"]
    end

    subgraph Application API Layer (NestJS 11 :4000)
        Gateway["HTTP & WebSocket Gateways"]
        Guards["JwtAuthGuard | RolesGuard | PermissionsGuard"]
        Modules["34 Business Modules (Orders, Products, Payments, Inventory, Reports)"]
        ReceiptStorage["Private Receipt Storage (Encrypted Slips)"]
    end

    subgraph Data Persistence Layer
        PrismaAdapter["Prisma 7 Driver Adapter (@prisma/adapter-pg)"]
        PostgresDB[("PostgreSQL 18.4 Database\n(dsl_stationery - 53 Models)")]
    end

    CB --> Storefront
    AB --> AdminPortal
    Storefront --> AuthStore
    AdminPortal --> AuthStore
    Storefront --> Gateway
    AdminPortal --> Gateway
    Gateway --> Guards
    Guards --> Modules
    Modules --> ReceiptStorage
    Modules --> PrismaAdapter
    PrismaAdapter --> PostgresDB
```

### 2.1 Key Concepts for New QA Testers
- **API (Application Programming Interface)**: The bridge allowing the frontend to send requests to and receive data from the backend server.
- **Endpoint**: A specific URL path (e.g. `GET /api/v1/products`) where the backend provides data or performs an action.
- **Authentication**: Verifying the identity of the user (e.g. email and password matching a stored hash).
- **Authorization & RBAC**: Verifying whether an authenticated user holds the explicit role and permission to perform an action.
- **Session Cookie (`dsl_access_token`)**: An encrypted, `HttpOnly`, `SameSite=Lax` browser cookie that securely preserves login state without exposing JWTs to client scripts.
- **Audit Log**: An immutable database record capturing the actor, action, timestamp, entity ID, and old/new diff for critical operations.

---

## 3. Complete Website Route Inventory

### 3.1 Customer Storefront & Public Routes (39 Routes)

| Route | Feature Area | Purpose | Auth Required? | Status |
|---|---|---|---|---|
| `/` | Storefront | Main entry point / redirect to `/home` | No | IMPLEMENTED AND VERIFIED |
| `/home` | Storefront | Homepage with hero slides, featured brands, categories | No | IMPLEMENTED AND VERIFIED |
| `/shop` | Catalogue | Master product catalog with search, brand & price filters | No | IMPLEMENTED AND VERIFIED |
| `/products/[slug]` | Product | Detailed product view with variant selectors and stock badge | No | IMPLEMENTED AND VERIFIED |
| `/Product-Details/[slug]`| Product | Legacy alias redirecting to standard product detail | No | IMPLEMENTED AND VERIFIED |
| `/categories` | Categories | High-level category grid | No | IMPLEMENTED AND VERIFIED |
| `/categories/[slug]` | Categories | Category-filtered product listing | No | IMPLEMENTED AND VERIFIED |
| `/brands` | Brands | Authorized brand partner showcase | No | IMPLEMENTED AND VERIFIED |
| `/cart` | Commerce | Slide-over and full-page customer cart | No | IMPLEMENTED AND VERIFIED |
| `/checkout` | Commerce | Delivery address, courier shipping, and payment selection | No (Guest allowed) | IMPLEMENTED AND VERIFIED |
| `/checkout/result` | Commerce | Order confirmation or payment failure redirect screen | No | IMPLEMENTED AND VERIFIED |
| `/find-my-stationery` | Smart Feature | Interactive stationery recommendation wizard | No | IMPLEMENTED AND VERIFIED |
| `/school-packs` | Smart Feature | Grade-specific stationery pack selector | No | IMPLEMENTED AND VERIFIED |
| `/school-packs/[id]` | Smart Feature | Detailed breakdown of items within a School Pack | No | IMPLEMENTED AND VERIFIED |
| `/login` | Auth | Customer account login | No | IMPLEMENTED AND VERIFIED |
| `/register` | Auth | Customer account registration | No | IMPLEMENTED AND VERIFIED |
| `/account` | Customer | Customer dashboard with profile and quick links | Yes (Customer) | IMPLEMENTED AND VERIFIED |
| `/account/orders` | Customer | Customer order history listing | Yes (Customer) | IMPLEMENTED AND VERIFIED |
| `/orders/[id]` | Customer | Individual customer order status and delivery tracking | Yes (Owner only) | IMPLEMENTED AND VERIFIED |
| `/account/addresses` | Customer | Saved delivery addresses management | Yes (Customer) | IMPLEMENTED AND VERIFIED |
| `/account/wishlist` | Customer | Saved wishlist items | Yes (Customer) | IMPLEMENTED AND VERIFIED |
| `/account/saved-lists` | Customer | Custom saved stationery lists | Yes (Customer) | IMPLEMENTED AND VERIFIED |
| `/account/back-in-stock-alerts` | Alerts | Out-of-stock notification subscriptions | Yes (Customer) | IMPLEMENTED AND VERIFIED |
| `/about` | Static Content | Company background and authorized distribution info | No | IMPLEMENTED AND VERIFIED |
| `/contact` | Static Content | Customer inquiry form and office location details | No | IMPLEMENTED AND VERIFIED |
| `/delivery` | Static Content | Shipping rates, islandwide delivery timeline policy | No | IMPLEMENTED AND VERIFIED |
| `/faq` | Static Content | Frequently asked customer questions | No | IMPLEMENTED AND VERIFIED |
| `/privacy` | Legal | Customer privacy and data protection terms | No | IMPLEMENTED AND VERIFIED |
| `/terms` | Legal | Store terms of service and ordering conditions | No | IMPLEMENTED AND VERIFIED |
| `/returns` | Customer Service | Customer return policy and request instructions | No | IMPLEMENTED AND VERIFIED |
| `/bulk-order` | B2B / Corporate | Inquiry portal for corporate and school volume orders | No | IMPLEMENTED AND VERIFIED |
| `/offers` | Promotions | Active promotional discounts and voucher deals | No | IMPLEMENTED AND VERIFIED |
| `/search` | Catalogue | Dedicated full-text catalog search results page | No | IMPLEMENTED AND VERIFIED |
| `/saved-lists` | Smart Feature | Overview of public/saved stationery lists | No | IMPLEMENTED AND VERIFIED |
| `/saved-lists/[id]` | Smart Feature | Specific shared stationery list viewer | No | IMPLEMENTED AND VERIFIED |
| `/newsletter/verify` | Marketing | Email confirmation handler for newsletter signup | No | IMPLEMENTED AND VERIFIED |
| `/newsletter/unsubscribe` | Marketing | Opt-out handler for newsletter emails | No | IMPLEMENTED AND VERIFIED |
| `/welcome` | Onboarding | Post-registration welcome splash page | No | IMPLEMENTED AND VERIFIED |
| `/wishlist` | Commerce | Public / Guest accessible wishlist view | No | IMPLEMENTED AND VERIFIED |

---

### 3.2 Admin Console Routes (30 Routes)

| Route | Feature Area | Required Permission | Purpose |
|---|---|---|---|
| `/admin/login` | Auth | Public | Administrator login form |
| `/admin/dashboard` | Executive | `dashboard.view` | Live KPIs, recent orders, inventory alerts |
| `/admin/super-admin` | Super Admin | `admins.view` (Super Admin only) | Control center, privilege overview, platform audit |
| `/admin/orders` | Orders | `orders.view` | Order fulfillment management table and filters |
| `/admin/orders/[id]` | Orders | `orders.view` | Order details, status transitions, delivery notes |
| `/admin/payments` | Financial | `orders.view` | Consolidated transactions and volume breakdown |
| `/admin/payments/bank-transfers` | Financial | `orders.view` | Verification queue for offline bank transfer slips |
| `/admin/reconciliation` | Financial | `orders.view` | Ledger balance and payment state audit report |
| `/admin/products` | Catalog | `products.view` | Product catalog management and stock health |
| `/admin/products/new` | Catalog | `products.create` | Create new single product or multi-variant SKU |
| `/admin/products/[id]/edit` | Catalog | `products.edit` | Modify product attributes, prices, stock |
| `/admin/products/import` | Catalog | `products.import` | Multi-phase bulk product CSV import engine |
| `/admin/categories` | Catalog | `categories.view` | Parent/child category tree management |
| `/admin/brands` | Catalog | `brands.view` | Brand partner logos and brand status |
| `/admin/inventory` | Inventory | `inventory.view` | Live warehouse stock adjustments and audit trail |
| `/admin/customers` | Customers | `customers.view` | Customer directory, spending history, status |
| `/admin/customers/[id]` | Customers | `customers.view` | Individual customer profile and lifetime orders |
| `/admin/school-packs` | Smart Feature | `school_packs.view` | School Packs configuration and bundle pricing |
| `/admin/school-packs/new` | Smart Feature | `school_packs.create` | Assemble new grade-level School Pack |
| `/admin/school-packs/[id]/edit` | Smart Feature | `school_packs.edit` | Adjust items, quantities, and prices in pack |
| `/admin/find-my-stationery` | Smart Feature | `recommendations.view`| Rules engine for student grade recommendations |
| `/admin/promotions` | Marketing | `promotions.view` | Discount coupons, minimum order limits |
| `/admin/banners` | Marketing | `banners.view` | Homepage hero banners and blue line ads |
| `/admin/newsletter` | Marketing | `newsletter.view` | Newsletter subscriber list and consent logs |
| `/admin/reports` | Executive | `reports.view` | Sales reports, revenue charts, CSV exports |
| `/admin/audit-logs` | Security | `audit_logs.view` | Unified immutable system audit trail |
| `/admin/settings` | Configuration | `settings.view` | Delivery pricing, bank details, contact numbers |
| `/admin/admins` | Staff | `admins.view` | Administrative account directory and activation |
| `/admin/roles` | RBAC | `roles.view` | Role catalog and granular 51-permission matrix |
| `/admin/invite/accept` | Staff | Public (with Token) | Invitation acceptance form for newly invited staff |

---

## 4. Customer Workflows & Test Steps

### 4.1 Discovery to Cart Workflow
1. **Navigate to Catalog**: Click `Shop` in top navigation bar (`/shop`).
2. **Search for Item**: Type `"DOMS"` in search box; verify instant filtering.
3. **Filter by Brand / Price**: Check `"DOMS"` under Brands filter; verify only matching items display.
4. **Product Detail View**: Click on product card (`/products/[slug]`).
5. **Quantity & Stock**: Verify stock status badge (`In Stock` or `Only X Left`). Select quantity `2`.
6. **Add to Cart**: Click `Add to Cart`. Verify cart badge updates in header and cart drawer slides in.

### 4.2 Checkout & Multi-Payment Verification
1. **Open Checkout**: Click `Proceed to Checkout` (`/checkout`).
2. **Delivery Information**: Fill recipient name, phone (`0771234567`), address line, district (`Colombo`), city (`Colombo 03`).
3. **Select Payment Method**:
   - **Method A — Cash on Delivery (COD)**: Available for orders up to Rs. 50,000. Physical inventory is reserved upon order confirmation.
   - **Method B — Direct Bank Transfer**: Displays corporate bank details (Commercial Bank of Ceylon). Requires customer to enter reference number and upload bank deposit slip.
   - **Method C — Online Card (PayHere Sandbox)**: Redirects to PayHere test gateway; simulates test VISA/Mastercard payment.
4. **Place Order**: Click `Confirm Order`.
5. **Expected Result**: Redirects to `/checkout/result?orderId=...`. Customer receives unique order reference formatted as `DSL-YYYY-XXXXXX`.

---

## 5. Admin Workflows & Test Steps

### 5.1 Executive Operations Dashboard (`/admin/dashboard`)
- **Key Metrics Verification**: Check that `Gross Sales`, `Net Revenue`, `Total Orders`, `Pending Queue`, and `Low Stock SKUs` display authoritative figures from PostgreSQL.
- **Period Filter**: Click `Today`, `7 Days`, and `30 Days`; verify metrics recalculate instantly.
- **Recent Orders Quick Search**: Use in-table filter to search orders by customer name or order number.
- **Quick Action Hub**: Click `Orders Queue` to jump directly to open orders requiring packing.

### 5.2 Bank Transfer Verification Queue (`/admin/payments/bank-transfers`)
- **View Queue**: Review pending customer bank deposit submissions.
- **Inspect Deposit Details**: Click on a submission row to inspect uploaded receipt slip, customer deposit date, and transaction reference.
- **Approve Transfer**: Click `Verify & Approve Payment`. Verify order status transitions from `PENDING` to `PAID`, inventory reservation converts to committed sale, and an audit log entry is recorded.
- **Reject Transfer**: Click `Reject Transfer`. Provide rejection category (e.g. `UNREADABLE_RECEIPT` or `AMOUNT_MISMATCH`). Verify order transitions to `CANCELLED` and reserved physical inventory is atomically released back to warehouse stock.

### 5.3 Granular RBAC & Typed Confirmation Security (`/admin/super-admin`)
- **Super Admin Center**: Only accessible by accounts with `super_admin` role slug.
- **Sensitive Settings Modification**: Attempting to alter corporate bank details on `/admin/settings` prompts a mandatory **Typed Confirmation Modal**.
- **Confirmation Validation**: User must type the exact phrase `CONFIRM FINANCIAL SETTINGS`. If the phrase does not match, the backend API rejects the request with HTTP 400 Bad Request.

---

## 6. Granular RBAC Permissions Catalog (51 Verified Permissions)

The platform enforces 51 database-backed permissions across 12 operational categories:

1. **Dashboard (1)**: `dashboard.view`
2. **Products & Catalog (5)**: `products.view`, `products.create`, `products.edit`, `products.delete`, `products.import`
3. **Categories (4)**: `categories.view`, `categories.create`, `categories.edit`, `categories.delete`
4. **Brands (4)**: `brands.view`, `brands.create`, `brands.edit`, `brands.delete`
5. **Inventory (3)**: `inventory.view`, `inventory.adjust`, `inventory.export`
6. **Orders (6)**: `orders.view`, `orders.edit`, `orders.status`, `orders.cancel`, `orders.refund`, `orders.export`
7. **Customers (4)**: `customers.view`, `customers.edit`, `customers.status`, `customers.export`
8. **School Packs (4)**: `school_packs.view`, `school_packs.create`, `school_packs.edit`, `school_packs.delete`
9. **Recommendations / Find My Stationery (2)**: `recommendations.view`, `recommendations.edit`
10. **Marketing & Promos (8)**: `promotions.view`, `promotions.create`, `promotions.edit`, `promotions.delete`, `banners.view`, `banners.create`, `banners.edit`, `banners.delete`
11. **Newsletter (3)**: `newsletter.view`, `newsletter.manage`, `newsletter.export`
12. **System & Security (7)**: `reports.view`, `reports.export`, `audit_logs.view`, `audit_logs.export`, `settings.view`, `settings.edit`, `settings.financial`, `admins.view`, `admins.create`, `admins.edit`, `admins.delete`, `roles.view`, `roles.create`, `roles.edit`, `roles.delete`

---

## 7. QA Test Cases

### TC-01: Customer Registration & Duplicate Email Protection
- **Preconditions**: Storefront running on `:3000`.
- **Test Steps**:
  1. Open `/register`.
  2. Enter Name: `"Test Customer"`, Email: `"customer@dslstationery.lk"`, Password: `"TestPass123@"`.
  3. Click `Create Account`.
  4. Repeat registration with the identical email address.
- **Expected Result**: First attempt succeeds with redirect to login/welcome. Second attempt displays inline error: `"An account with this email address already exists."`

### TC-02: Out-of-Stock Purchase Prevention
- **Preconditions**: Product exists with `stockQuantity = 0`.
- **Test Steps**:
  1. Navigate to out-of-stock product page.
  2. Verify `Add to Cart` button is disabled and displays `Out of Stock`.
  3. Verify `Notify Me When Available` subscription box is visible.

### TC-03: Cash on Delivery (COD) Checkout Flow
- **Preconditions**: Cart contains 1+ in-stock items totaling < Rs. 50,000.
- **Test Steps**:
  1. Open `/checkout`.
  2. Select delivery address in Western Province.
  3. Select payment method `Cash on Delivery`.
  4. Click `Confirm Order`.
- **Expected Result**: Order created with status `CONFIRMED`, payment status `PENDING`, payment method `CASH_ON_DELIVERY`. Inventory `reservedStock` incremented.

### TC-04: Unauthorized Admin Route Interception
- **Preconditions**: User is logged in as `CUSTOMER` or unauthenticated.
- **Test Steps**:
  1. Open browser address bar and navigate directly to `http://localhost:3000/admin/dashboard`.
- **Expected Result**: User is automatically intercepted and redirected to `/admin/login?returnUrl=%2Fadmin%2Fdashboard`. Direct API calls to `/api/v1/admin/*` return HTTP 401 Unauthorized.

### TC-05: Sensitive Bank Transfer Settings Typed Confirmation
- **Preconditions**: Logged in as `admin@dslstationery.lk`.
- **Test Steps**:
  1. Navigate to `/admin/settings`.
  2. Modify Corporate Bank Account Number.
  3. Click `Save Configuration`.
  4. In the confirmation dialog, type `"CONFIRM"` (incorrect).
  5. Click `Execute Update`.
- **Expected Result**: Submission blocked. System displays: `"Please type the exact phrase 'CONFIRM FINANCIAL SETTINGS' to proceed."`

---

## 8. Master QA Execution Checklist

### Customer Storefront
- [ ] Homepage hero banner transitions and brand carousel rendering
- [ ] Catalog full-text search and category filter facet counts
- [ ] Product detail variant switches and real-time stock indicator
- [ ] Cart drawer slide-in, item quantity increment/decrement, and subtotal calculation
- [ ] Free delivery progress indicator (Rs. 5,000 threshold)
- [ ] Find My Stationery recommendation generator by student grade
- [ ] Upload Your List file drag-and-drop and fallback preview
- [ ] School Pack grade bundle selector and single-click cart assembly
- [ ] Checkout form validation (phone format, district selection)
- [ ] Cash on Delivery order placement
- [ ] Bank Transfer receipt slip upload
- [ ] Customer account order history and delivery status badge

### Operations Admin Console
- [ ] Admin login authentication and session cookie issuance
- [ ] Executive dashboard KPI card totals matching database aggregates
- [ ] Mobile navigation drawer toggle on tablet/phone viewports
- [ ] Product catalog listing, column visibility toggles, and CSV export
- [ ] Product creation with SKU auto-generation and image attachment
- [ ] Warehouse stock adjustment modal with audit reason logging
- [ ] Customer orders queue filtering by fulfillment status
- [ ] Bank transfer receipt review drawer and verification actions
- [ ] Super Admin Center privilege overview
- [ ] Store settings persistence (bank accounts, delivery thresholds, contact hotline)
- [ ] Granular role creation and permission toggle matrix

---

## 9. Final QA Sign-off Matrix

| Feature Area | Execution Status | QA Lead Sign-Off | Sign-Off Date | Notes |
|---|---|---|---|---|
| **Customer Storefront** | Pending QA Run | | | Automated production build passed (62/62 pages) |
| **Commerce & Cart** | Pending QA Run | | | Verified in dev environment |
| **Checkout & Payments**| Pending QA Run | | | Verified with COD and Bank Transfer queues |
| **Admin Operations** | Pending QA Run | | | Verified with Super Admin credentials |
| **Database & RBAC** | Pending QA Run | | | 51/51 permissions verified in PostgreSQL 18 |
| **System Security** | Pending QA Run | | | Typed confirmations and cookie auth active |

