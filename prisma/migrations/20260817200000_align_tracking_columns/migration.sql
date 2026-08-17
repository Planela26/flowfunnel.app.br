-- Alinha as tabelas de tracking com o schema.prisma.
--
-- O schema descreve colunas que nunca foram criadas no banco. Foram adicionadas
-- ao modelo em algum momento sem a migration correspondente, e como o Prisma só
-- valida o que a consulta toca, o desvio ficou invisível até alguém consultar a
-- coluna faltante.
--
-- O efeito prático é que boa parte do rastreamento nunca funcionou:
--
--   TrackedLead.visitorId       o mesmo navegador não era reconhecido entre
--                               visitas — cada jornada nascia solta.
--   TrackedLead.fbclid/gclid/   os IDs de clique de Meta, Google, TikTok e
--   ttclid/msclkid              Microsoft eram enviados pelo tracker e
--                               descartados na gravação. Sem eles não há como
--                               casar a venda com o anúncio dentro da própria
--                               plataforma de anúncios.
--   TrackedEvent.sessionId      eventos não se ligavam à sessão.
--   TrackedConversion.orderId   ESTA é a mais grave: `orderId` é a chave da
--   TrackedConversion.platform  atribuição determinística em lib/attribution.ts
--                               (estratégia A.2 — a thank-you page reporta o
--                               pedido, o webhook da plataforma chega depois e
--                               casa pelo mesmo id). Sem a coluna, a consulta
--                               falhava e a venda caía na atribuição
--                               probabilística, ou ficava sem origem.
--
-- Todas as colunas são aditivas e nulas (ou com default), então as linhas já
-- existentes continuam válidas. Nada é reprocessado: as visitas antigas seguem
-- sem esses dados, porque eles nunca chegaram a ser guardados.

-- ── TrackedLead ─────────────────────────────────────────────────────────────
ALTER TABLE "TrackedLead" ADD COLUMN IF NOT EXISTS "visitorId" TEXT;
ALTER TABLE "TrackedLead" ADD COLUMN IF NOT EXISTS "fbclid"    TEXT;
ALTER TABLE "TrackedLead" ADD COLUMN IF NOT EXISTS "gclid"     TEXT;
ALTER TABLE "TrackedLead" ADD COLUMN IF NOT EXISTS "ttclid"    TEXT;
ALTER TABLE "TrackedLead" ADD COLUMN IF NOT EXISTS "msclkid"   TEXT;

CREATE INDEX IF NOT EXISTS "TrackedLead_visitorId_idx" ON "TrackedLead" ("visitorId");

-- ── TrackedEvent ────────────────────────────────────────────────────────────
ALTER TABLE "TrackedEvent" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

-- ── TrackedConversion ───────────────────────────────────────────────────────
ALTER TABLE "TrackedConversion" ADD COLUMN IF NOT EXISTS "orderId"  TEXT;
ALTER TABLE "TrackedConversion" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "TrackedConversion" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'BRL';

-- Índice do match determinístico: é por aqui que o webhook da plataforma
-- procura a conversão reportada pela thank-you page.
CREATE INDEX IF NOT EXISTS "TrackedConversion_orderId_idx" ON "TrackedConversion" ("orderId");
