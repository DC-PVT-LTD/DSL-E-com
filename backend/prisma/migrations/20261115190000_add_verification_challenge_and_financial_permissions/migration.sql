-- CreateEnum
CREATE TYPE "VerificationChallengeStatus" AS ENUM ('PENDING', 'VERIFIED', 'CONSUMED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "VerificationChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "metadata" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "status" "VerificationChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "userName" TEXT,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "beforeState" JSONB,
    "afterState" JSONB,
    "challengeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationChallenge_userId_status_idx" ON "VerificationChallenge"("userId", "status");
CREATE INDEX "VerificationChallenge_expiresAt_idx" ON "VerificationChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "AdminActivityLog_userId_idx" ON "AdminActivityLog"("userId");
CREATE INDEX "AdminActivityLog_action_idx" ON "AdminActivityLog"("action");
CREATE INDEX "AdminActivityLog_entityType_entityId_idx" ON "AdminActivityLog"("entityType", "entityId");
CREATE INDEX "AdminActivityLog_createdAt_idx" ON "AdminActivityLog"("createdAt");
CREATE INDEX "AdminActivityLog_status_idx" ON "AdminActivityLog"("status");

-- AddForeignKey
ALTER TABLE "VerificationChallenge" ADD CONSTRAINT "VerificationChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActivityLog" ADD CONSTRAINT "AdminActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert Financial & Separated Permissions
INSERT INTO "permissions" ("id", "key", "displayName", "category", "description", "createdAt", "updatedAt")
VALUES
  ('perm_' || substr(md5('orders.fulfill'), 1, 20), 'orders.fulfill', 'Fulfill Orders', 'Orders', 'Advance order fulfillment workflow (processing, packed, shipped, delivered)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_' || substr(md5('orders.cancel'), 1, 20), 'orders.cancel', 'Cancel Orders', 'Orders', 'Cancel orders and release or restock reserved inventory', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_' || substr(md5('payments.verify_bank_deposit'), 1, 20), 'payments.verify_bank_deposit', 'Verify Bank Deposit Slips', 'Payments', 'Approve or reject customer bank deposit slips and verify payment transfers', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_' || substr(md5('orders.refund'), 1, 20), 'orders.refund', 'Issue & Manage Refunds', 'Orders', 'Initiate, approve, execute, and record customer monetary refunds', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_' || substr(md5('settings.financial'), 1, 20), 'settings.financial', 'Manage Financial & Bank Settings', 'Settings', 'View and update store bank account details, SWIFT codes, and payment gateways', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Assign to Super Admin (all 5)
INSERT INTO "role_permissions" ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.slug = 'super_admin'
  AND p.key IN ('orders.fulfill', 'orders.cancel', 'payments.verify_bank_deposit', 'orders.refund', 'settings.financial')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Assign to Project Manager (orders.fulfill, orders.cancel)
INSERT INTO "role_permissions" ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.slug = 'project_manager'
  AND p.key IN ('orders.fulfill', 'orders.cancel')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Assign to Order Manager (orders.fulfill, orders.cancel)
INSERT INTO "role_permissions" ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.slug = 'order_manager'
  AND p.key IN ('orders.fulfill', 'orders.cancel')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

