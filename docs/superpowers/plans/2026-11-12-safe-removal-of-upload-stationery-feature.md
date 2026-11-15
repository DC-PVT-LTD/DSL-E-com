# Implementation Plan — Safe Removal of "Upload Stationery / Booklist" Feature

**Goal:** Completely and safely remove the "Upload Stationery / Booklist" feature from DSL E-Commerce across frontend screens, navigation links, backend APIs, and database models without impacting any other features (e.g. Products, School Packs, Orders, Cart, Media Uploads).

---

## 1. Scope & Impact Analysis (Proof of Zero Side Effects)

We performed a deep codebase audit to trace every dependency:
* **Cart & Checkout**: `CartService` and `cartStore` have **zero** dependencies on uploaded documents.
* **General Media Uploads (`/api/v1/uploads`)**: Product, category, brand, and banner image uploads use `backend/src/modules/upload/`, which is completely separate and **will be preserved untouched**.
* **Products & Users**: `Product` and `User` models only had passive inverse relation arrays (`matchedUploadItems` and `documents`). No queries in `ProductsService` or `AuthService` rely on them.
* **School Packs & Stationery Finder**: Completely independent modules with zero imports or references to document uploads.

---

## 2. Inventory of Changes

### A. Frontend Files to Delete
1. `frontend/src/app/(store)/upload-list/page.tsx` *(Customer upload screen)*
2. `frontend/src/app/(store)/upload-list/[id]/review/page.tsx` *(Customer OCR review screen)*
3. `frontend/src/app/admin/upload-reviews/page.tsx` *(Admin reviews queue)*
4. `frontend/src/services/uploadService.ts` *(Upload API service)*
5. `frontend/src/services/__tests__/uploadService.test.ts` *(Service unit tests)*
6. `frontend/src/types/upload.ts` *(Upload TypeScript types)*

### B. Frontend Navigation Links to Clean Up
1. **`frontend/src/components/common/Navbar.tsx`**: Remove "Upload Booklist" link from the mobile navigation drawer (lines 528–534).
2. **`frontend/src/components/common/Footer.tsx`**: Remove "Upload Booklist" from the footer Quick Links (lines 260–263).
3. **`frontend/src/app/(store)/home/page.tsx`**: Remove secondary "Upload School Booklist" CTA link from the mid-page promotional banner (lines 483–490).
4. **`frontend/src/components/admin/AdminSidebar.tsx`**: Remove "Upload Reviews Queue" item from the `Smart Features & Bundles` navigation group (line 61) and clean up unused `Upload` icon import.
5. **`frontend/src/services/announcementService.ts`**: Remove announcement item `ann-4` ("Upload Your School Booklist for Instant Matching & Delivery") from the header ticker.
6. **`frontend/src/mocks/promotions.ts`**: Remove mock promo banner `banner-upload-list` pointing to `/upload-list`.
7. **`frontend/src/components/admin/BlueRibbonManager.tsx`**: Remove `/upload-list` preset destination shortcut.

### C. Backend Files to Delete
1. `backend/src/modules/uploaded-documents/` (Entire module folder):
   - `admin-uploaded-documents.controller.ts`
   - `uploaded-documents.controller.ts`
   - `uploaded-documents.service.ts`
   - `uploaded-documents.service.spec.ts`
   - `catalogue-matcher.service.ts`
   - `catalogue-matcher.service.spec.ts`
   - `private-storage.service.ts`
   - `uploaded-documents.module.ts`
   - `ocr/` (all OCR providers & vision services)
   - `dto/` (all upload DTOs)

### D. Backend Files to Update
1. **`backend/src/app.module.ts`**: Remove `UploadedDocumentsModule` import and registration from the imports array.

### E. Database Schema & Migration (`backend/prisma/schema.prisma`)
1. Remove `UploadedDocument` model.
2. Remove `ExtractedStationeryItem` model.
3. Remove unused enums: `DocumentStatus`, `ItemConfidence`, `MatchStatus`.
4. Remove `documents UploadedDocument[]` from `User` model.
5. Remove `matchedUploadItems ExtractedStationeryItem[]` from `Product` model.
6. Run safe migration: `npx prisma migrate dev --name remove_uploaded_documents_feature` and regenerate Prisma client.

---

## 3. Step-by-Step Execution Plan

### Step 1: Frontend Navigation & UI Links Clean-up
- Edit `Navbar.tsx`, `Footer.tsx`, `home/page.tsx`, `AdminSidebar.tsx`, `announcementService.ts`, `promotions.ts`, and `BlueRibbonManager.tsx` to remove links pointing to `/upload-list` and `/admin/upload-reviews`.

### Step 2: Delete Frontend Upload Routes & Services
- Delete `frontend/src/app/(store)/upload-list/` directory.
- Delete `frontend/src/app/admin/upload-reviews/` directory.
- Delete `frontend/src/services/uploadService.ts` and `frontend/src/types/upload.ts`.
- Delete `frontend/src/services/__tests__/uploadService.test.ts`.

### Step 3: Backend Module Clean-up
- Remove `UploadedDocumentsModule` from `backend/src/app.module.ts`.
- Delete `backend/src/modules/uploaded-documents/` directory.

### Step 4: Database Clean-up & Migration
- Update `backend/prisma/schema.prisma` to remove the 2 models, 3 enums, and relation fields.
- Apply migration and regenerate Prisma client.

### Step 5: Verification & Quality Assurance
- Run `npm run build --prefix frontend` (verify 0 route, TypeScript, or bundling errors).
- Run `npm run build --prefix backend` (verify 0 NestJS compilation errors).
- Run backend and frontend automated test suites.
- Verify in browser that Storefront, Admin portal, and General Media Uploads remain completely functional.

