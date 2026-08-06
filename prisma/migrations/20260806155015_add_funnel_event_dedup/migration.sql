-- AddColumn source e transactionId para deduplicação atômica de FunnelEvent
ALTER TABLE "FunnelEvent" ADD COLUMN "source" TEXT;
ALTER TABLE "FunnelEvent" ADD COLUMN "transactionId" TEXT;

-- Constraint única composta: evita inserir mesmo evento 2x da mesma fonte/plataforma
-- Ignora quando são NULL (eventos que não vêm de webhook de pagamento)
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "idx_funnel_event_dedup" UNIQUE ("funnelId", "source", "transactionId");
