# DSL Stationery E-Commerce Platform

A production-quality frontend e-commerce platform and administrative management portal built for **DSL Stationery**, a premier Sri Lankan stationery retail and school supply brand.

---

## 🎨 Brand Identity & Theme
- **Primary Brand Color**: Deep Navy (`#08275E`)
- **Accent Brand Color**: Bright Yellow (`#FFD21C`)
- **Background & Canvas**: Crisp Clean White (`#FFFFFF`) / Soft Slate Neutrals (`#F8FAFC`, `#F1F5F9`)
- **Currency**: Sri Lankan Rupees (**LKR / Rs.**)

---

## 🚀 Key Architectural Highlights

### 1. Unified Next.js 16 App Router Structure
Both customer-facing storefront and administrative interfaces reside cleanly inside one modern Next.js 16 application:
- **Customer Storefront (`/`)**: High-converting, responsive consumer shopping experience.
- **Admin Management Portal (`/admin/*`)**: Comprehensive back-office dashboard, inventory controller, order fulfillment station, and catalogue management console.

### 2. Precise Financial Calculations (Safe Minor Units)
To prevent floating-point rounding errors common in e-commerce, all pricing, discounts, tax, and order totals are calculated and stored internally as **integer minor units (LKR cents)**:
- `Rs. 450.00` is represented as `45000` cents.
- Conversions to human-readable strings occur strictly at presentation time using `formatLKR(cents)` and `formatLKRCompact(cents)` in `src/lib/currency.ts`.
- Free delivery threshold (`Rs. 5,000.00` = `500,000` cents) dynamically shows real-time progress bars in cart drawer and checkout pages.

### 3. Unified API Client & State Reactivity
- **API Service Layer (`src/lib/api/apiClient.ts`)**: Modular client allowing instant switching between in-memory/localStorage mock mode (`NEXT_PUBLIC_USE_MOCK=true`) and live backend API services without rewriting components.
- **Cross-Interface Real-Time Sync**: Stock updates, order transitions, and catalogue edits made in `/admin` immediately reflect across the customer storefront in the running session via pub-sub listeners and synchronized local stores.
- **Demo State Reset**: Includes a one-click demo data reset tool (`resetDemoService.ts`) in the top banner and admin settings to return the database to clean baseline mock states at any time.

---

## 🛍️ Customer Storefront Features

1. **Homepage & Merchandising**:
   - Hero banner with quick links to smart tools (School Packs, List Upload, Recommendation Finder).
   - Value propositions (Islandwide delivery, authentic brand warranties, wholesale school packs).
   - Interactive category grid and featured Sri Lankan brands (Atlas, Promate, Faber-Castell, Nataraj, Kangaro, Staedtler).
   - "Back to School" promotion banners, bestsellers carousel, and verified customer testimonials.

2. **Catalog & Advanced Filtering (`/shop`, `/categories`, `/brands`)**:
   - Multi-criteria filtering by category, brand, grade level, price range slider, and in-stock toggles.
   - Sorting by popularity, newest, price low-to-high, and price high-to-low.
   - Quick-add to cart directly from product cards.

3. **Product Detail View (`/products/[slug]`)**:
   - High-resolution gallery preview with stock badge indicators.
   - Volume/bulk discount tier breakdown (e.g. 10+ items save 5%, 25+ save 10%).
   - Authentic technical specifications (ruling, paper weight GSM, pack count, non-toxic certifications).
   - Cross-sell recommendations ("Frequently Bought Together").

4. **Smart Stationery Features**:
   - **Find My Stationery Wizard (`/find-my-stationery`)**: Step-by-step persona guide for Primary School (Grades 1-5), Middle School (Grades 6-9), O/L, A/L (Science, Commerce, Arts, Tech), University Students, Office Professionals, and Fine Artists. Automatically generates customized bundles.
   - **Pre-configured School Packs (`/school-packs`, `/school-packs/[id]`)**: Grade-specific bundles (Budget, Standard, Premium) with interactive checklist customizer, item toggles, bundle savings indicator, and 1-click cart export.
   - **Booklist OCR Upload (`/upload-list`, `/upload-list/[id]/review`)**: Realistic upload simulation supporting PDF, JPG, and PNG school lists. Simulates OCR text extraction with confidence scoring, catalog matching, manual substitution, and batch checkout.

5. **Cart, Checkout & Order Tracking**:
   - Flyout drawer cart with free delivery progress meter and coupon validation (`BACKTOSCHOOL`, `DSLFIRST`, `OFFICE10`).
   - Frictionless two-step checkout supporting Sri Lankan districts, delivery notes, and payment options:
     - Cash on Delivery (COD)
     - Bank Transfer / Deposit Slip Upload simulation
     - Online Card / Koko / Mintpay payment gateway simulation
   - Visual step-by-step order tracker (`/orders/[id]`) displaying status progression (`Confirmed` ➔ `Processing` ➔ `Shipped` ➔ `Delivered`).

6. **Account & Self-Service Portal (`/account`)**:
   - Order history with downloadable receipt view.
   - Saved delivery addresses management.
   - Wishlist and reusable custom stationery lists (e.g., "Term 2 Refill", "Monthly Office Supplies").

---

## 🛡️ Admin Management Portal (`/admin`)

