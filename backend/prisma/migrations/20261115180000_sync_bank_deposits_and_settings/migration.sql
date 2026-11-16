-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED', 'RELEASED', 'PAYMENT_PENDING');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('INITIATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BankDepositStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReturnItemStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PACKED';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- DropForeignKey
ALTER TABLE "ExtractedStationeryItem" DROP CONSTRAINT "ExtractedStationeryItem_documentId_fkey";

-- DropForeignKey
ALTER TABLE "ExtractedStationeryItem" DROP CONSTRAINT "ExtractedStationeryItem_matchedProductId_fkey";

-- DropForeignKey
ALTER TABLE "UploadedDocument" DROP CONSTRAINT "UploadedDocument_userId_fkey";

-- AlterTable
ALTER TABLE "HomepageBanner" ADD COLUMN     "placement" TEXT DEFAULT 'HERO';

-- AlterTable
ALTER TABLE "ImportExecutionLease" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrderAddressSnapshot" ADD COLUMN     "buildingNo" TEXT,
ADD COLUMN     "formattedAddress" TEXT,
ADD COLUMN     "landmark" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "street" TEXT;

-- AlterTable
ALTER TABLE "ProductImportBatch" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Promotion" ALTER COLUMN "discountType" SET DEFAULT 'PERCENTAGE';

-- AlterTable
ALTER TABLE "PromotionCode" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SkuSequence" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "accountHolderName" TEXT,
ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "bankCode" TEXT,
ADD COLUMN     "bankLogoUrl" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "branchCode" TEXT,
ADD COLUMN     "branchName" TEXT,
ADD COLUMN     "paymentInstructions" TEXT,
ADD COLUMN     "referenceInstructions" TEXT,
ALTER COLUMN "bankTransferEnabled" SET DEFAULT false;

-- DropTable
DROP TABLE "ExtractedStationeryItem";

-- DropTable
DROP TABLE "UploadedDocument";

-- DropEnum
DROP TYPE "DocumentStatus";

-- DropEnum
DROP TYPE "ItemConfidence";

-- DropEnum
DROP TYPE "MatchStatus";

