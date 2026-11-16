# DSL Stationery E-Commerce Platform
## Second Windows Computer Setup & Deployment Guide

**Target Environment:** Windows 10 / 11 (64-bit)  
**Applicable Roles:** QA Engineers, Developers, Evaluators  
**Estimated Setup Time:** 15–20 minutes  

---

### Step 1 — Prerequisites Installation

Open PowerShell as **Administrator** and verify or install the required runtime tools:

#### 1. Git for Windows
Download and install from [git-scm.com](https://git-scm.com/download/win) (or via `winget`):
```powershell
winget install --id Git.Git -e --source winget
```
Verify:
```powershell
git --version
# Expected: git version 2.40+ (Tested: 2.55.0.windows.2)
```

#### 2. Node.js (v24 LTS / Active) & npm
Download and install from [nodejs.org](https://nodejs.org/) (or via `winget`):
```powershell
winget install OpenJS.NodeJS -e
```
Verify:
```powershell
node -v
# Expected: v24.x.x (Tested: v24.18.0)
npm -v
# Expected: 11.x.x (Tested: 11.16.0)
```

#### 3. PostgreSQL 18.x
Download and install from [enterprisedb.com/downloads/postgres-postgresql-downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads):
- Port: `5432`
- Default superuser: `postgres`
- Note your chosen password (e.g. `postgres` or `admin123`)
- Ensure PostgreSQL Command Line Tools (`psql`, `pg_dump`, `pg_restore`) are added to your System `PATH` (typically `C:\Program Files\PostgreSQL\18\bin`).

Verify:
```powershell
psql --version
# Expected: psql (PostgreSQL) 18.x
```

---

### Step 2 — Project Transfer & Directory Setup

Copy the project directory to your workspace, for example:
```powershell
cd "C:\Users\<YourUsername>\Desktop\Projects"
# or clone the repository
git clone <repository-url> "DSL E-com"
cd "DSL E-com"
```

---

### Step 3 — Dependency Installation

#### 1. Backend Dependencies
```powershell
cd backend
npm install
cd ..
```

#### 2. Frontend Dependencies
```powershell
cd frontend
npm install
cd ..
```

---

### Step 4 — Environment Configuration

#### 1. Create Backend Environment (`backend/.env`)
Copy `backend/.env.example` to `backend/.env`:
```powershell
Copy-Item "backend/.env.example" "backend/.env"
```
Edit `backend/.env` with your actual local PostgreSQL credentials and generate a unique JWT secret:
```ini
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://127.0.0.1:3000

# Replace 'your_password' with your local PostgreSQL password
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/dsl_stationery?schema=public"

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET="a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"
JWT_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_DAYS=7
BCRYPT_ROUNDS=10

FRONTEND_URL="http://localhost:3000"
BACKEND_URL="http://localhost:4000/api/v1"
STORAGE_DIR="uploads/private_receipts"
PRIMARY_SUPER_ADMIN_EMAIL="admin@dslstationery.lk"

PAYHERE_SANDBOX=true
OCR_PROVIDER="auto"
```

#### 2. Create Frontend Environment (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:
```powershell
Copy-Item "frontend/.env.example" "frontend/.env"
```
Verify the contents of `frontend/.env`:
```ini
PORT=3000
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_API_URL="http://localhost:4000/api/v1"
NEXT_PUBLIC_DEFAULT_CURRENCY="LKR"
NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD_CENTS=500000
NEXT_PUBLIC_ENABLE_DEMO_BANNER=false
NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER="+94772355530"
```

---

### Step 5 — Database Initialization & Migrations

#### Option A: Restore from Full Database Dump (Recommended)
If you received `dsl_stationery_qa_backup.dump`:
```powershell
# 1. Create database
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE dsl_stationery;"

# 2. Restore all 53 tables, 95 products, and 51 permissions
pg_restore -h localhost -p 5432 -U postgres -d dsl_stationery -v "dsl_stationery_qa_backup.dump"
```

#### Option B: Fresh Migration Deployment
If starting without a database dump:
```powershell
# 1. Create database
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE dsl_stationery;"

# 2. Deploy Prisma migrations
cd backend
npx prisma migrate deploy

# 3. Generate Prisma 7 type-safe client
npx prisma generate

# 4. Seed system permissions, roles, and initial super admin
npm run seed
cd ..
```

---

### Step 6 — Start the Applications

#### Terminal 1 — Start Backend Server (Port 4000)
```powershell
cd backend
npm run build
node dist/main.js
# Or for live hot-reload development:
# npm run start:dev
```
Verify output:
```
[Bootstrap] DSL Stationery backend running at http://localhost:4000/api/v1
[Bootstrap] Swagger UI: http://localhost:4000/api/v1/docs
[PrismaService] Connected to PostgreSQL via Prisma 7 Driver Adapter
```

#### Terminal 2 — Start Frontend Server (Port 3000)
```powershell
cd frontend
npm run dev
```
Verify output:
```
▲ Next.js 16.4.3 (Turbopack)
- Local: http://localhost:3000
✓ Ready in 1.2s
```

---

### Step 7 — Verification & Access Checkpoints

1. **Backend Swagger Documentation**:
   Open browser at: [http://localhost:4000/api/v1/docs](http://localhost:4000/api/v1/docs)  
   Verify that all 34 controllers and API schemas are interactive.

2. **Customer Storefront**:
   Open browser at: [http://localhost:3000](http://localhost:3000)  
   Verify the hero slider, catalog products, and brand cards render.

3. **Admin Portal Login**:
   Open browser at: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)  
   Sign in with:
   - **Email:** `admin@dslstationery.lk`
   - **Password:** `admin123@A` (or the password set during provisioning)  
   Verify successful redirect to `/admin/dashboard`.

