-- ==============================================================================
-- Phase 4 – Stage 4: Product Bulk Import Execution Models & Global Lease
-- Additive Migration: Safe, non-destructive, zero impact on existing tables
-- ==============================================================================

-- 1. Create Enums
CREATE TYPE "ImportStockMode" AS ENUM ('SET_STOCK', 'ADD_STOCK');
CREATE TYPE "ImportBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED');
CREATE TYPE "ImportRowStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- 2. Create ProductImportPreview Table
CREATE TABLE "ProductImportPreview" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "previewChecksum" TEXT NOT NULL,
    "normalizedRows" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImportPreview_pkey" PRIMARY KEY ("id")
);

-- 3. Create ImportExecutionLease Table
CREATE TABLE "ImportExecutionLease" (
    "id" TEXT NOT NULL DEFAULT 'GLOBAL_IMPORT_LEASE',
    "batchId" TEXT,
    "ownerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "currentChunk" INTEGER NOT NULL DEFAULT 0,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportExecutionLease_pkey" PRIMARY KEY ("id")
);

-- Seed initial idle lease record
INSERT INTO "ImportExecutionLease" ("id", "status", "currentChunk", "heartbeatAt", "expiresAt", "createdAt", "updatedAt")
VALUES ('GLOBAL_IMPORT_LEASE', 'IDLE', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- 4. Create ProductImportBatch Table
CREATE TABLE "ProductImportBatch" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "previewId" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "stockMode" "ImportStockMode" NOT NULL DEFAULT 'SET_STOCK',
    "allowUpdates" BOOLEAN NOT NULL DEFAULT true,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "totalChunks" INTEGER NOT NULL DEFAULT 0,
    "committedChunk" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "successfulRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImportBatch_pkey" PRIMARY KEY ("id")
);

-- 5. Create ProductImportRowResult Table
CREATE TABLE "ProductImportRowResult" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "sku" TEXT,
    "action" TEXT NOT NULL,
    "status" "ImportRowStatus" NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImportRowResult_pkey" PRIMARY KEY ("id")
);

-- 6. Indexes & Constraints
CREATE UNIQUE INDEX "ProductImportBatch_idempotencyKey_key" ON "ProductImportBatch"("idempotencyKey");
CREATE INDEX "ProductImportPreview_createdById_idx" ON "ProductImportPreview"("createdById");
CREATE INDEX "ProductImportPreview_expiresAt_idx" ON "ProductImportPreview"("expiresAt");
CREATE INDEX "ProductImportBatch_adminId_idx" ON "ProductImportBatch"("adminId");
CREATE INDEX "ProductImportBatch_status_idx" ON "ProductImportBatch"("status");
CREATE INDEX "ProductImportBatch_createdAt_idx" ON "ProductImportBatch"("createdAt");
CREATE INDEX "ProductImportRowResult_batchId_rowNumber_idx" ON "ProductImportRowResult"("batchId", "rowNumber");
CREATE INDEX "ProductImportRowResult_batchId_status_idx" ON "ProductImportRowResult"("batchId", "status");

-- 7. Foreign Keys
ALTER TABLE "ProductImportPreview" ADD CONSTRAINT "ProductImportPreview_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductImportBatch" ADD CONSTRAINT "ProductImportBatch_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductImportBatch" ADD CONSTRAINT "ProductImportBatch_previewId_fkey" FOREIGN KEY ("previewId") REFERENCES "ProductImportPreview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductImportRowResult" ADD CONSTRAINT "ProductImportRowResult_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. Additive Permission Registration (NO automatic assignment to any role)
INSERT INTO "permissions" ("id", "key", "displayName", "description", "category", "createdAt", "updatedAt")
VALUES ('cmw5import0000000000000000', 'products.import', 'Import Products', 'Execute bulk product catalog and inventory imports from Excel/CSV files', 'Products', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
