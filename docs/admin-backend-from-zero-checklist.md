# DSL Backend + Admin Panel: Start-from-Zero Checklist

This guide is for a local Windows development setup. It follows the scripts and configuration currently in this repository. It does not connect to, reset, or modify a live database.

## How the pieces fit together

```text
Browser
  └─ Next.js admin UI: http://localhost:3000/admin
       └─ HTTP API + session cookies: http://localhost:4000/api/v1
            └─ NestJS backend
                 └─ Prisma + PostgreSQL: localhost:5432 / dsl_stationery
```

- The **frontend** displays the admin screens and sends requests to the backend.
- The **backend** authenticates administrators, checks roles/permissions, validates requests, and performs business operations.
- **PostgreSQL** stores users, products, stock, orders, permissions, settings, and other application data.
- **Prisma** connects the NestJS code to PostgreSQL. Migrations create/update the database structure; the seed script adds starter catalogue/store records.
- Admin login uses HTTP-only cookies. The admin page's login state is not a substitute for API authorization: protected backend routes enforce JWT and role/permission guards.

## Before you start

- [ ] Install Node.js 20.x or 22+ (the backend README also says Node 24 is supported) and npm 10+.
- [ ] Install PostgreSQL. The backend README specifies PostgreSQL 18.4, listening on `localhost:5432`.
- [ ] Create a PostgreSQL database named `dsl_stationery` and a database user/password with permission to create and update tables.
- [ ] Confirm ports 3000 (frontend), 4000 (backend), and 5432 (PostgreSQL) are available.
- [ ] Open PowerShell in the project folder: `C:\Users\Yehara Kobbagala\Desktop\Projects\DSL E-com`.

## 1. Install frontend dependencies

From the project root:

```powershell
npm install
```

The root `dev` script starts only the frontend. The backend is installed and started separately.

## 2. Configure the backend

```powershell
Set-Location backend
Copy-Item .env.example .env
```

Edit `backend/.env` and set at least:

```dotenv
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/dsl_stationery?schema=public
JWT_SECRET=PASTE_A_NEW_128_CHARACTER_HEX_SECRET_HERE
```

Generate a strong JWT secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the generated 128-character hexadecimal value into `JWT_SECRET`. Do not use the example value or share the real secret. **The current backend `.env.example` omits `JWT_SECRET`, but environment validation requires it, so add it yourself.** The backend validates configuration at startup.

Optional email/OCR/payment settings are not needed for the first local admin login. Leave providers unconfigured unless you are intentionally setting them up. The example PayHere values are sandbox/demo values, not production credentials.

## 3. Install backend packages and generate Prisma client

Still in `backend/`:

```powershell
npm install
npx prisma generate
```

The generated Prisma client is kept under `backend/src/generated/prisma`.

## 4. Create/update the database tables

For a local development database:

```powershell
npx prisma migrate deploy
```

This applies the checked-in migrations without creating a new migration. The repo currently has migrations for the initial schema and later additions such as authentication, cart, promotions, banners, newsletter, roles/permissions, category hierarchy, and product import.

If this is a disposable local database and you intentionally want to create a new development migration from schema edits, use Prisma's development migration workflow instead. Do not use a reset command on a database with data you need.

## 5. Add starter catalogue/store data

```powershell
npx prisma db seed
```

The seed script upserts store settings plus categories, brands, and sample products. **It does not create an administrator account.** It is safe to rerun for its seeded records, but inspect its contents before using it against a production database.

## 6. Create the first administrator account

The project provides `backend/scripts/provision-admin.ts`. It reads these environment variables from `backend/.env`:

```dotenv
PROVISION_ADMIN_EMAIL=you@example.com
PROVISION_ADMIN_PASSWORD=use-a-unique-password-at-least-12-characters
PRIMARY_SUPER_ADMIN_EMAIL=you@example.com
```

Use an email you control and a unique password at least 12 characters long. Then run:

```powershell
npx tsx scripts/provision-admin.ts
```

This creates an active account with the legacy `ADMIN` role. It does **not** set a password for an existing account. If that email already exists, stop and follow the script's message; do not try to create a duplicate.

## 7. Assign the dynamic Super Admin role and permissions

The roles/permissions system needs its backfill script after the account exists:

```powershell
npx tsx src/modules/admin/roles/backfill-super-admin.ts
```

