# DSL Stationery E-Commerce Platform
## Environment Handover & Migration Checklist

Use this checklist to track the end-to-end setup and verification on the new Windows workstation.

---

### Phase 1 — Software Prerequisites
- [ ] Windows 10 or 11 (64-bit) updated
- [ ] Git for Windows installed (`git --version` outputs 2.40+)
- [ ] Node.js v24 installed (`node -v` outputs `v24.18.0` or higher)
- [ ] npm installed (`npm -v` outputs `11.16.0` or higher)
- [ ] PostgreSQL 18 installed and running on port 5432
- [ ] `psql`, `pg_dump`, and `pg_restore` accessible in PowerShell PATH

---

### Phase 2 — Repository Transfer & Files
- [ ] Repository cloned or copied to destination folder without `node_modules` or `.next`
- [ ] `backend/package.json` and `frontend/package.json` verified intact
- [ ] `dsl_stationery_qa_backup.dump` transferred (if migrating preloaded catalog data)

---

### Phase 3 — Environment Files Setup
- [ ] `backend/.env` created from `backend/.env.example`
- [ ] `DATABASE_URL` configured with local PostgreSQL user/password
- [ ] `JWT_SECRET` generated with a fresh 64-character random hex string
- [ ] `PORT=4000` set in `backend/.env`
- [ ] `CORS_ORIGIN` includes `http://localhost:3000`
- [ ] `frontend/.env` created from `frontend/.env.example`
- [ ] `NEXT_PUBLIC_USE_MOCK=false` confirmed in `frontend/.env`
- [ ] `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` confirmed in `frontend/.env`

---

### Phase 4 — Database Initialization & Migrations
- [ ] Database `dsl_stationery` created (`CREATE DATABASE dsl_stationery;`)
- [ ] Dump restored OR `npx prisma migrate deploy` executed successfully (17/17 migrations applied)
- [ ] `npx prisma generate` executed in `backend` directory
- [ ] Verified table count (53 tables created)
- [ ] Verified 51 database permissions populated in `Permission` table
- [ ] Verified 5 system roles (`Super Admin`, `Project Manager`, `Product Manager`, `Order Manager`, `Customer Manager`) populated in `Role` table

---

### Phase 5 — Administrator Account Provisioning
- [ ] Super Admin account `admin@dslstationery.lk` present in `User` table
- [ ] Role set to `ADMIN` and linked to `super_admin` role in `Role` table
- [ ] `isActive` set to `true` and `failedLoginAttempts` set to `0`

---

### Phase 6 — Build & Runtime Verification
- [ ] Backend build passes with zero errors (`cd backend && npm run build`)
- [ ] Backend starts cleanly on port 4000 (`node dist/main.js`)
- [ ] Backend Swagger documentation loads at `http://localhost:4000/api/v1/docs`
- [ ] Frontend build passes with zero errors (`cd frontend && npm run build`)
- [ ] Frontend starts cleanly on port 3000 (`npm run dev`)
- [ ] Customer homepage renders with real products at `http://localhost:3000`
- [ ] Admin login successful at `http://localhost:3000/admin/login`
- [ ] Admin dashboard KPIs load without errors at `http://localhost:3000/admin/dashboard`
- [ ] Settings page loads without errors at `http://localhost:3000/admin/settings`
- [ ] Payments page loads without errors at `http://localhost:3000/admin/payments`

