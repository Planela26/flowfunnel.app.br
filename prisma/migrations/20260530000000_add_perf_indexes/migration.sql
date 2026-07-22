-- Performance indexes (idempotent — safe to re-run).
-- Adds missing FK / hot-path indexes and replaces single-column indexes
-- with the composite indexes that supersede them.

-- New single-column FK indexes.
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Funnel_userId_idx" ON "Funnel"("userId");

-- FunnelEvent: composite (funnelId, timestamp) covers funnelId-only lookups too,
-- so the standalone funnelId index becomes redundant.
CREATE INDEX IF NOT EXISTS "FunnelEvent_funnelId_timestamp_idx" ON "FunnelEvent"("funnelId", "timestamp");
DROP INDEX IF EXISTS "FunnelEvent_funnelId_idx";

-- WebhookLog: composite (userId, createdAt) covers userId-only lookups too.
CREATE INDEX IF NOT EXISTS "WebhookLog_userId_createdAt_idx" ON "WebhookLog"("userId", "createdAt");
DROP INDEX IF EXISTS "WebhookLog_userId_idx";