Make sure `PRIMARY_SUPER_ADMIN_EMAIL` exactly matches the first administrator's email. This script creates/updates system roles and permissions, assigns the Super Admin role to that matching account, and quarantines other admin-role users without a dynamic role assignment. Review the script before running it on any database with existing administrator accounts.

After provisioning and backfill succeed, remove `PROVISION_ADMIN_PASSWORD` from `backend/.env` so it is not left in the local configuration. Keep `DATABASE_URL`, `JWT_SECRET`, and (if required for repeat backfills) the primary admin email private.

## 8. Start the backend and check its health

From `backend/`:

```powershell
npm run start:dev
```

Keep this terminal running. In another PowerShell window:

```powershell
curl.exe -i http://localhost:4000/api/v1/health
```

- [ ] Expect HTTP 200 and a healthy database status.
- [ ] If startup fails, check the missing/invalid environment variables first.
- [ ] If health reports a disconnected database, check PostgreSQL is running, the database exists, and `DATABASE_URL` credentials are correct.

Swagger docs are served at `http://localhost:4000/api/v1/docs`.

## 9. Point the frontend at this backend

In a separate PowerShell window, return to the project root and create/edit the frontend environment file:

```powershell
Set-Location ..
Copy-Item .env.example .env.local
```

Set:

```dotenv
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

**Important mismatch:** the root `.env.example` currently points to port `8000`, but the backend defaults to port `4000`. Use `4000` for this local setup. Restart the frontend after changing `.env.local`; Next.js reads `NEXT_PUBLIC_*` values at startup/build time.

The API client defaults to port 4000 when `NEXT_PUBLIC_API_URL` is absent. The `NEXT_PUBLIC_USE_MOCK` flag exists, but individual admin pages/services are not all governed by one central mock switch—some pages still explicitly use mock/local data. Setting it to `false` connects API-backed features; it does not make every admin screen production-backed.

## 10. Start the frontend and sign in

From the project root:

```powershell
npm run dev
```

- [ ] Open `http://localhost:3000/admin/login`.
- [ ] Sign in with the email/password created in Step 6.
- [ ] The UI should send the admin login request to `http://localhost:4000/api/v1/auth/admin/login`.
- [ ] The backend should set HTTP-only access and refresh cookies.
- [ ] On success, the UI sends you to `/admin/dashboard` (or a safe requested `/admin/...` return URL).
- [ ] Open an admin screen such as `/admin/products` and confirm the request succeeds against the API.

If login fails, check in this order:

1. Backend terminal startup/configuration errors.
2. Health endpoint and database connection.
3. That migrations and seed completed.
4. That the admin provisioning script completed successfully.
5. That the backfill used the same email and assigned the Super Admin role.
6. Frontend `.env.local` points to port 4000 and the frontend was restarted.
7. Browser network response for `/auth/admin/login` (401 usually means credentials/account; 403 means role/access; network error usually means URL/CORS/server).

## What each admin feature is backed by today

- **Backend-backed or designed for API integration:** catalogue/products/import, categories, brands, inventory, order management, school packs, promotions, banners, uploaded-document reviews, newsletter, admin users/roles, recommendation rules.
- **Still demo/local in the current UI:** dashboard KPI calculations, reports, customer directory/profile data, global audit-log page, some store settings. Their screens should not be treated as live operational data just because backend services exist elsewhere.
- **Order management warning:** backend order endpoints exist, but some frontend services/docs still carry stale “backend pending” fallbacks. One known return-processing request/DTO field mismatch also needs integration cleanup.

## Files this checklist follows

- `backend/README.md`
- `backend/package.json`
- `backend/.env.example`
- `backend/prisma.config.ts`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/`
- `backend/prisma/seed.ts`
- `backend/scripts/provision-admin.ts`
- `backend/src/modules/admin/roles/backfill-super-admin.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `frontend/src/app/admin/login/page.tsx`
- `frontend/src/app/admin/layout.tsx`
- `frontend/src/lib/api/apiClient.ts`

## First successful setup checklist

- [ ] PostgreSQL running and `dsl_stationery` database created
- [ ] Backend `.env` has valid `DATABASE_URL` and generated `JWT_SECRET`
- [ ] Backend dependencies installed and Prisma client generated
- [ ] Migrations deployed
- [ ] Starter store/catalogue seed completed
- [ ] First admin provisioned
- [ ] Super Admin role backfill completed for the same email
- [ ] Backend health endpoint reports connected database
- [ ] Frontend `.env.local` points to backend port 4000
- [ ] Frontend and backend both running
- [ ] Admin login succeeds and an API-backed admin page loads
