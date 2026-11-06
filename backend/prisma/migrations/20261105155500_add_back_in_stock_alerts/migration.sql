-- CreateEnum
CREATE TYPE "BackInStockAlertStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'CANCELLED');

-- CreateTable
CREATE TABLE "BackInStockAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "BackInStockAlertStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackInStockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackInStockAlert_userId_idx" ON "BackInStockAlert"("userId");

-- CreateIndex
CREATE INDEX "BackInStockAlert_productId_idx" ON "BackInStockAlert"("productId");

-- CreateIndex
CREATE INDEX "BackInStockAlert_status_idx" ON "BackInStockAlert"("status");

-- CreateIndex
CREATE INDEX "BackInStockAlert_productId_status_idx" ON "BackInStockAlert"("productId", "status");

-- AddForeignKey
ALTER TABLE "BackInStockAlert" ADD CONSTRAINT "BackInStockAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackInStockAlert" ADD CONSTRAINT "BackInStockAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create partial unique index to prevent duplicate active (PENDING or PROCESSING) subscriptions for the same customer and product
CREATE UNIQUE INDEX "idx_back_in_stock_user_prod_active" ON "BackInStockAlert" ("userId", "productId") WHERE "status" IN ('PENDING', 'PROCESSING');

