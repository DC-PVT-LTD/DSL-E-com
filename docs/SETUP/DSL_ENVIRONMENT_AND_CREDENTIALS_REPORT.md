# DSL Stationery E-Commerce Platform
## Environment Variables, Credentials, Database & System Handover Report

**Document Version:** 1.0.0  
**Target Audience:** QA Engineers, System Administrators, DevOps Engineers, and Onboarding Developers  
**Target Environment:** Windows 10/11 Development & QA Workstation  
**Authoritative Baseline Date:** November 16, 2026  
**System Status:** Production Build Passed | 17/17 Migrations Applied | Zero Compilation Errors  

---

### Executive Summary

This report establishes the complete environment inventory, credentials checklist, database architecture, and second-computer transfer protocol for the **DSL Stationery E-Commerce Platform**. The system consists of:

1. **Customer-Facing Storefront** (Next.js 16 with Turbopack, React 19, Tailwind CSS)
2. **Operations & Super Admin Control Center** (Next.js 16 with RBAC and Typed Confirmations)
3. **Backend API Server** (NestJS 11, Node.js v24, TypeScript 5.8)
4. **Relational Database** (PostgreSQL 18.4 with Prisma 7.10.1 and `@prisma/adapter-pg` driver adapter)
5. **Real-Time WebSockets Engine** (Socket.IO for instant inventory synchronization and incoming order processing)

---

### PART 1 — Host System & Software Versions

The following software versions are actively verified on the primary development workstation and must be matched on the target Windows computer:

| Component | Verified Version | Purpose | Required? |
|---|---|---|---|
| **Operating System** | Windows 10 / 11 (x64) | Host OS | Required |
| **Node.js** | `v24.18.0` (LTS or Active) | JavaScript runtime for Next.js & NestJS | Required |
| **npm** | `11.16.0` | Node package manager | Required |
| **Git for Windows** | `2.55.0.windows.2` or higher | Version control & repository tracking | Required |
| **PostgreSQL** | `18.4` (x86_64-windows) | Primary relational database | Required |
| **Prisma CLI / Client** | `7.10.1` | Type-safe ORM & database migration engine | Required |
| **Prisma Driver Adapter** | `@prisma/adapter-pg` (`7.10.1`) | PostgreSQL driver adapter for connection pooling | Required |
| **Shell Environment** | Windows PowerShell 5.1 / PowerShell 7 | Terminal and script execution | Required |

---

### PART 2 — Complete Environment Variables Inventory

#### A. Frontend Environment (`frontend/.env`)

| Variable | Application | Purpose | Required | Current Status | Source of Value |
|---|---|---|---|---|---|
| `PORT` | Frontend | Next.js local development server port | Required | `3000` | `frontend/.env` |
| `NEXT_PUBLIC_USE_MOCK` | Frontend | Toggle between mock layer (`true`) and live backend API (`false`) | Required | `false` | `frontend/.env` |
| `NEXT_PUBLIC_API_URL` | Frontend | Authoritative NestJS API base endpoint prefix | Required | `http://localhost:4000/api/v1` | `frontend/.env` |
| `NEXT_PUBLIC_BACKEND_URL` | Frontend | Fallback API base URL used by specific service clients | Optional | `http://localhost:4000/api/v1` | `frontend/.env` |
| `NEXT_PUBLIC_DEFAULT_CURRENCY` | Frontend | Currency display code for price formatting | Required | `LKR` | `frontend/.env` |
| `NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD_CENTS` | Frontend | Storefront threshold in cents for free shipping banner (Rs. 5,000.00) | Optional | `500000` | `frontend/.env` |
| `NEXT_PUBLIC_ENABLE_DEMO_BANNER` | Frontend | Toggles top demo disclaimer banner | Optional | `false` | `frontend/.env` |
| `NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER` | Frontend | DSL customer hotline for WhatsApp-assisted ordering | Optional | `+94772355530` | `frontend/.env` |

#### B. Backend Environment (`backend/.env`)

