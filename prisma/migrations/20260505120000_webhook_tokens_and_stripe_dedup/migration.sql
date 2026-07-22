-- Multi-tenant webhook routing: per-integration token used in the webhook URL path.
-- Existing rows are backfilled with a random hex token so every integration becomes
-- reachable via /api/webhooks/<platform>/<token> immediately after deploy.
-- All statements are idempotent (IF NOT EXISTS) so re-runs are safe.

ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "webhookToken" TEXT;

UPDATE "Integration"
SET "webhookToken" = md5(random()::text || clock_timestamp()::text || id)
WHERE "webhookToken" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Integration_webhookToken_key" ON "Integration"("webhookToken");
CREATE INDEX IF NOT EXISTS "Integration_webhookToken_idx" ON "Integration"("webhookToken");

-- Persistent Stripe webhook event deduplication.
-- Replaces the in-memory Set so processed events survive server restarts.
CREATE TABLE IF NOT EXISTS "StripeProcessedEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StripeProcessedEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StripeProcessedEvent_eventId_key" ON "StripeProcessedEvent"("eventId");
CREATE INDEX IF NOT EXISTS "StripeProcessedEvent_processedAt_idx" ON "StripeProcessedEvent"("processedAt");
