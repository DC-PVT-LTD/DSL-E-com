-- AlterTable
ALTER TABLE "User" ADD COLUMN "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "emailVerificationOtpHash" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "emailVerificationLastSentAt" TIMESTAMP(3);

-- Mark pre-existing registered users as verified so existing accounts remain intact
UPDATE "User" SET "isEmailVerified" = true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "trackingOtpHash" TEXT;
ALTER TABLE "Order" ADD COLUMN "trackingOtpExpiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "trackingOtpAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "trackingOtpLastSentAt" TIMESTAMP(3);

