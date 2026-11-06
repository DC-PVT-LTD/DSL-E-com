-- CreateEnum
CREATE TYPE "NewsletterSubscriberStatus" AS ENUM ('PENDING', 'VERIFIED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "NewsletterConsentEventType" AS ENUM ('CONSENT_GIVEN', 'EMAIL_VERIFIED', 'UNSUBSCRIBED', 'RESUBSCRIPTION_REQUESTED');

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "NewsletterSubscriberStatus" NOT NULL DEFAULT 'PENDING',
    "consentGivenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentSource" TEXT NOT NULL DEFAULT 'WEBSITE_FOOTER',
    "consentTextVersion" TEXT NOT NULL DEFAULT 'v1.0',
    "unsubscribeToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_verification_tokens" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_consent_events" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "eventType" "NewsletterConsentEventType" NOT NULL,
    "consentTextVersion" TEXT NOT NULL DEFAULT 'v1.0',
    "consentSource" TEXT NOT NULL DEFAULT 'WEBSITE_FOOTER',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_consent_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribeToken_key" ON "newsletter_subscribers"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_status_idx" ON "newsletter_subscribers"("status");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_createdAt_idx" ON "newsletter_subscribers"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_verification_tokens_tokenHash_key" ON "newsletter_verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "newsletter_verification_tokens_subscriberId_idx" ON "newsletter_verification_tokens"("subscriberId");

-- CreateIndex
CREATE INDEX "newsletter_verification_tokens_expiresAt_idx" ON "newsletter_verification_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "newsletter_consent_events_subscriberId_idx" ON "newsletter_consent_events"("subscriberId");

-- CreateIndex
CREATE INDEX "newsletter_consent_events_eventType_idx" ON "newsletter_consent_events"("eventType");

-- CreateIndex
CREATE INDEX "newsletter_consent_events_createdAt_idx" ON "newsletter_consent_events"("createdAt");

-- AddForeignKey
ALTER TABLE "newsletter_verification_tokens" ADD CONSTRAINT "newsletter_verification_tokens_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "newsletter_subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_consent_events" ADD CONSTRAINT "newsletter_consent_events_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "newsletter_subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