| Variable | Application | Purpose | Required | Current Status | Source of Value |
|---|---|---|---|---|---|
| `PORT` | Backend | NestJS HTTP server port | Required | `4000` | `backend/.env` |
| `NODE_ENV` | Backend | Application environment mode | Required | `development` | `backend/.env` |
| `CORS_ORIGIN` | Backend | Comma-separated list of permitted browser origins | Required | `http://localhost:3000,http://localhost:3001,http://localhost:3002` | `backend/.env` |
| `DATABASE_URL` | Backend | PostgreSQL connection URL including credentials and schema | Required | `CONFIGURED (value hidden)` | `backend/.env` |
| `TEST_DATABASE_URL` | Backend | Dedicated database connection string for isolated integration tests | Optional | `CONFIGURED (value hidden)` | `backend/.env` |
| `JWT_SECRET` | Backend | Cryptographic secret for signing administrative & customer JWT tokens | Required | `CONFIGURED (value hidden)` | `backend/.env` |
| `JWT_EXPIRES_IN` | Backend | Access token validity window (enforced via HTTP-only cookie) | Required | `15m` | `backend/.env` |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Backend | Cryptographic refresh token validity window in database | Required | `7` | `backend/.env` |
| `BCRYPT_ROUNDS` | Backend | Work factor for password hashing | Required | `10` | `backend/.env` |
| `FRONTEND_URL` | Backend | Storefront base URL for notification redirects | Required | `http://localhost:3000` | `backend/.env` |
| `BACKEND_URL` | Backend | Authoritative API base URL | Required | `http://localhost:4000/api/v1` | `backend/.env` |
| `STORAGE_DIR` | Backend | Local directory for private deposit slip receipt storage | Required | `uploads/private_receipts` | `backend/.env` |
| `PRIMARY_SUPER_ADMIN_EMAIL` | Backend | Super Admin email shielded from deletion and privilege modification | Required | `admin@dslstationery.lk` | `backend/.env` |
| `PAYHERE_MERCHANT_ID` | Backend | PayHere Payment Gateway Merchant ID | Optional (QA) | `CONFIGURED (sandbox)` | `backend/.env` |
| `PAYHERE_MERCHANT_SECRET` | Backend | PayHere Merchant Secret for MD5 payment verification hashing | Optional (QA) | `CONFIGURED (value hidden)` | `backend/.env` |
| `PAYHERE_SANDBOX` | Backend | Enables PayHere Sandbox testing mode | Optional (QA) | `true` | `backend/.env` |
| `PAYHERE_NOTIFY_URL` | Backend | Webhook URL for server-to-server IPN payment callbacks | Optional (QA) | `http://localhost:4000/api/v1/payments/payhere/notify` | `backend/.env` |
| `SMTP_HOST` | Backend | SMTP server host for transactional emails | Optional (QA) | `CONFIGURED (value hidden)` | `backend/.env` |
| `SMTP_PORT` | Backend | SMTP server port (e.g. 587 or 2525) | Optional (QA) | `587` | `backend/.env` |
| `SMTP_SECURE` | Backend | TLS/SSL toggle for SMTP connection | Optional (QA) | `false` | `backend/.env` |
| `SMTP_USER` | Backend | Username for transactional email authentication | Optional (QA) | `CONFIGURED (value hidden)` | `backend/.env` |
| `SMTP_PASS` | Backend | Password for transactional email authentication | Optional (QA) | `CONFIGURED (value hidden)` | `backend/.env` |
| `MAIL_FROM_NAME` | Backend | Display name for outbound customer notifications | Optional (QA) | `"DSL Stationery"` | `backend/.env` |
| `MAIL_FROM_EMAIL` | Backend | Outbound sender address for customer notifications | Optional (QA) | `CONFIGURED (value hidden)` | `backend/.env` |
| `CONTACT_RECEIVER_EMAIL` | Backend | Internal inbox for receiving customer contact form submissions | Optional (QA) | `CONFIGURED (value hidden)` | `backend/.env` |
| `OCR_PROVIDER` | Backend | Provider for 'Upload Your List' image text extraction (`auto`, `simulated`, `google_vision`) | Optional (QA) | `auto` | `backend/.env` |
| `OCR_API_KEY` | Backend | Google Cloud Vision API key (falls back to simulation if omitted) | Optional (QA) | `NOT CONFIGURED` | `backend/.env` |

---

### PART 3 — Credentials & Access Summary

> [!IMPORTANT]
> In accordance with security protocol, plaintext secrets, production passwords, and cryptographic keys are strictly redacted from this report. All credentials must be provisioned locally or obtained through authorized team password vaults.

