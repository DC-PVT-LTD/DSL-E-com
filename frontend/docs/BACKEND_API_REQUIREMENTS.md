# DSL STATIONERY — BACKEND API REQUIREMENTS
# Master Integration Contract for Frontend Development

This document maintains all API requirements, missing endpoints, query specifications, and data contracts between the Frontend and Backend.

See [PHASE_11_BACKEND_API_REQUIREMENTS.md](./PHASE_11_BACKEND_API_REQUIREMENTS.md) for full detailed Phase 11 Admin Order Management specifications.

## Summary of Active Requirements:
1. **Orders Dashboard Statistics:** `GET /api/v1/admin/orders/stats`
2. **Orders Listing Filtering & Sorting:** `paymentStatus`, `sortBy`, `sortOrder`, `startDate`, `endDate` in `GET /api/v1/orders`
3. **Customer Editing:** `PATCH /api/v1/admin/orders/:id/customer`
4. **Delivery Details Editing:** `PATCH /api/v1/admin/orders/:id/delivery`
5. **Item Adjustment & Recalculation:** `PATCH /api/v1/admin/orders/:id/items`
6. **Return Requests Management:** `GET /api/v1/admin/orders/:id/returns`, `PATCH /api/v1/admin/orders/:id/returns/:returnId/status`
7. **Order Audit History:** `GET /api/v1/admin/orders/:id/audit-history`
8. **Internal Admin Notes:** `POST /api/v1/admin/orders/:id/notes`
