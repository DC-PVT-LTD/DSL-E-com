# DSL Stationery E-Commerce — NestJS Backend

Independent NestJS backend application for the DSL Stationery E-Commerce platform, providing a typed, layered architecture with PostgreSQL 18.4, Prisma 7.10.1, and Zod validation.

---

## 1. Prerequisites

- **Node.js:** v20.x or v22+ (v24 supported)
- **Package Manager:** npm v10+
- **Database:** PostgreSQL 18.4 running on `localhost:5432` with database `dsl_stationery`
- **Operating System:** Windows, macOS, or Linux

---

## 2. Dependency Installation

From the `backend/` directory:

```powershell
npm install
```

Prisma client code generation is configured to output directly to `src/generated/prisma`:

```powershell
npx prisma generate
```

---

## 3. Environment Setup

Create a `.env` file in `backend/` copied from `.env.example`:

```powershell
Copy-Item .env.example .env
```

### Environment Variables

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | No | `4000` | Port for the NestJS HTTP listener |
| `NODE_ENV` | No | `development` | Runtime environment (`development`, `test`, `production`) |
| `CORS_ORIGIN` | No | `http://localhost:3000,http://localhost:3002` | Comma-separated list of allowed frontend origins |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (`postgresql://user:pass@host:5432/dsl_stationery`) |

Startup fails immediately with safe configuration diagnostics if required variables are missing or invalid. Secrets are never printed in logs or error messages.

---

## 4. Development Server Startup

Start the backend in watch mode:

```powershell
npm run start:dev
```

Standard start:

```powershell
npm run start
```

The server binds to `http://localhost:4000/api/v1`.

---

## 5. Production Build

Compile TypeScript and bundle Prisma client assets:

```powershell
npm run build
```

Run the compiled production server:

```powershell
npm run start:prod
# or: node dist/main.js
```

---

## 6. Test Commands

The backend uses **Vitest** for unit and integration testing:

```powershell
# Run all tests once
npm test

# Run tests in watch mode
npx vitest

# Run a specific test suite
npx vitest run src/health/health.controller.spec.ts
```

---

## 7. Health Endpoint

Verify backend and database connectivity without authentication:

```powershell
curl.exe -i http://localhost:4000/api/v1/health
```

### Successful Response (HTTP 200 OK)
```json
{
  "status": "healthy",
  "service": "dsl-stationery-backend",
  "timestamp": "2026-10-28T11:19:12.117Z",
  "uptime": 45.2,
  "database": {
    "status": "connected",
    "latencyMs": 14,
    "counts": {
      "products": 8,
      "categories": 15
    }
  }
}
```

### Degraded Response (HTTP 503 Service Unavailable)
If the database connection fails:
```json
{
  "statusCode": 503,
  "error": "SERVICE_UNAVAILABLE",
  "message": "Service Unavailable",
  "timestamp": "2026-10-28T11:20:00.000Z",
  "path": "/api/v1/health",
  "details": {
    "database": {
      "status": "disconnected",
      "error": "Database ping query failed"
    }
  }
}
```

---

## 8. REST API Conventions

- **Prefix:** All routes reside under `/api/v1/`.
- **Naming:** Plural lowercase nouns with kebab-case: `/api/v1/products`, `/api/v1/store-settings`.
- **Methods:** Standard HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
- **Complete specification:** See [`docs/api-conventions.md`](file:///D:/projects/office/DSL%20E-com/backend/docs/api-conventions.md).

---

## 9. Error and Success Response Formats

### Standard Resource Success Envelope
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Standardized Error Format (Global Exception Filter)
```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Validation failed",
  "timestamp": "2026-10-28T11:34:08.688Z",
  "path": "/api/v1/products",
  "details": [
    {
      "field": "name",
      "message": "Name is required",
      "code": "invalid_type"
    }
  ]
}
```

Stack traces, raw SQL queries, and sensitive credentials are never exposed in responses.

---

## 10. Pagination, Sorting & Filtering Conventions

List endpoints accept standardized query parameters:

| Parameter | Type | Default | Constraint |
| :--- | :--- | :--- | :--- |
| `page` | Integer | `1` | $\ge 1$ |
| `limit` | Integer | `20` | $1 \le \text{limit} \le 100$ |
| `sortBy` | String | Module default | Strictly validated against allowed whitelist |
| `sortOrder` | Enum | `desc` | `asc` or `desc` |

### Paginated Response Structure
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 45,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Module Implementation Pattern
```typescript
import { createPaginationSchema, toPrismaPagination, createPaginatedResponse } from '../common/pagination/pagination.util';

// 1. Whitelist allowed sort fields
const ProductQuerySchema = createPaginationSchema(['createdAt', 'price', 'name'], 'createdAt');

// 2. Map query params to Prisma
const { skip, take, orderBy } = toPrismaPagination(validatedQuery);
```
