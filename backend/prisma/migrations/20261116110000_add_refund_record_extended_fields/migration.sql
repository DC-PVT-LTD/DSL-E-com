-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
DO $$ BEGIN
    ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Add extended fields to RefundRecord
ALTER TABLE "RefundRecord"
    ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'LKR',
    ADD COLUMN IF NOT EXISTS "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    ADD COLUMN IF NOT EXISTS "externalReference" TEXT,
    ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
    ADD COLUMN IF NOT EXISTS "payloadHash" TEXT,
    ADD COLUMN IF NOT EXISTS "failureReason" TEXT,
    ADD COLUMN IF NOT EXISTS "maskedAccountNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "encryptedBankDetails" TEXT,
    ADD COLUMN IF NOT EXISTS "processedById" TEXT,
    ADD COLUMN IF NOT EXISTS "requestedById" TEXT,
    ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
    ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "completedById" TEXT,
    ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "orderReturnRequestId" TEXT,
    ADD COLUMN IF NOT EXISTS "metadata" JSONB,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RefundRecord_status_idx" ON "RefundRecord"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RefundRecord_orderReturnRequestId_idx" ON "RefundRecord"("orderReturnRequestId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RefundRecord_orderId_idempotencyKey_key" ON "RefundRecord"("orderId", "idempotencyKey");

-- AddForeignKey (OrderReturnRequest)
DO $$ BEGIN
    ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_orderReturnRequestId_fkey"
        FOREIGN KEY ("orderReturnRequestId") REFERENCES "OrderReturnRequest"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