- **Dashboard (`/admin/dashboard`)**: KPI metric cards (Total Sales, Active Orders, Low Stock Alerts, Processing Queue), order trend charts, and recent activity logs.
- **Product Catalogue (`/admin/products`)**: Product table with SKU search, stock indicators, and full CRUD creation/editing (`/new`, `/[id]/edit`).
- **Category & Brand Management (`/admin/categories`, `/admin/brands`)**: Add/edit categories, manage icons, and track active item counts.
- **Inventory Controller (`/admin/inventory`)**: Stock level monitoring, threshold alerts, manual stock adjustments with audit reasons (`restock`, `damage`, `physical count correction`, `order fulfillment`).
- **Order Fulfillment Station (`/admin/orders`, `/[id]`)**: Strict status transition workflow with validation, tracking number assignment, courier selection (Certis Lanka, PromptX, Koombiyo, Domex), and simulated refund processing.
- **School Pack Creator (`/admin/school-packs/new`)**: Configure bundle contents, assign grades, and set promotional discounts.
- **Upload Reviews Queue (`/admin/upload-reviews`)**: Back-office review screen for customer-submitted booklists with low OCR confidence scores.
- **Marketing & Promotions (`/admin/promotions`, `/admin/banners`)**: Create coupon codes, manage percentage/fixed discounts, expiration dates, and homepage promotional slides.
- **Reports & Auditing (`/admin/reports`, `/admin/audit-logs`)**: Sales breakdowns by category, export CSV simulation, and complete historical audit trails.
- **Store Settings & Demo Reset (`/admin/settings`)**: Delivery fee configuration, free shipping threshold, and 1-click demo state reset.

---

## ⚙️ Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **Language** | TypeScript (Strict Mode) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) with custom CSS design tokens |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) with localStorage persistence |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Testing** | [Vitest](https://vitest.dev/) + React Testing Library + JSDOM |
| **Forms & Validation** | React Hook Form + Zod |

---

## 📁 Project Structure

```
d:\projects\office\DSL E-com\
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (store)/           # Customer storefront route group
│   │   │   │   ├── page.tsx       # Storefront homepage
│   │   │   │   ├── shop/          # Product catalogue
│   │   │   │   ├── categories/    # Category browsing
│   │   │   │   ├── products/      # Product detail pages
│   │   │   │   ├── school-packs/  # School packs & bundle customizer
│   │   │   │   ├── upload-list/   # Booklist OCR upload & review
│   │   │   │   ├── find-my-stationery/ # Smart recommendation wizard
│   │   │   │   ├── cart/          # Full cart page
│   │   │   │   ├── checkout/      # Multi-step checkout & confirmation
│   │   │   │   ├── orders/        # Order tracking stepper
│   │   │   │   └── account/       # Customer profile, addresses, orders
│   │   │   ├── admin/             # Back-office administration suite
│   │   │   │   ├── dashboard/     # Analytics & KPI overview
│   │   │   │   ├── products/      # Product catalog CRUD
│   │   │   │   ├── inventory/     # Stock adjustments & movements
│   │   │   │   ├── orders/        # Order processing & fulfillment
│   │   │   │   ├── customers/     # Customer database
│   │   │   │   ├── school-packs/  # Pack bundle configuration
│   │   │   │   ├── upload-reviews/# Booklist manual review queue
│   │   │   │   ├── promotions/    # Discount vouchers & rules
│   │   │   │   ├── banners/       # Homepage banner manager
│   │   │   │   └── settings/      # Store settings & demo reset
│   │   ├── components/            # Reusable UI components
│   │   │   ├── common/            # Navbar, Footer, Logo, DemoBanner, Drawers
│   │   │   ├── products/          # ProductCard, Filters, SpecTable
│   │   │   └── admin/             # AdminHeader, AdminSidebar, MetricCard
│   │   ├── lib/                   # Utilities (currency, formatting, API client)
│   │   ├── mocks/                 # Realistic mock databases (products, brands, etc.)
│   │   ├── services/              # Reactive business logic & Zustand stores
│   │   └── types/                 # Comprehensive TypeScript interfaces
│   ├── vitest.config.mts          # Vitest testing configuration
│   └── package.json               # Frontend dependencies & scripts
├── package.json                   # Root workspace proxy scripts
├── .env.example                   # Environment variable template
└── README.md                      # Platform documentation
```

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: v18.18.0 or newer (Node.js 20+ recommended)
- **npm**: v9+

### Installation & Run

1. **Install dependencies**:
   ```bash
   npm install
   ```
   *(or `cd frontend && npm install`)*

2. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.
   - Storefront: `http://localhost:3000/`
   - Admin Portal: `http://localhost:3000/admin/dashboard` (or click "Admin Portal" in header/footer)

3. **Run Unit & Service Test Suites**:
   ```bash
   npm test
   ```

4. **Production Build**:
   ```bash
   npm run build
   npm start
   ```

---

## 🔮 Simulated vs. Future Production Backend Requirements

This repository contains a 100% functional frontend architecture. When connecting to a production cloud backend, the following integrations are pre-structured via `src/lib/api/apiClient.ts`:

1. **Authentication**: Currently uses a simulated session in `userStore.ts`. Production will attach JWT Bearer tokens to `apiClient.ts` request headers.
2. **Payments**: Simulated Instant Payment Confirmation, Bank Transfer Slip Upload, and Cash on Delivery. Production integration targets: PayHere Sri Lanka, Commercial Bank IPG, Koko, or Mintpay webhooks.
3. **Booklist OCR Server**: Uploads currently simulate OCR recognition with realistic confidence intervals (`uploadService.ts`). Production backend will route files to an Amazon Textract / Google Cloud Vision OCR pipeline with a Sri Lankan stationery dictionary parser.
4. **WhatsApp & SMS Gateway**: Order tracking notifications currently display realistic reference messages. Production backend will dispatch live SMS via NotifyLK / Mobitel mBizz and WhatsApp Business API.
