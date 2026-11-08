-- AlterEnum
ALTER TYPE "DiscountType" ADD VALUE IF NOT EXISTS 'FREE_DELIVERY';

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PromotionType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_DELIVERY', 'PRODUCT_SPECIFIC', 'CATEGORY_SPECIFIC', 'ORDER_LEVEL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'DISABLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable "Promotion"
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '';
UPDATE "Promotion" SET "name" = "title" WHERE "name" = '' AND "title" IS NOT NULL;
ALTER TABLE "Promotion" ALTER COLUMN "title" DROP NOT NULL;
ALTER TABLE "Promotion" ALTER COLUMN "code" DROP NOT NULL;
ALTER TABLE "Promotion" ALTER COLUMN "description" DROP NOT NULL;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "promotionType" "PromotionType" NOT NULL DEFAULT 'PERCENTAGE';
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "maximumDiscountAmount" INTEGER;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "minimumOrderAmount" INTEGER;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "status" "PromotionStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "isStackableWithSchoolPacks" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;

-- Indexes on "Promotion"
CREATE INDEX IF NOT EXISTS "Promotion_status_idx" ON "Promotion"("status");
CREATE INDEX IF NOT EXISTS "Promotion_startDate_endDate_idx" ON "Promotion"("startDate", "endDate");

-- AlterTable "Order"
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "promoCode" TEXT;

-- CreateTable "PromotionCode"
CREATE TABLE IF NOT EXISTS "PromotionCode" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maximumTotalUsage" INTEGER,
    "maximumUsagePerCustomer" INTEGER,
    "totalUsage" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable "PromotionProduct"
CREATE TABLE IF NOT EXISTS "PromotionProduct" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable "PromotionCategory"
CREATE TABLE IF NOT EXISTS "PromotionCategory" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable "PromotionRedemption"
CREATE TABLE IF NOT EXISTS "PromotionRedemption" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "promotionCodeId" TEXT,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "orderId" TEXT,
    "discountAmount" INTEGER NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PromotionCode_code_key" ON "PromotionCode"("code");
CREATE INDEX IF NOT EXISTS "PromotionCode_promotionId_idx" ON "PromotionCode"("promotionId");
CREATE INDEX IF NOT EXISTS "PromotionCode_code_idx" ON "PromotionCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PromotionProduct_promotionId_productId_key" ON "PromotionProduct"("promotionId", "productId");
CREATE INDEX IF NOT EXISTS "PromotionProduct_promotionId_idx" ON "PromotionProduct"("promotionId");
CREATE INDEX IF NOT EXISTS "PromotionProduct_productId_idx" ON "PromotionProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PromotionCategory_promotionId_categoryId_key" ON "PromotionCategory"("promotionId", "categoryId");
CREATE INDEX IF NOT EXISTS "PromotionCategory_promotionId_idx" ON "PromotionCategory"("promotionId");
CREATE INDEX IF NOT EXISTS "PromotionCategory_categoryId_idx" ON "PromotionCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PromotionRedemption_orderId_promotionId_key" ON "PromotionRedemption"("orderId", "promotionId");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_promotionId_idx" ON "PromotionRedemption"("promotionId");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_promotionCodeId_idx" ON "PromotionRedemption"("promotionCodeId");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_customerId_idx" ON "PromotionRedemption"("customerId");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_customerEmail_idx" ON "PromotionRedemption"("customerEmail");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_orderId_idx" ON "PromotionRedemption"("orderId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PromotionCode" ADD CONSTRAINT "PromotionCode_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PromotionProduct" ADD CONSTRAINT "PromotionProduct_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PromotionProduct" ADD CONSTRAINT "PromotionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PromotionCategory" ADD CONSTRAINT "PromotionCategory_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PromotionCategory" ADD CONSTRAINT "PromotionCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promotionCodeId_fkey" FOREIGN KEY ("promotionCodeId") REFERENCES "PromotionCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

