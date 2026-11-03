# DSL Stationery E-Commerce — REST API Conventions (v1)

This document establishes the architecture, URL naming, HTTP semantics, request validation, error formatting, and query parameter conventions for all current and future API endpoints in the DSL Stationery NestJS backend.

---

## 1. Global URI Structure

All API routes must use the standard global versioned prefix:

```text
/api/v1/{resource}
```

- **Health check:** `/api/v1/health`
- **Resource endpoints:** `/api/v1/products`, `/api/v1/categories`, etc.

### URL Naming Rules
- Use lowercase plural nouns for resource collections: `/api/v1/products`, `/api/v1/categories`, `/api/v1/brands`.
- Use kebab-case for multi-word paths: `/api/v1/store-settings`, `/api/v1/order-items`.
- Use nested paths for hierarchical ownership or sub-resources: `/api/v1/categories/:slug/products`.
- Avoid verbs in URLs (e.g. use `POST /api/v1/orders` instead of `/api/v1/createOrder`).

---

## 2. HTTP Methods & Status Codes

| Method | Idempotent | Usage | Standard Status Code |
| :--- | :--- | :--- | :--- |
| `GET` | Yes | Retrieve a resource or list of resources | `200 OK` |
| `POST` | No | Create a new resource or execute an action | `201 Created` (or `200 OK` for actions) |
| `PUT` | Yes | Replace an entire resource | `200 OK` |
| `PATCH` | No | Partially update a resource | `200 OK` |
| `DELETE` | Yes | Soft or hard delete a resource | `200 OK` or `204 No Content` |
| `OPTIONS` | Yes | CORS pre-flight negotiation | `204 No Content` |

### Error Status Codes
- `400 Bad Request`: Payload validation failures or malformed input.
- `401 Unauthorized`: Authentication credentials missing or invalid.
- `403 Forbidden`: Authenticated user lacks permission for the resource.
- `404 Not Found`: Resource does not exist.
- `409 Conflict`: Unique constraint violation (e.g. duplicate slug or SKU).
- `422 Unprocessable Entity`: Business logic rule violation.
- `500 Internal Server Error`: Unexpected server exception.
- `503 Service Unavailable`: Dependent service (e.g. PostgreSQL) down.

---

## 3. Standard Response Conventions

### A. Single Resource / Action Response
For single resource endpoints (or commands), return a consistent envelope:
```json
{
  "success": true,
  "data": {
    "id": "cm...product1",
    "name": "Pentonic 0.7mm Ballpoint Pen",
    "price": 60.00
  },
  "message": "Product retrieved successfully"
}
```