-- CreateTable
CREATE TABLE "OrderAuditLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "adminId" TEXT,
    "adminName" TEXT NOT NULL DEFAULT 'System',
    "action" TEXT NOT NULL,
    "fieldChanged" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderNote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL DEFAULT 'Staff',
    "note" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderReturnRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderReturnItem" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReturnItemStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "method" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "reference" TEXT,
    "externalReference" TEXT,
    "idempotencyKey" TEXT,
    "payloadHash" TEXT,
    "reason" TEXT NOT NULL,
    "failureReason" TEXT,
    "maskedAccountNumber" TEXT,
    "encryptedBankDetails" TEXT,
    "processedBy" TEXT,
    "processedById" TEXT,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "orderReturnRequestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservationItem" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReservationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "orderId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'INITIATED',
    "gatewayReference" TEXT,
    "idempotencyKey" TEXT,
    "gatewayPayload" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankDepositSubmission" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentAttemptId" TEXT,
    "receiptStorageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileHashSha256" TEXT,
    "referenceNumber" TEXT NOT NULL,
    "depositDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "customerNotes" TEXT,
    "status" "BankDepositStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankDepositSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedListItem" (
    "id" TEXT NOT NULL,
    "savedListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderAuditLog_orderId_idx" ON "OrderAuditLog"("orderId");

-- CreateIndex
CREATE INDEX "OrderAuditLog_createdAt_idx" ON "OrderAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "OrderNote_orderId_idx" ON "OrderNote"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderReturnRequest_returnNumber_key" ON "OrderReturnRequest"("returnNumber");

-- CreateIndex
CREATE INDEX "OrderReturnRequest_orderId_idx" ON "OrderReturnRequest"("orderId");

-- CreateIndex
CREATE INDEX "OrderReturnItem_returnRequestId_idx" ON "OrderReturnItem"("returnRequestId");

-- CreateIndex
CREATE INDEX "OrderReturnItem_orderItemId_idx" ON "OrderReturnItem"("orderItemId");

-- CreateIndex
CREATE INDEX "RefundRecord_orderId_idx" ON "RefundRecord"("orderId");

-- CreateIndex
CREATE INDEX "RefundRecord_status_idx" ON "RefundRecord"("status");

-- CreateIndex
CREATE INDEX "RefundRecord_orderReturnRequestId_idx" ON "RefundRecord"("orderReturnRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundRecord_orderId_idempotencyKey_key" ON "RefundRecord"("orderId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "StockReservation_idempotencyKey_key" ON "StockReservation"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "StockReservation_orderId_key" ON "StockReservation"("orderId");

-- CreateIndex
CREATE INDEX "StockReservation_userId_idx" ON "StockReservation"("userId");

-- CreateIndex
CREATE INDEX "StockReservation_sessionId_idx" ON "StockReservation"("sessionId");

-- CreateIndex
CREATE INDEX "StockReservation_status_idx" ON "StockReservation"("status");

-- CreateIndex
CREATE INDEX "StockReservation_expiresAt_idx" ON "StockReservation"("expiresAt");

-- CreateIndex
CREATE INDEX "StockReservationItem_reservationId_idx" ON "StockReservationItem"("reservationId");

-- CreateIndex
CREATE INDEX "StockReservationItem_productId_idx" ON "StockReservationItem"("productId");

-- CreateIndex
CREATE INDEX "StockReservationItem_variantId_idx" ON "StockReservationItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_gatewayReference_key" ON "PaymentAttempt"("gatewayReference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_idempotencyKey_key" ON "PaymentAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentAttempt_reservationId_idx" ON "PaymentAttempt"("reservationId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_orderId_idx" ON "PaymentAttempt"("orderId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_idx" ON "PaymentAttempt"("status");

-- CreateIndex
CREATE INDEX "BankDepositSubmission_orderId_idx" ON "BankDepositSubmission"("orderId");

-- CreateIndex
CREATE INDEX "BankDepositSubmission_status_idx" ON "BankDepositSubmission"("status");

-- CreateIndex
CREATE INDEX "BankDepositSubmission_referenceNumber_idx" ON "BankDepositSubmission"("referenceNumber");

-- CreateIndex
CREATE INDEX "BankDepositSubmission_paymentAttemptId_idx" ON "BankDepositSubmission"("paymentAttemptId");

-- CreateIndex
CREATE INDEX "SavedList_userId_idx" ON "SavedList"("userId");

-- CreateIndex
CREATE INDEX "SavedListItem_savedListId_idx" ON "SavedListItem"("savedListId");

-- CreateIndex
CREATE INDEX "SavedListItem_productId_idx" ON "SavedListItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedListItem_savedListId_productId_key" ON "SavedListItem"("savedListId", "productId");

-- AddForeignKey
ALTER TABLE "OrderAuditLog" ADD CONSTRAINT "OrderAuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturnRequest" ADD CONSTRAINT "OrderReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturnItem" ADD CONSTRAINT "OrderReturnItem_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "OrderReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturnItem" ADD CONSTRAINT "OrderReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_orderReturnRequestId_fkey" FOREIGN KEY ("orderReturnRequestId") REFERENCES "OrderReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservationItem" ADD CONSTRAINT "StockReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "StockReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservationItem" ADD CONSTRAINT "StockReservationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservationItem" ADD CONSTRAINT "StockReservationItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "StockReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankDepositSubmission" ADD CONSTRAINT "BankDepositSubmission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankDepositSubmission" ADD CONSTRAINT "BankDepositSubmission_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankDepositSubmission" ADD CONSTRAINT "BankDepositSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedList" ADD CONSTRAINT "SavedList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListItem" ADD CONSTRAINT "SavedListItem_savedListId_fkey" FOREIGN KEY ("savedListId") REFERENCES "SavedList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListItem" ADD CONSTRAINT "SavedListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

