-- Persistent Mercado Pago webhook event deduplication.
-- Replaces the in-memory Map so processed events survive server restarts /
-- multiple instances. eventId = `${paymentId}:${status}`.
-- All statements are idempotent (IF NOT EXISTS) so re-runs are safe.

CREATE TABLE IF NOT EXISTS "MercadoPagoProcessedEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MercadoPagoProcessedEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MercadoPagoProcessedEvent_eventId_key" ON "MercadoPagoProcessedEvent"("eventId");
CREATE INDEX IF NOT EXISTS "MercadoPagoProcessedEvent_processedAt_idx" ON "MercadoPagoProcessedEvent"("processedAt");