| Credential | Required for | Configured on Dev? | Where to Obtain / Generate | Needed for Local QA? |
|---|---|---|---|---|
| **PostgreSQL Database Password** | Local DB access | `CONFIGURED (value hidden)` | Defined during local PostgreSQL 18 installation | **Yes** (Essential) |
| **JWT Signing Secret (`JWT_SECRET`)** | Session & Cookie Auth | `CONFIGURED (value hidden)` | Generate random 64-character hex string | **Yes** (Essential) |
| **Super Admin Password** | Access to `/admin` portal | `CONFIGURED (value hidden)` | Set via provisioning script or QA lead (`admin@dslstationery.lk`) | **Yes** (Essential) |
| **PayHere Sandbox Secret** | Online Card Checkout test | `CONFIGURED (sandbox)` | Register free account at [sandbox.payhere.lk](https://sandbox.payhere.lk) | No (Cash on Delivery & Bank Transfer work without it) |
| **SMTP Mailer Credentials** | Outbound order email delivery | `CONFIGURED (sandbox)` | Free Mailtrap account or local sandbox inbox | No (Backend logs emails to console if unconfigured) |
| **Google Cloud Vision OCR Key** | Handwriting extraction in Upload Your List | `NOT CONFIGURED (auto fallback)` | Google Cloud Console Vision API | No (Built-in simulation matches sample stationery lists) |
| **Koko BNPL API Key** | Buy Now Pay Later checkout | `NOT IMPLEMENTED` | Pending business partnership agreement | No |

---

### PART 4 — Authoritative Database Architecture

- **Engine:** PostgreSQL 18.4 (Compiled via MSVC-19.44, 64-bit)
- **Database Name:** `dsl_stationery`
- **Default Port:** `5432`
- **Schema Name:** `public`
- **ORM:** Prisma 7.10.1 with `@prisma/adapter-pg`
- **Models Count:** `53` Prisma Models
- **Enums Count:** `23` System Enums
- **Database Permissions:** `51` Granular Permissions (Database-backed)
- **Database Roles:** `8` Roles (5 System Roles: Super Admin, Project Manager, Product Manager, Order Manager, Customer Manager + 3 Custom Roles)
- **Migrations Applied:** `17` Complete Sequential Migrations:
  1. `20261028090410_init_dsl_schema`
  2. `20261102103106_add_auth_refresh_tokens`
  3. `20261104035831_add_shopping_cart`
  4. `20261105155500_add_back_in_stock_alerts`
  5. `20261105161800_add_email_verification_and_tracking_security`
  6. `20261105170000_harden_back_in_stock_alert_reliability`
  7. `20261106001000_add_homepage_banners`
  8. `20261106110000_add_newsletter_models`
  9. `20261106120000_add_promotion_and_discount_rules`
  10. `20261106130000_add_admin_invitations`
  11. `20261106140000_add_roles_and_granular_permissions`
  12. `20261108000000_add_category_hierarchy_and_subcategories`
  13. `20261108100000_add_global_sku_and_sku_sequence`
  14. `20261108120000_add_product_import_execution_models`
  15. `20261115180000_sync_bank_deposits_and_settings`
  16. `20261115190000_add_verification_challenge_and_financial_permissions`
  17. `20261116110000_add_refund_record_extended_fields`

---

### PART 5 — Database Transfer Protocol

To guarantee identical product catalog data, categories, and inventory without re-importing 95 SKUs manually, export a clean database dump from the source machine.

#### Step 1: Export Database Dump (Source Machine)
In Windows PowerShell on the source machine:
```powershell
# Navigate to project root
cd "C:\Users\Yehara Kobbagala\Desktop\Projects\DSL E-com"

# Create binary custom backup (includes schema, sequences, and tables)
pg_dump -h localhost -p 5432 -U postgres -F c -b -v -f "dsl_stationery_qa_backup.dump" dsl_stationery
```

#### Step 2: Restore Database Dump (Second Machine)
In Windows PowerShell on the second machine:
```powershell
# 1. Create fresh database
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE dsl_stationery;"

# 2. Restore schema and data from dump
pg_restore -h localhost -p 5432 -U postgres -d dsl_stationery -v "dsl_stationery_qa_backup.dump"

# 3. Verify restore integrity
psql -h localhost -p 5432 -U postgres -d dsl_stationery -c "SELECT COUNT(*) FROM \"Product\";"
# Expected output: 95
```

---

### PART 6 — Administrator Login Provisioning

The platform enforces strict role-based access control (RBAC). The Super Admin account is:
- **Email:** `admin@dslstationery.lk`
- **Role:** `Super Admin` (Slug: `super_admin`, Role ID: Database-backed)
- **Permissions:** `51/51` permissions (Full platform bypass and typed confirmation authority)

If setting up a fresh database without restoring the backup dump, run the safe provisioning script provided in [DSL_SECOND_COMPUTER_SETUP_GUIDE.md](file:///c:/Users/Yehara%20Kobbagala/Desktop/Projects/DSL%20E-com/docs/SETUP/DSL_SECOND_COMPUTER_SETUP_GUIDE.md) to initialize the Super Admin account and seed the 51 database permissions.

