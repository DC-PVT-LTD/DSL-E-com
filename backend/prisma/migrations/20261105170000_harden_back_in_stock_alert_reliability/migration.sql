-- AlterTable
ALTER TABLE "BackInStockAlert" ADD COLUMN "processingStartedAt" TIMESTAMP(3),
ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "uncertainDelivery" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "BackInStockAlert_status_leaseExpiresAt_idx" ON "BackInStockAlert"("status", "leaseExpiresAt");