### B. Paginated Collection Response
List endpoints must return the `data` array alongside standard `meta` pagination metadata:
```json
{
  "success": true,
  "data": [
    { "id": "cm...product1", "name": "Pentonic 0.7mm Ballpoint Pen" }
  ],
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

### C. Direct System Endpoints (Health Check)
System diagnostics such as `GET /api/v1/health` preserve their dedicated monitoring contracts without unnecessary enveloping:
```json
{
  "status": "healthy",
  "service": "dsl-stationery-backend",
  "timestamp": "2026-10-28T11:19:12.117Z",
  "uptime": 11.28,
  "database": {
    "status": "connected",
    "latencyMs": 79,
    "counts": {
      "products": 8,
      "categories": 15
    }
  }
}
```

---

## 4. Query Parameters: Pagination, Sorting & Filtering

### Standard Parameter Names
- `page`: 1-based page number (integer $\ge 1$, default `1`).
- `limit`: Number of items per page (integer between `1` and `100`, default `20`).
- `sortBy`: Field name to sort by (strictly validated against an allowed whitelist).
- `sortOrder`: Sort direction (`asc` or `desc`, default `desc`).

### Whitelist Validation
Controllers must NOT accept arbitrary database column names for `sortBy`. Every module must define an explicit whitelist using `createPaginationSchema(['createdAt', 'price', 'name'], 'createdAt')`.

### Filtering
- Filter parameters must be specific and explicitly defined in Zod schemas (e.g. `categoryId`, `brandId`, `inStock=true`).
- Raw Prisma query objects from clients are strictly prohibited.

---

## 5. Standardized Error Handling

All client and server errors are captured by `HttpExceptionFilter` and returned in a uniform JSON format:

```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Validation failed",
  "timestamp": "2026-10-28T11:34:08.688Z",
  "path": "/api/v1/products",
  "details": [
    {
      "field": "price",
      "message": "Price must be a positive number",
      "code": "too_small"
    }
  ]
}
```

### Security & Redaction
- Stack traces and SQL queries are NEVER returned to clients.
- Passwords, authorization headers, tokens, and database credentials are fully redacted from error responses and logs.

---

## 6. Catalogue Endpoints Specification (Phase 6)

### A. Categories API
- `GET /api/v1/categories` — List categories with pagination, `featured` filter, text search, and `itemCount`.
- `GET /api/v1/categories/slug/:slug` — Retrieve category by unique slug.
- `GET /api/v1/categories/:id` — Retrieve category by unique CUID.
- `GET /api/v1/categories/:id/products` — Retrieve active products belonging to the category.
- `POST /api/v1/categories` — Protected: Create category (`AdminAuthGuard`).
- `PATCH /api/v1/categories/:id` — Protected: Update category (`AdminAuthGuard`).
- `DELETE /api/v1/categories/:id` — Protected: Delete category with relational guard (blocks deletion if products are attached, returning HTTP 409 Conflict).

### B. Brands API
- `GET /api/v1/brands` — List brands with pagination, `featured` filter, search, and `itemCount`.
- `GET /api/v1/brands/slug/:slug` — Retrieve brand by unique slug.
- `GET /api/v1/brands/:id` — Retrieve brand by unique CUID.
- `GET /api/v1/brands/:id/products` — Retrieve active products belonging to the brand.
- `POST /api/v1/brands` — Protected: Create brand (`AdminAuthGuard`).
- `PATCH /api/v1/brands/:id` — Protected: Update brand (`AdminAuthGuard`).
- `DELETE /api/v1/brands/:id` — Protected: Delete brand (blocks deletion if products are attached, returning HTTP 409 Conflict).

### C. Products API
- `GET /api/v1/products` — List published, active products for storefront with:
  - Search: text matching across name, description, shortDescription, SKU, and tags.
  - Category filter: `categoryId` or `categorySlug`.
  - Brand filter: `brandId` or `brandSlug`.
  - Price filter: `minPrice` and `maxPrice` (in integer cents).
  - Stock filter: `inStockOnly=true`.
  - Merchandising flags: `isFeatured`, `isNewArrival`, `isBestSeller`.
  - Sorting whitelist: `createdAt`, `priceCents`, `name`, `rating`, `stockQuantity` (`asc` / `desc`).
  - Privacy: `costPriceCents` is strictly redacted from public storefront responses.
- `GET /api/v1/products/slug/:slug` — Retrieve active product details by slug.
- `GET /api/v1/products/:id` — Retrieve active product details by ID.
- `POST /api/v1/products` — Protected: Create product (`AdminAuthGuard`).
- `PATCH /api/v1/products/:id` — Protected: Update product (`AdminAuthGuard`).
- `PATCH /api/v1/products/:id/status` — Protected: Toggle active/inactive status (`AdminAuthGuard`).
- `DELETE /api/v1/products/:id` — Protected: Deactivate product (`AdminAuthGuard`).

---

## 7. Inventory and Pricing Rules

1. **Integer Minor Units:** All monetary figures (`priceCents`, `compareAtPriceCents`, `costPriceCents`) are strictly represented in integer cents (e.g. Rs. 450.00 = `45000`). Floating-point arithmetic for currency is strictly prohibited.
2. **Single Source of Truth for Stock:**
   - For standalone products, `Product.stockQuantity` is the primary inventory source of truth.
   - For variant-enabled items, `ProductVariant.stockQuantity` tracks specific SKU stock.
3. **Public Storefront Safety:** Unlisted, draft, or inactive items (`isActive: false`) are strictly omitted from public catalogue listings and text search.
4. **Relational Deletion Integrity:** Categories and Brands cannot be hard-deleted while products reference them (`onDelete: Restrict`).
5. **Management Write Protection:** Write endpoints require full authentication and authorization. In this phase, they are protected with `AdminAuthGuard` (HTTP 401 Unauthorized) until the AuthModule is active.
